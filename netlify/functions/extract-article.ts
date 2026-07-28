import type { Handler } from '@netlify/functions'
import { parseHTML } from 'linkedom'
import { Readability } from '@mozilla/readability'
import { errorResponse, jsonResponse, clampText } from './_shared/http'

// ---------------------------------------------------------------------------
// POST /.netlify/functions/extract-article
// Body: { url: string }
//
// Runs server-side (never in the browser) so the site's response isn't
// blocked by CORS and so we control the User-Agent / timeout. Uses
// Readability (the engine behind Firefox Reader View) to pull the main
// article content out of arbitrary HTML.
// ---------------------------------------------------------------------------

const FETCH_TIMEOUT_MS = 15_000
const DEFAULT_UA =
  process.env.EXTRACTOR_USER_AGENT ??
  'Mozilla/5.0 (compatible; GermanNewsLearningBot/1.0; +https://example.com/bot)'

function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (h === 'localhost' || h.endsWith('.local')) return true
  // crude private-IP guard to reduce SSRF risk against internal services
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true
  return false
}

function validateUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw { code: 'invalid_url', message: 'That does not look like a valid URL.' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw { code: 'invalid_url', message: 'Only http(s) URLs are supported.' }
  }
  if (isPrivateHostname(url.hostname)) {
    throw { code: 'invalid_url', message: 'That URL is not allowed.' }
  }
  return url
}

function metaContent(document: Document, selectors: string[]): string | null {
  for (const selector of selectors) {
    const el = document.querySelector(selector)
    const content = el?.getAttribute('content')?.trim()
    if (content) return content
  }
  return null
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return errorResponse(405, 'method_not_allowed', 'Use POST.')
  }

  let body: { url?: string }
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return errorResponse(400, 'invalid_request', 'Request body must be valid JSON.')
  }

  if (!body.url || typeof body.url !== 'string') {
    return errorResponse(400, 'invalid_request', 'Missing "url" field.')
  }

  let url: URL
  try {
    url = validateUrl(body.url)
  } catch (err) {
    const e = err as { code: string; message: string }
    return errorResponse(400, e.code, e.message)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  let html: string
  let finalStatus: number
  try {
    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': DEFAULT_UA,
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: controller.signal,
    })
    finalStatus = res.status

    if (res.status === 401 || res.status === 402) {
      return errorResponse(422, 'paywall', 'The article appears to require a paid subscription or login.')
    }
    if (res.status === 403 || res.status === 429) {
      return errorResponse(422, 'blocked', 'The website blocked automated access to this article.')
    }
    if (res.status === 404) {
      return errorResponse(422, 'not_found', 'The article could not be found at that URL.')
    }
    if (!res.ok) {
      return errorResponse(
        422,
        'extraction_failed',
        `The website returned an unexpected status (${res.status}). Try pasting the article text manually.`,
      )
    }

    html = await res.text()
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return errorResponse(422, 'timeout', 'The request to the article timed out. Try pasting the article text manually.')
    }
    return errorResponse(
      422,
      'extraction_failed',
      `Could not reach that URL: ${err instanceof Error ? err.message : String(err)}`,
    )
  } finally {
    clearTimeout(timeout)
  }

  if (!html || html.length < 200) {
    return errorResponse(
      422,
      'extraction_failed',
      'The page returned little or no content. It may require JavaScript — try pasting the article text manually.',
    )
  }

  let document: Document
  try {
    // linkedom (not jsdom): jsdom reads a stylesheet file relative to its own
    // module path at runtime, which breaks once esbuild bundles it for a
    // Netlify Function. linkedom has no such filesystem dependency and is
    // the standard lightweight DOM used with Readability in serverless envs.
    document = parseHTML(html).document as unknown as Document
  } catch (err) {
    return errorResponse(422, 'extraction_failed', `Could not parse the page HTML: ${err instanceof Error ? err.message : String(err)}`)
  }

  const ogTitle = metaContent(document, ['meta[property="og:title"]', 'meta[name="twitter:title"]'])
  const ogSiteName = metaContent(document, ['meta[property="og:site_name"]'])
  const ogImage = metaContent(document, ['meta[property="og:image"]', 'meta[name="twitter:image"]'])
  const ogDescription = metaContent(document, ['meta[property="og:description"]', 'meta[name="description"]'])
  const publishedTime = metaContent(document, [
    'meta[property="article:published_time"]',
    'meta[name="date"]',
    'meta[itemprop="datePublished"]',
  ])
  const author = metaContent(document, ['meta[name="author"]', 'meta[property="article:author"]'])

  let articleTitle: string | null = ogTitle
  let articleText: string | null = null
  let excerpt: string | null = ogDescription

  try {
    // Readability mutates the DOM, so pass a document we don't need afterwards.
    const reader = new Readability(document)
    const parsed = reader.parse()
    if (parsed) {
      articleTitle = articleTitle || parsed.title || null
      articleText = parsed.textContent?.trim() || null
      excerpt = excerpt || parsed.excerpt || null
    }
  } catch {
    // fall through — we'll report extraction_failed below if we truly got nothing
  }

  if (!articleText || articleText.length < 200) {
    return errorResponse(
      422,
      'extraction_failed',
      'Could not extract the main article text automatically (the site may use paywalls, cookie walls, or JavaScript rendering). Please paste the article text manually.',
    )
  }

  return jsonResponse(200, {
    source_url: url.toString(),
    source_title: articleTitle,
    source_publication: ogSiteName ?? url.hostname.replace(/^www\./, ''),
    source_author: author,
    source_date: publishedTime ? publishedTime.slice(0, 10) : null,
    source_image_url: ogImage,
    source_description: excerpt,
    source_text: clampText(articleText),
    http_status: finalStatus,
    truncated: articleText.length > 40_000,
  })
}
