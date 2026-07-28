import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { buildChatgptPrompt } from '@/lib/chatgptPrompt'
import { validateLessonJson } from '@/lib/lessonSchema'
import {
  fetchArticleFull,
  logGeneration,
  saveGeneratedContent,
  setArticleStatus,
  updateArticleFields,
} from '@/lib/api'
import type { ArticleRow } from '@/lib/types'

export function GeneratePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [article, setArticle] = useState<ArticleRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // editable source fields (manual fallback / fixes)
  const [sourceTitle, setSourceTitle] = useState('')
  const [sourcePublication, setSourcePublication] = useState('')
  const [sourceAuthor, setSourceAuthor] = useState('')
  const [sourceDate, setSourceDate] = useState('')
  const [sourceText, setSourceText] = useState('')
  const [savingSource, setSavingSource] = useState(false)
  const [reExtracting, setReExtracting] = useState(false)

  const [copyLabel, setCopyLabel] = useState('Copy prompt')

  const [jsonText, setJsonText] = useState('')
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const { article: a } = await fetchArticleFull(id)
      setArticle(a)
      setSourceTitle(a.source_title ?? '')
      setSourcePublication(a.source_publication ?? '')
      setSourceAuthor(a.source_author ?? '')
      setSourceDate(a.source_date ?? '')
      setSourceText(a.source_text ?? '')
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function saveSourceDetails() {
    if (!article) return
    setSavingSource(true)
    try {
      const updated = await updateArticleFields(article.id, {
        source_title: sourceTitle || null,
        source_publication: sourcePublication || null,
        source_author: sourceAuthor || null,
        source_date: sourceDate || null,
        source_text: sourceText || null,
        status: sourceText.trim() ? 'generating' : article.status,
        error_message: sourceText.trim() ? null : article.error_message,
      })
      setArticle(updated)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    } finally {
      setSavingSource(false)
    }
  }

  async function retryExtraction() {
    if (!article) return
    setReExtracting(true)
    try {
      await setArticleStatus(article.id, 'extracting')
      const res = await fetch('/.netlify/functions/extract-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: article.source_url }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        const message = payload?.error?.message ?? 'Automatic extraction failed.'
        const updated = await setArticleStatus(article.id, 'error', message)
        setArticle(updated)
        await logGeneration(article.id, 'extraction', 'error', message)
      } else {
        const data = await res.json()
        const updated = await updateArticleFields(article.id, {
          source_title: data.source_title,
          source_publication: data.source_publication,
          source_author: data.source_author,
          source_date: data.source_date,
          source_image_url: data.source_image_url,
          source_description: data.source_description,
          source_text: data.source_text,
          status: 'generating',
          error_message: null,
        })
        setArticle(updated)
        setSourceTitle(updated.source_title ?? '')
        setSourcePublication(updated.source_publication ?? '')
        setSourceAuthor(updated.source_author ?? '')
        setSourceDate(updated.source_date ?? '')
        setSourceText(updated.source_text ?? '')
        await logGeneration(article.id, 'extraction', 'success')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const updated = await setArticleStatus(article.id, 'error', message)
      setArticle(updated)
    } finally {
      setReExtracting(false)
    }
  }

  function copyPrompt() {
    if (!article) return
    const prompt = buildChatgptPrompt(article)
    void navigator.clipboard.writeText(prompt).then(() => {
      setCopyLabel('Copied!')
      setTimeout(() => setCopyLabel('Copy prompt'), 1800)
    })
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setJsonText(String(reader.result ?? ''))
    reader.readAsText(file)
  }

  async function handleValidateAndSave() {
    if (!article) return
    setSaving(true)
    setValidationErrors([])
    await logGeneration(article.id, 'ai_generation_import', 'started')

    const result = validateLessonJson(jsonText)
    if (!result.success || !result.data) {
      setValidationErrors(result.errors)
      setSaving(false)
      await logGeneration(article.id, 'ai_generation_import', 'error', result.errors.join('; '))
      return
    }

    try {
      await saveGeneratedContent(article.id, result.data)
      await logGeneration(article.id, 'ai_generation_import', 'success')
      navigate(`/admin/articles/${article.id}/edit`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setValidationErrors([message])
      await setArticleStatus(article.id, 'error', message)
      await logGeneration(article.id, 'ai_generation_import', 'error', message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <p>Loading…</p>
      </AdminLayout>
    )
  }

  if (loadError || !article) {
    return (
      <AdminLayout>
        <div className="alert alert--error">{loadError ?? 'Article not found.'}</div>
      </AdminLayout>
    )
  }

  const prompt = buildChatgptPrompt(article)
  const hasSourceText = sourceText.trim().length > 0

  return (
    <AdminLayout>
      <div className="row row--between">
        <h1 style={{ fontSize: 24 }}>Generate: {article.german_title || article.source_title || article.source_url}</h1>
        <Link to="/admin" className="btn btn--secondary btn--small">
          ← Back to dashboard
        </Link>
      </div>

      {article.status === 'error' && (
        <div className="alert alert--error" style={{ marginTop: 12 }}>
          <strong>Extraction failed:</strong> {article.error_message}. You can retry, or paste the article text
          manually below.
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="row row--between">
          <h2 style={{ fontSize: 18, margin: 0 }}>1. Source article details</h2>
          <button className="btn btn--secondary btn--small" onClick={() => void retryExtraction()} disabled={reExtracting}>
            {reExtracting ? 'Retrying…' : 'Retry automatic extraction'}
          </button>
        </div>
        <p className="hint" style={{ marginBottom: 12 }}>
          Fix or fill these in if automatic extraction failed or missed something (paywall, cookie wall,
          JavaScript-only site, or missing metadata are common causes).
        </p>
        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label>Source title</label>
            <input value={sourceTitle} onChange={(e) => setSourceTitle(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Publication name</label>
            <input value={sourcePublication} onChange={(e) => setSourcePublication(e.target.value)} />
          </div>
        </div>
        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label>Author (optional)</label>
            <input value={sourceAuthor} onChange={(e) => setSourceAuthor(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Publication date (optional)</label>
            <input type="date" value={sourceDate} onChange={(e) => setSourceDate(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Article text</label>
          <textarea rows={10} value={sourceText} onChange={(e) => setSourceText(e.target.value)} />
        </div>
        <button className="btn btn--secondary" onClick={() => void saveSourceDetails()} disabled={savingSource}>
          {savingSource ? 'Saving…' : 'Save source details'}
        </button>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 18 }}>2. Generate with ChatGPT or Claude</h2>
        <p className="hint">
          Copy this prompt into your own ChatGPT or Claude account. It asks for a structured JSON lesson matching
          this app's schema. This app does not call an AI API directly — you bring your own account.
        </p>
        {!hasSourceText && (
          <div className="alert alert--warn" style={{ marginBottom: 12 }}>
            No article text saved yet — the prompt below won't include the source content. Save source details
            first.
          </div>
        )}
        <pre>{prompt}</pre>
        <button onClick={copyPrompt}>{copyLabel}</button>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 18 }}>3. Upload or paste the generated JSON</h2>
        <p className="hint">
          After the AI returns the JSON lesson, upload the .json file or paste it below. It's validated against the
          required schema before saving.
        </p>

        {validationErrors.length > 0 && (
          <div className="alert alert--error" style={{ marginBottom: 12 }}>
            <strong>The JSON didn't validate:</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
              {validationErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="field">
          <label>Upload .json file</label>
          <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={onFileSelected} />
        </div>

        <div className="field">
          <label>Or paste JSON directly</label>
          <textarea rows={12} value={jsonText} onChange={(e) => setJsonText(e.target.value)} placeholder="{ ... }" />
        </div>

        <button onClick={() => void handleValidateAndSave()} disabled={saving || !jsonText.trim()}>
          {saving ? 'Validating & saving…' : 'Validate & save draft'}
        </button>
      </div>
    </AdminLayout>
  )
}
