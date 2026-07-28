import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { useAuth } from '@/lib/AuthContext'
import { createArticleDraft, logGeneration, setArticleStatus, updateArticleFields } from '@/lib/api'
import type { ArticleLength, LanguageLevel } from '@/lib/types'

interface ExtractResult {
  source_title: string | null
  source_publication: string | null
  source_author: string | null
  source_date: string | null
  source_image_url: string | null
  source_description: string | null
  source_text: string
}

export function NewArticlePage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [sourceUrl, setSourceUrl] = useState('')
  const [languageLevel, setLanguageLevel] = useState<LanguageLevel>('B1')
  const [articleLength, setArticleLength] = useState<ArticleLength>('standard')
  const [customTitle, setCustomTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [vocabFocus, setVocabFocus] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setSubmitting(true)
    setError(null)

    try {
      const article = await createArticleDraft({
        userId: user.id,
        sourceUrl: sourceUrl.trim(),
        languageLevel,
        articleLength,
        customInstructions: instructions.trim() || undefined,
        vocabularyFocus: vocabFocus.trim() || undefined,
        customTitle: customTitle.trim() || undefined,
      })

      setStatusMessage('Extracting article content…')
      await setArticleStatus(article.id, 'extracting')
      await logGeneration(article.id, 'extraction', 'started')

      try {
        const res = await fetch('/.netlify/functions/extract-article', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: article.source_url }),
        })

        if (!res.ok) {
          const payload = await res.json().catch(() => null)
          const message = payload?.error?.message ?? 'Automatic extraction failed.'
          await setArticleStatus(article.id, 'error', message)
          await logGeneration(article.id, 'extraction', 'error', message)
        } else {
          const data = (await res.json()) as ExtractResult
          await updateArticleFields(article.id, {
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
          await logGeneration(article.id, 'extraction', 'success')
        }
      } catch (extractErr) {
        const message = extractErr instanceof Error ? extractErr.message : String(extractErr)
        await setArticleStatus(article.id, 'error', message)
        await logGeneration(article.id, 'extraction', 'error', message)
      }

      // Always continue to the Generate step — if extraction failed, that page
      // shows the error and lets the admin paste the article text manually.
      navigate(`/admin/articles/${article.id}/generate`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSubmitting(false)
      setStatusMessage(null)
    }
  }

  return (
    <AdminLayout>
      <h1 style={{ fontSize: 24 }}>Create Article</h1>
      <form onSubmit={handleSubmit} className="card stack" style={{ maxWidth: 640 }}>
        {error && <div className="alert alert--error">{error}</div>}

        <div className="field">
          <label htmlFor="sourceUrl">Article URL</label>
          <input
            id="sourceUrl"
            type="url"
            required
            placeholder="https://example.com/news/article"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
          />
          <span className="hint">We'll try to extract the title, text, and metadata automatically.</span>
        </div>

        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="level">German level</label>
            <select id="level" value={languageLevel} onChange={(e) => setLanguageLevel(e.target.value as LanguageLevel)}>
              <option value="A2">A2</option>
              <option value="B1">B1 (default)</option>
              <option value="B2">B2</option>
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="length">Article length</label>
            <select id="length" value={articleLength} onChange={(e) => setArticleLength(e.target.value as ArticleLength)}>
              <option value="short">Short</option>
              <option value="standard">Standard (default)</option>
              <option value="detailed">Detailed</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="customTitle">Custom title (optional)</label>
          <input id="customTitle" type="text" value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="vocabFocus">Target vocabulary topic (optional)</label>
          <input
            id="vocabFocus"
            type="text"
            placeholder="e.g. medical vocabulary"
            value={vocabFocus}
            onChange={(e) => setVocabFocus(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="instructions">AI instructions (optional)</label>
          <textarea
            id="instructions"
            rows={3}
            placeholder="e.g. Keep the article especially short. Explain scientific terminology. Create more speaking questions."
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </div>

        <button type="submit" disabled={submitting}>
          {submitting ? statusMessage ?? 'Creating…' : 'Create draft & extract article'}
        </button>
      </form>
    </AdminLayout>
  )
}
