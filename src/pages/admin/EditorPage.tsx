import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { StatusBadge } from '@/components/StatusBadge'
import {
  fetchArticleFull,
  isSlugAvailable,
  publishArticle,
  recordExport,
  saveQuiz,
  unpublishArticle,
  updateArticleContent,
  updateArticleFields,
  replaceVocabulary,
} from '@/lib/api'
import { slugify } from '@/lib/slug'
import { validateQuizJson } from '@/lib/lessonSchema'
import { downloadDocxExport, buildMarkdownExport, downloadTextFile } from '@/lib/exportDocument'
import type {
  ArticleContentRow,
  ArticleRow,
  DifficultConcept,
  GrammarNote,
  LanguageLevel,
  Quiz,
  UsefulPhrase,
  VocabularyRow,
} from '@/lib/types'

const emptyContent: ArticleContentRow = {
  id: '',
  article_id: '',
  introduction: '',
  german_article: '',
  english_summary: '',
  grammar_notes: [],
  useful_phrases: [],
  comprehension_questions: [],
  conversation_questions: { opinion: [], personal: [] },
  difficult_concepts: [],
  chatgpt_instructions: '',
  quiz: null,
  generation_model: null,
  generation_prompt_version: null,
  created_at: '',
}

const DIFFICULTY_ORDER: Record<string, number> = { easy: 0, medium: 1, hard: 2 }

