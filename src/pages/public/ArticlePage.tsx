import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { PublicNav } from '@/components/layout/PublicNav'
import { fetchPublishedArticleBySlug, recordExport } from '@/lib/api'
import { buildMarkdownExport, downloadDocxExport, downloadTextFile } from '@/lib/exportDocument'
import type { FullArticle, LanguageLevel, QuizQuestion } from '@/lib/types'

const LEVEL_LABEL: Record<LanguageLevel, string> = {
  A2: 'Elementary',
  B1: 'Intermediate',
  B2: 'Upper-Intermediate',
}

const DIFFICULTY_ORDER: Record<string, number> = { easy: 0, medium: 1, hard: 2 }

function sortByDifficulty(questions: QuizQuestion[]): QuizQuestion[] {
  return [...questions].sort((a, b) => DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty])
}

/** A single interactive multiple-choice question: click an option, get instant feedback. */
function QuizQuestionCard({ q, index }: { q: QuizQuestion; index: number }) {
  const [selected, setSelected] = useState<number | null>(null)
  const isCorrect = selected !== null && selected === q.correct_index

  return (
    <div className="card quiz-question">
      <div className="row" style={{ marginBottom: 8, justifyContent: 'space-between' }}>
        <strong>
          {index + 1}. {q.question}
        </strong>
        <span className={`badge quiz-difficulty quiz-difficulty--${q.difficulty}`}>{q.difficulty}</span>
      </div>
      <div className="quiz-options">
        {q.options.map((option, i) => {
          const isSelected = selected === i
          const showCorrect = selected !== null && i === q.correct_index
          const showIncorrect = isSelected && i !== q.correct_index
          const cls = [
            'quiz-option',
            showCorrect ? 'quiz-option--correct' : '',
            showIncorrect ? 'quiz-option--incorrect' : '',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <button
              key={i}
              type="button"
              className={cls}
              disabled={isCorrect}
              onClick={() => setSelected(i)}
            >
              {option}
            </button>
          )
        })}
      </div>
      {selected !== null && (
        <div className={`quiz-feedback ${isCorrect ? 'quiz-feedback--correct' : 'quiz-feedback--incorrect'}`}>
          {isCorrect ? '✓ Correct!' : 'Not quite — try another option.'}
          {isCorrect && q.explanation && <div style={{ marginTop: 4, fontWeight: 400 }}>{q.explanation}</div>}
        </div>
      )}
    </div>
  )
}

