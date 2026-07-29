import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { fetchPublishedArticles } from '@/lib/api'
import { getCompletedArticleIds } from '@/lib/progress'
import type { ArticleRow, LanguageLevel } from '@/lib/types'

type ProgressFilter = 'all' | 'open' | 'complete'

function keywords(article: ArticleRow): string[] {
  return (article.vocabulary_focus ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function LearnPage() {
  const [searchParams] = useSearchParams()
  const [articles, setArticles] = useState<ArticleRow[]>([])
  const [completedIds, setCompletedIds] = useState<string[]>(getCompletedArticleIds)
  const [query, setQuery] = useState(searchParams.get('topic') ?? '')
  const [level, setLevel] = useState<'all' | LanguageLevel>('all')
  const [progress, setProgress] = useState<ProgressFilter>('all')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPublishedArticles().then(setArticles).catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  useEffect(() => {
    const update = () => setCompletedIds(getCompletedArticleIds())
    window.addEventListener('article-progress-change', update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener('article-progress-change', update)
      window.removeEventListener('storage', update)
    }
  }, [])

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('de')
    return articles.filter((article) => {
      const complete = completedIds.includes(article.id)
      const haystack = [
        article.german_title,
        article.source_description,
        article.vocabulary_focus,
      ].filter(Boolean).join(' ').toLocaleLowerCase('de')
      return (
        (level === 'all' || article.language_level === level) &&
        (progress === 'all' || (progress === 'complete' ? complete : !complete)) &&
        (!needle || haystack.includes(needle))
      )
    })
  }, [articles, completedIds, level, progress, query])

  const completedCount = articles.filter((article) => completedIds.includes(article.id)).length

  return (
    <PublicLayout>
      <main className="learn-page">
        <section className="container learn-intro">
          <span className="eyebrow">Your German knowledge library</span>
          <div className="learn-intro__row">
            <div>
              <h1>Was möchtest du heute lernen?</h1>
              <p>Finde einen Text nach Niveau, Thema oder Schlüsselwort.</p>
            </div>
            <div className="progress-summary">
              <strong>{completedCount}</strong>
              <span>von {articles.length} abgeschlossen</span>
            </div>
          </div>
        </section>

        <section className="container">
          <div className="filter-panel">
            <label className="search-field">
              <span className="sr-only">Artikel suchen</span>
              <input
                type="search"
                placeholder="Suche nach Mars, Schlaf, Psychologie…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className="filter-group" aria-label="Level">
              {(['all', 'A2', 'B1', 'B2'] as const).map((value) => (
                <button
                  type="button"
                  className={level === value ? 'filter-chip filter-chip--active' : 'filter-chip'}
                  onClick={() => setLevel(value)}
                  key={value}
                >
                  {value === 'all' ? 'Alle Niveaus' : value}
                </button>
              ))}
            </div>
            <select value={progress} onChange={(event) => setProgress(event.target.value as ProgressFilter)} aria-label="Fortschritt">
              <option value="all">Alle Artikel</option>
              <option value="open">Noch offen</option>
              <option value="complete">Abgeschlossen</option>
            </select>
          </div>

          {error && <div className="alert alert--error">{error}</div>}

          <div className="results-heading">
            <strong>{filtered.length} Artikel</strong>
            {(query || level !== 'all' || progress !== 'all') && (
              <button type="button" className="text-button" onClick={() => { setQuery(''); setLevel('all'); setProgress('all') }}>
                Filter zurücksetzen
              </button>
            )}
          </div>

          <div className="article-grid">
            {filtered.map((article) => {
              const complete = completedIds.includes(article.id)
              const tags = keywords(article)
              return (
                <article className={`article-tile${complete ? ' article-tile--complete' : ''}`} key={article.id}>
                  <div className="article-tile__top">
                    <span className={`level-badge level-badge--${article.language_level}`}>{article.language_level}</span>
                    {complete && <span className="complete-label">✓ Abgeschlossen</span>}
                  </div>
                  <h2><Link to={`/articles/${article.slug}`}>{article.german_title}</Link></h2>
                  <p>{article.source_description ?? 'Ein strukturierter Lesetext mit Wortschatz, Verständnisfragen und Gesprächsimpulsen.'}</p>
                  {tags.length > 0 && (
                    <div className="tag-list">
                      {tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}
                    </div>
                  )}
                  <Link to={`/articles/${article.slug}`} className="article-tile__link">
                    {complete ? 'Noch einmal lesen' : 'Lektion beginnen'} →
                  </Link>
                </article>
              )
            })}
          </div>

          {!error && filtered.length === 0 && (
            <div className="empty-state">
              <h2>Kein Artikel passt zu diesen Filtern.</h2>
              <p>Versuche ein anderes Schlüsselwort oder setze die Filter zurück.</p>
            </div>
          )}
        </section>
      </main>
    </PublicLayout>
  )
}