function linesToArray(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

export function EditorPage() {
  const { id } = useParams<{ id: string }>()

  const [article, setArticle] = useState<ArticleRow | null>(null)
  const [content, setContent] = useState<ArticleContentRow>(emptyContent)
  const [vocabulary, setVocabulary] = useState<VocabularyRow[]>([])

  const [comprehensionText, setComprehensionText] = useState('')
  const [opinionText, setOpinionText] = useState('')
  const [personalText, setPersonalText] = useState('')

  const [slugInput, setSlugInput] = useState('')
  const [allowIndexing, setAllowIndexing] = useState(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [exporting, setExporting] = useState<'docx' | 'markdown' | null>(null)

  const [quizJsonText, setQuizJsonText] = useState('')
  const [quizErrors, setQuizErrors] = useState<string[]>([])
  const [savingQuiz, setSavingQuiz] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const full = await fetchArticleFull(id)
      setArticle(full.article)
      setContent(full.content ?? { ...emptyContent, article_id: id })
      setVocabulary(full.vocabulary)
      setComprehensionText((full.content?.comprehension_questions ?? []).join('\n'))
      setOpinionText((full.content?.conversation_questions.opinion ?? []).join('\n'))
      setPersonalText((full.content?.conversation_questions.personal ?? []).join('\n'))
      setSlugInput(full.article.slug ?? '')
      setAllowIndexing(full.article.allow_indexing)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <AdminLayout>
        <p>Loading…</p>
      </AdminLayout>
    )
  }

  if (error || !article) {
    return (
      <AdminLayout>
        <div className="alert alert--error">{error ?? 'Article not found.'}</div>
      </AdminLayout>
    )
  }

  const updateVocabRow = (index: number, patch: Partial<VocabularyRow>) => {
    setVocabulary((prev) => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)))
  }
  const removeVocabRow = (index: number) => {
    setVocabulary((prev) => prev.filter((_, i) => i !== index))
  }
  const addVocabRow = () => {
    setVocabulary((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        article_id: article.id,
        german_term: '',
        article: '',
        plural: '',
        english_meaning: '',
        german_explanation: '',
        example_sentence: '',
        word_type: 'noun',
        difficulty: article.language_level,
        is_essential: true,
        sort_order: prev.length,
      },
    ])
  }

  const updatePhrase = (index: number, patch: Partial<UsefulPhrase>) => {
    setContent((prev) => ({
      ...prev,
      useful_phrases: prev.useful_phrases.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    }))
  }
  function removePhrase(index: number) {
    setContent((prev) => ({ ...prev, useful_phrases: prev.useful_phrases.filter((_, i) => i !== index) }))
  }
  function addPhrase() {
    setContent((prev) => ({
      ...prev,
      useful_phrases: [...prev.useful_phrases, { german_phrase: '', english_meaning: '', example_sentence: '' }],
    }))
  }

  function updateGrammar(index: number, patch: Partial<GrammarNote>) {
    setContent((prev) => ({
      ...prev,
      grammar_notes: prev.grammar_notes.map((g, i) => (i === index ? { ...g, ...patch } : g)),
    }))
  }
  function removeGrammar(index: number) {
    setContent((prev) => ({ ...prev, grammar_notes: prev.grammar_notes.filter((_, i) => i !== index) }))
  }
  function addGrammar() {
    setContent((prev) => ({
      ...prev,
      grammar_notes: [...prev.grammar_notes, { topic: '', explanation: '', example: '' }],
    }))
  }

  function updateConcept(index: number, patch: Partial<DifficultConcept>) {
    setContent((prev) => ({
      ...prev,
      difficult_concepts: prev.difficult_concepts.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }))
  }
  function removeConcept(index: number) {
    setContent((prev) => ({ ...prev, difficult_concepts: prev.difficult_concepts.filter((_, i) => i !== index) }))
  }
  function addConcept() {
    setContent((prev) => ({
      ...prev,
      difficult_concepts: [...prev.difficult_concepts, { term: '', explanation_en: '' }],
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setNotice(null)
    setError(null)
    try {
      await updateArticleContent(article.id, {
        introduction: content.introduction,
        german_article: content.german_article,
        english_summary: content.english_summary,
        grammar_notes: content.grammar_notes,
        useful_phrases: content.useful_phrases,
        comprehension_questions: linesToArray(comprehensionText),
        conversation_questions: {
          opinion: linesToArray(opinionText),
          personal: linesToArray(personalText),
        },
        difficult_concepts: content.difficult_concepts,
        chatgpt_instructions: content.chatgpt_instructions,
        quiz: content.quiz,
      })
      await replaceVocabulary(article.id, vocabulary)
      const updatedArticle = await updateArticleFields(article.id, {
        german_title: article.german_title,
        language_level: article.language_level,
      })
      setArticle(updatedArticle)
      setNotice('Saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveQuiz = async () => {
    setSavingQuiz(true)
    setQuizErrors([])
    setNotice(null)
    setError(null)
    const result = validateQuizJson(quizJsonText)
    if (!result.success || !result.data) {
      setQuizErrors(result.errors)
      setSavingQuiz(false)
      return
    }
    try {
      const quiz: Quiz = result.data
      await saveQuiz(article.id, quiz)
      setContent((prev) => ({ ...prev, quiz }))
      setQuizJsonText('')
      setNotice('Quiz saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSavingQuiz(false)
    }
  }

  const handlePublish = async () => {
    setPublishing(true)
    setError(null)
    try {
      const candidate = slugify(slugInput || article.german_title || 'article')
      const available = await isSlugAvailable(candidate, article.id)
      if (!available) {
        setError(`The slug "${candidate}" is already taken. Choose a different one.`)
        setPublishing(false)
        return
      }
      const updated = await publishArticle(article.id, candidate, allowIndexing)
      setArticle(updated)
      setSlugInput(updated.slug ?? candidate)
      setNotice('Published.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPublishing(false)
    }
  }

  const handleUnpublish = async () => {
    setPublishing(true)
    try {
      const updated = await unpublishArticle(article.id)
      setArticle(updated)
      setNotice('Unpublished — the article is no longer public.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPublishing(false)
    }
  }

  const handleExport = async (format: 'docx' | 'markdown') => {
    setExporting(format)
    setError(null)
    try {
      const payloadContent: ArticleContentRow = {
        ...content,
        comprehension_questions: linesToArray(comprehensionText),
        conversation_questions: { opinion: linesToArray(opinionText), personal: linesToArray(personalText) },
      }
      if (format === 'docx') {
        await downloadDocxExport({ article, content: payloadContent, vocabulary })
      } else {
        const md = buildMarkdownExport({ article, content: payloadContent, vocabulary })
        downloadTextFile(`${article.slug ?? 'german-lesson'}.md`, md)
      }
      await recordExport(article.id, format)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setExporting(null)
    }
  }

  return (
    <AdminLayout>
      <div className="row row--between">
        <div>
          <div className="row" style={{ marginBottom: 6 }}>
            <StatusBadge status={article.status} />
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              Source: <a href={article.source_url} target="_blank" rel="noreferrer">{article.source_publication ?? article.source_url}</a>
            </span>
          </div>
          <h1 style={{ fontSize: 24, margin: 0 }}>Edit Article</h1>
        </div>
        <div className="row">
          <Link to={`/admin/articles/${article.id}/generate`} className="btn btn--secondary btn--small">
            Re-run generation
          </Link>
          <Link to="/admin" className="btn btn--secondary btn--small">
            ← Dashboard
          </Link>
        </div>
      </div>

      {notice && <div className="alert alert--info" style={{ marginTop: 12 }}>{notice}</div>}
      {error && <div className="alert alert--error" style={{ marginTop: 12 }}>{error}</div>}

      {/* Headline, level, source attribution */}
      <div className="card stack" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 18 }}>Headline & level</h2>
        <div className="field">
          <label>German headline</label>
          <input
            value={article.german_title ?? ''}
            onChange={(e) => setArticle({ ...article, german_title: e.target.value })}
          />
        </div>
        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label>Difficulty level</label>
            <select
              value={article.language_level}
              onChange={(e) => setArticle({ ...article, language_level: e.target.value as LanguageLevel })}
            >
              <option value="A2">A2</option>
              <option value="B1">B1</option>
              <option value="B2">B2</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>Introduction</label>
          <textarea rows={2} value={content.introduction} onChange={(e) => setContent({ ...content, introduction: e.target.value })} />
        </div>
      </div>

      {/* Article body */}
      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 18 }}>German learning article</h2>
        <div className="field">
          <label>Paragraphs (separate paragraphs with a blank line)</label>
          <textarea
            rows={14}
            value={content.german_article}
            onChange={(e) => setContent({ ...content, german_article: e.target.value })}
          />
        </div>
        <div className="field">
          <label>English summary</label>
          <textarea rows={3} value={content.english_summary} onChange={(e) => setContent({ ...content, english_summary: e.target.value })} />
        </div>
      </div>

      {/* Vocabulary */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="row row--between">
          <h2 style={{ fontSize: 18, margin: 0 }}>Key vocabulary</h2>
          <button className="btn btn--secondary btn--small" onClick={addVocabRow}>
            + Add word
          </button>
        </div>
        <div className="stack" style={{ marginTop: 12 }}>
          {vocabulary.map((v, i) => (
            <div key={v.id} className="card" style={{ background: 'var(--bg-subtle)' }}>
              <div className="row">
                <input
                  style={{ width: 70 }}
                  placeholder="der/die/das"
                  value={v.article ?? ''}
                  onChange={(e) => updateVocabRow(i, { article: e.target.value })}
                />
                <input
                  style={{ flex: 2 }}
                  placeholder="German term"
                  value={v.german_term}
                  onChange={(e) => updateVocabRow(i, { german_term: e.target.value })}
                />
                <input
                  style={{ flex: 1 }}
                  placeholder="Plural"
                  value={v.plural ?? ''}
                  onChange={(e) => updateVocabRow(i, { plural: e.target.value })}
                />
                <input
                  style={{ flex: 2 }}
                  placeholder="English meaning"
                  value={v.english_meaning}
                  onChange={(e) => updateVocabRow(i, { english_meaning: e.target.value })}
                />
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <input
                  style={{ flex: 2 }}
                  placeholder="German explanation"
                  value={v.german_explanation}
                  onChange={(e) => updateVocabRow(i, { german_explanation: e.target.value })}
                />
                <input
                  style={{ flex: 2 }}
                  placeholder="Example sentence"
                  value={v.example_sentence}
                  onChange={(e) => updateVocabRow(i, { example_sentence: e.target.value })}
                />
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <select value={v.word_type} onChange={(e) => updateVocabRow(i, { word_type: e.target.value })}>
                  {['noun', 'verb', 'adjective', 'adverb', 'connector', 'phrase', 'other'].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <select value={v.difficulty} onChange={(e) => updateVocabRow(i, { difficulty: e.target.value as LanguageLevel })}>
                  <option value="A2">A2</option>
                  <option value="B1">B1</option>
                  <option value="B2">B2</option>
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
                  <input
                    type="checkbox"
                    style={{ width: 'auto' }}
                    checked={v.is_essential}
                    onChange={(e) => updateVocabRow(i, { is_essential: e.target.checked })}
                  />
                  Essential
                </label>
                <button className="btn btn--danger btn--small" onClick={() => removeVocabRow(i)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Useful phrases */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="row row--between">
          <h2 style={{ fontSize: 18, margin: 0 }}>Useful phrases</h2>
          <button className="btn btn--secondary btn--small" onClick={addPhrase}>
            + Add phrase
          </button>
        </div>
        <div className="stack" style={{ marginTop: 12 }}>
          {content.useful_phrases.map((p, i) => (
            <div key={i} className="row">
              <input style={{ flex: 2 }} placeholder="German phrase" value={p.german_phrase} onChange={(e) => updatePhrase(i, { german_phrase: e.target.value })} />
              <input style={{ flex: 2 }} placeholder="English meaning" value={p.english_meaning} onChange={(e) => updatePhrase(i, { english_meaning: e.target.value })} />
              <input style={{ flex: 2 }} placeholder="Example" value={p.example_sentence} onChange={(e) => updatePhrase(i, { example_sentence: e.target.value })} />
              <button className="btn btn--danger btn--small" onClick={() => removePhrase(i)}>×</button>
            </div>
          ))}
        </div>
      </div>

      {/* Grammar notes */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="row row--between">
          <h2 style={{ fontSize: 18, margin: 0 }}>Grammar notes</h2>
          <button className="btn btn--secondary btn--small" onClick={addGrammar}>
            + Add note
          </button>
        </div>
        <div className="stack" style={{ marginTop: 12 }}>
          {content.grammar_notes.map((g, i) => (
            <div key={i} className="row">
              <input style={{ flex: 1 }} placeholder="Topic" value={g.topic} onChange={(e) => updateGrammar(i, { topic: e.target.value })} />
              <input style={{ flex: 2 }} placeholder="Explanation" value={g.explanation} onChange={(e) => updateGrammar(i, { explanation: e.target.value })} />
              <input style={{ flex: 2 }} placeholder="Example" value={g.example} onChange={(e) => updateGrammar(i, { example: e.target.value })} />
              <button className="btn btn--danger btn--small" onClick={() => removeGrammar(i)}>×</button>
            </div>
          ))}
        </div>
      </div>

      {/* Difficult concepts */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="row row--between">
          <h2 style={{ fontSize: 18, margin: 0 }}>Difficult concepts (English)</h2>
          <button className="btn btn--secondary btn--small" onClick={addConcept}>
            + Add
          </button>
        </div>
        <div className="stack" style={{ marginTop: 12 }}>
          {content.difficult_concepts.map((c, i) => (
            <div key={i} className="row">
              <input style={{ flex: 1 }} placeholder="Term" value={c.term} onChange={(e) => updateConcept(i, { term: e.target.value })} />
              <input style={{ flex: 3 }} placeholder="English explanation" value={c.explanation_en} onChange={(e) => updateConcept(i, { explanation_en: e.target.value })} />
              <button className="btn btn--danger btn--small" onClick={() => removeConcept(i)}>×</button>
            </div>
          ))}
        </div>
      </div>

      {/* Questions */}
      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 18 }}>Questions</h2>
        <div className="field">
          <label>Comprehension questions (one per line)</label>
          <textarea rows={4} value={comprehensionText} onChange={(e) => setComprehensionText(e.target.value)} />
        </div>
        <div className="field">
          <label>Opinion questions (one per line)</label>
          <textarea rows={3} value={opinionText} onChange={(e) => setOpinionText(e.target.value)} />
        </div>
        <div className="field">
          <label>Personal conversation questions (one per line)</label>
          <textarea rows={3} value={personalText} onChange={(e) => setPersonalText(e.target.value)} />
        </div>
      </div>

      {/* ChatGPT instructions */}
      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 18 }}>ChatGPT conversation instructions</h2>
        <textarea rows={4} value={content.chatgpt_instructions} onChange={(e) => setContent({ ...content, chatgpt_instructions: e.target.value })} />
      </div>

      {/* Quiz */}
      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 18 }}>Quiz (grammar & understanding)</h2>
        <p className="hint" style={{ marginBottom: 12 }}>
          Two multiple-choice segments shown on the public page: correct-grammar selection, and pure
          comprehension. Questions run easy → hard and reveal correct/incorrect feedback when clicked.
        </p>

        {content.quiz ? (
          <div className="stack" style={{ marginBottom: 16 }}>
            {(['grammar', 'comprehension'] as const).map((segment) => (
              <div key={segment}>
                <div style={{ fontWeight: 600, fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
                  {segment} ({content.quiz![segment].length} questions)
                </div>
                <ol style={{ margin: 0, paddingLeft: 20 }}>
                  {[...content.quiz![segment]]
                    .sort((a, b) => DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty])
                    .map((q, i) => (
                      <li key={i} style={{ marginBottom: 4, fontSize: 14 }}>
                        <span className="badge" style={{ marginRight: 6 }}>{q.difficulty}</span>
                        {q.question} <em style={{ color: 'var(--text-muted)' }}>— correct: {q.options[q.correct_index]}</em>
                      </li>
                    ))}
                </ol>
              </div>
            ))}
          </div>
        ) : (
          <div className="alert alert--warn" style={{ marginBottom: 16 }}>No quiz saved yet for this article.</div>
        )}

        <div className="field">
          <label>Paste quiz JSON (replaces the saved quiz)</label>
          <textarea
            rows={6}
            placeholder='{ "grammar": [...], "comprehension": [...] }'
            value={quizJsonText}
            onChange={(e) => setQuizJsonText(e.target.value)}
          />
        </div>
        {quizErrors.length > 0 && (
          <div className="alert alert--error" style={{ marginBottom: 12 }}>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {quizErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        <button className="btn btn--secondary" onClick={() => void handleSaveQuiz()} disabled={savingQuiz || !quizJsonText.trim()}>
          {savingQuiz ? 'Validating…' : 'Validate & save quiz'}
        </button>
      </div>

      <div className="row" style={{ marginTop: 16, marginBottom: 32 }}>
        <button onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button className="btn btn--secondary" onClick={() => void handleExport('docx')} disabled={exporting !== null}>
          {exporting === 'docx' ? 'Exporting…' : 'Export DOCX'}
        </button>
        <button className="btn btn--secondary" onClick={() => void handleExport('markdown')} disabled={exporting !== null}>
          {exporting === 'markdown' ? 'Exporting…' : 'Export Markdown'}
        </button>
      </div>

      {/* Publish */}
      <div className="card stack" style={{ marginBottom: 40, borderColor: 'var(--accent)' }}>
        <h2 style={{ fontSize: 18 }}>Publish</h2>
        <div className="field">
          <label>URL slug</label>
          <input value={slugInput} onChange={(e) => setSlugInput(slugify(e.target.value))} />
          <span className="hint">Public URL: /articles/{slugInput || '…'}</span>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={allowIndexing} onChange={(e) => setAllowIndexing(e.target.checked)} />
          Allow search engines to index this page
        </label>
        <div className="row">
          {article.status === 'published' ? (
            <button className="btn btn--secondary" onClick={() => void handleUnpublish()} disabled={publishing}>
              {publishing ? 'Working…' : 'Unpublish'}
            </button>
          ) : (
            <button onClick={() => void handlePublish()} disabled={publishing}>
              {publishing ? 'Publishing…' : 'Publish'}
            </button>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