export function ArticlePage() {
  const { slug } = useParams<{ slug: string }>()
  const [data, setData] = useState<FullArticle | null | undefined>(undefined) // undefined = loading, null = not found
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState<'docx' | 'markdown' | null>(null)

  useEffect(() => {
    if (!slug) return
    fetchPublishedArticleBySlug(slug)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [slug])

  useEffect(() => {
    if (!data) return
    document.title = `${data.article.german_title ?? 'German Learning Article'} · German News Learning`
    let meta = document.querySelector('meta[name="robots"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'robots')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', data.article.allow_indexing ? 'index,follow' : 'noindex,nofollow')
  }, [data])

  async function handleExport(format: 'docx' | 'markdown') {
    if (!data || !data.content) return
    setExporting(format)
    try {
      if (format === 'docx') {
        await downloadDocxExport({ article: data.article, content: data.content, vocabulary: data.vocabulary })
      } else {
        const md = buildMarkdownExport({ article: data.article, content: data.content, vocabulary: data.vocabulary })
        downloadTextFile(`${data.article.slug ?? 'german-lesson'}.md`, md)
      }
      await recordExport(data.article.id, format)
    } finally {
      setExporting(null)
    }
  }

  if (error) {
    return (
      <div className="container container--narrow page">
        <div className="alert alert--error">{error}</div>
      </div>
    )
  }

  if (data === undefined) {
    return (
      <div className="container container--narrow page">
        <p>Loading…</p>
      </div>
    )
  }

  if (data === null) {
    return (
      <div className="container container--narrow page">
        <h1 style={{ fontSize: 28 }}>Article not found</h1>
        <p>This article doesn't exist, or hasn't been published yet.</p>
        <Link to="/">Go home</Link>
      </div>
    )
  }

  const { article, content, vocabulary } = data
  if (!content) {
    return (
      <div className="container container--narrow page">
        <div className="alert alert--error">This article has no content yet.</div>
      </div>
    )
  }

  return (
    <>
      <PublicNav />
      <main className="container container--narrow page">
        <div className="breadcrumb print-hide">
          <Link to="/">German News Learning</Link> / Articles
        </div>

        <div className="article-header">
          <div className="article-header-main">
            <div className="row" style={{ marginBottom: 10 }}>
              <span className={`level-badge level-badge--${article.language_level}`}>
                {article.language_level} · {LEVEL_LABEL[article.language_level]}
              </span>
              {article.vocabulary_focus && <span className="badge">{article.vocabulary_focus}</span>}
            </div>
            <h1 style={{ fontSize: 32, margin: 0 }}>{article.german_title}</h1>
          </div>
          {article.source_image_url && (
            <img src={article.source_image_url} alt="" className="article-hero-image print-hide" />
          )}
        </div>

        <div className="card" style={{ marginBottom: 28, fontSize: 14, color: 'var(--text-muted)' }}>
          <div>
            Original article: <a href={article.source_url} target="_blank" rel="noreferrer">{article.source_title ?? article.source_url}</a>
          </div>
          {article.source_publication && <div>Publication: {article.source_publication}</div>}
          {article.source_date && <div>Published: {article.source_date}</div>}
          <div style={{ marginTop: 8 }}>
            This is an AI-generated German learning adaptation of the source article above — an original
            summary and re-telling for language learners, not a direct translation. Please review for accuracy.
          </div>
        </div>

        <section className="section-card">
          <div className="section-eyebrow">Step 1</div>
          <h2 className="section-title">Key Vocabulary</h2>
          <div className="banner">Learn these words first, then read the article below.</div>
          <div className="vocab-list">
            {vocabulary.map((v) => (
              <div key={v.id} className="vocab-item">
                <div className="vocab-term-col">
                  <span className="vocab-term">
                    {v.article ? `${v.article} ` : ''}
                    {v.german_term}
                    {v.plural ? ` (Pl. ${v.plural})` : ''}
                  </span>
                  <span className="badge" style={{ marginTop: 6 }}>{v.word_type}</span>
                </div>
                <div className="vocab-content-col">
                  <p className="vocab-meaning">{v.english_meaning}</p>
                  <p className="vocab-explanation">{v.german_explanation}</p>
                  <div className="vocab-example">{v.example_sentence}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="section-card">
          <div className="section-eyebrow">Step 2</div>
          <h2 className="section-title">German Article</h2>
          <div className="banner">Read the article aloud on your own, or read it silently first, then aloud a second time.</div>
          <div className="article-body">
            <p style={{ fontWeight: 600 }}>{content.introduction}</p>
            {content.german_article.split(/\n{2,}/).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </section>

        <section className="section-card">
          <div className="section-eyebrow">Step 3</div>
          <h2 className="section-title">Useful Phrases</h2>
          <div className="banner">These phrases are useful beyond this article — try to reuse them in your own sentences.</div>
          <div className="stack">
            {content.useful_phrases.map((p, i) => (
              <div key={i} className="card">
                <strong>{p.german_phrase}</strong> — {p.english_meaning}
                <div style={{ fontSize: 13, fontStyle: 'italic', marginTop: 4 }}>{p.example_sentence}</div>
              </div>
            ))}
          </div>
        </section>

        {content.grammar_notes.length > 0 && (
          <section className="section-card">
            <div className="section-eyebrow">Step 4</div>
            <h2 className="section-title">Grammar Notes</h2>
            <div className="banner">These grammar points appear in the article above.</div>
            <div className="stack">
              {content.grammar_notes.map((g, i) => (
                <div key={i} className="card">
                  <strong>{g.topic}</strong>
                  <p style={{ marginTop: 4 }}>{g.explanation}</p>
                  <div style={{ fontSize: 13, fontStyle: 'italic' }}>{g.example}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="section-card">
          <div className="section-eyebrow">Step 5</div>
          <h2 className="section-title">Comprehension Questions</h2>
          <div className="banner">Have a discussion, or answer these on your own, based on the article.</div>
          <ol>
            {content.comprehension_questions.map((q, i) => (
              <li key={i} style={{ marginBottom: 8 }}>{q}</li>
            ))}
          </ol>
        </section>

        <section className="section-card">
          <div className="section-eyebrow">Step 6</div>
          <h2 className="section-title">Conversation Questions</h2>
          <div className="banner">Ask only one question at a time — this works well as a ChatGPT conversation prompt list.</div>
          <h3 style={{ fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Opinion</h3>
          <ol>
            {content.conversation_questions.opinion.map((q, i) => (
              <li key={i} style={{ marginBottom: 8 }}>{q}</li>
            ))}
          </ol>
          <h3 style={{ fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginTop: 20 }}>Personal</h3>
          <ol>
            {content.conversation_questions.personal.map((q, i) => (
              <li key={i} style={{ marginBottom: 8 }}>{q}</li>
            ))}
          </ol>
        </section>

        {content.quiz && content.quiz.grammar.length > 0 && (
          <section className="section-card">
            <div className="section-eyebrow">Step 7</div>
            <h2 className="section-title">Grammar Check</h2>
            <div className="banner">Pick the grammatically correct option. Questions get harder as you go.</div>
            <div className="stack">
              {sortByDifficulty(content.quiz.grammar).map((q, i) => (
                <QuizQuestionCard key={i} q={q} index={i} />
              ))}
            </div>
          </section>
        )}

        {content.quiz && content.quiz.comprehension.length > 0 && (
          <section className="section-card">
            <div className="section-eyebrow">Step 8</div>
            <h2 className="section-title">Understanding Check</h2>
            <div className="banner">Test how well you understood the article — easy questions first, harder ones last.</div>
            <div className="stack">
              {sortByDifficulty(content.quiz.comprehension).map((q, i) => (
                <QuizQuestionCard key={i} q={q} index={i} />
              ))}
            </div>
          </section>
        )}

        <section className="print-hide" style={{ marginTop: 12, paddingTop: 8 }}>
          <div className="section-card" style={{ background: 'var(--bg-subtle)' }}>
            <h2 className="section-title" style={{ marginBottom: 6 }}>Take this to ChatGPT</h2>
            <p className="hint" style={{ marginBottom: 16 }}>
              Download this lesson as a document, then upload it to ChatGPT to practice a guided German conversation.
            </p>
            <div className="row">
              <button onClick={() => void handleExport('docx')} disabled={exporting !== null}>
                {exporting === 'docx' ? 'Exporting…' : 'Download DOCX'}
              </button>
              <button className="btn btn--secondary" onClick={() => void handleExport('markdown')} disabled={exporting !== null}>
                {exporting === 'markdown' ? 'Exporting…' : 'Download Markdown'}
              </button>
            </div>
          </div>
        </section>

        <footer style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)' }}>
          Source: this lesson is based on{' '}
          <a href={article.source_url} target="_blank" rel="noreferrer">{article.source_title ?? 'the original article'}</a>
          {article.source_publication ? ` (${article.source_publication})` : ''}.
        </footer>
      </main>
    </>
  )
}
