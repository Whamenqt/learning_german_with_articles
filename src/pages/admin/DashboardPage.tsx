import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { StatusBadge } from '@/components/StatusBadge'
import { archiveArticle, deleteArticle, duplicateArticle, fetchArticles, unpublishArticle } from '@/lib/api'
import type { ArticleRow } from '@/lib/types'

const SITE_URL = (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined) ?? ''

function publicUrl(slug: string) {
  const base = SITE_URL || window.location.origin
  return `${base.replace(/\/$/, '')}/articles/${slug}`
}

export function DashboardPage() {
  const [articles, setArticles] = useState<ArticleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setArticles(await fetchArticles())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function withBusy(id: string, fn: () => Promise<void>) {
    setBusyId(id)
    try {
      await fn()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyId(null)
    }
  }

  function copyUrl(slug: string) {
    void navigator.clipboard.writeText(publicUrl(slug))
  }

  const nextStepFor = (a: ArticleRow) => {
    if (a.status === 'new' || a.status === 'error') return { to: `/admin/articles/${a.id}/generate`, label: 'Generate' }
    if (a.status === 'draft') return { to: `/admin/articles/${a.id}/edit`, label: 'Edit' }
    return { to: `/admin/articles/${a.id}/edit`, label: 'View / edit' }
  }

  return (
    <AdminLayout>
      <div className="row row--between" style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Articles</h1>
        <Link to="/admin/articles/new" className="btn">
          + Create Article
        </Link>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <p>Loading…</p>
      ) : articles.length === 0 ? (
        <div className="card">
          <p>No articles yet. Paste a news article link to create your first German learning adaptation.</p>
          <Link to="/admin/articles/new" className="btn" style={{ marginTop: 12 }}>
            + Create Article
          </Link>
        </div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Source</th>
                <th>Level</th>
                <th>Status</th>
                <th>Created</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => {
                const step = nextStepFor(a)
                const busy = busyId === a.id
                return (
                  <tr key={a.id}>
                    <td>
                      <Link to={step.to}>{a.german_title || a.source_title || '(untitled)'}</Link>
                      {a.status === 'error' && a.error_message && (
                        <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>{a.error_message}</div>
                      )}
                    </td>
                    <td>
                      <a href={a.source_url} target="_blank" rel="noreferrer">
                        {a.source_publication || new URL(a.source_url).hostname}
                      </a>
                    </td>
                    <td>{a.language_level}</td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                    <td>{new Date(a.created_at).toLocaleDateString()}</td>
                    <td>{new Date(a.updated_at).toLocaleDateString()}</td>
                    <td>
                      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                        <Link to={step.to} className="btn btn--secondary btn--small">
                          {step.label}
                        </Link>
                        {a.status === 'published' && a.slug && (
                          <>
                            <button className="btn btn--secondary btn--small" onClick={() => copyUrl(a.slug!)}>
                              Copy URL
                            </button>
                            <button
                              className="btn btn--secondary btn--small"
                              disabled={busy}
                              onClick={() => withBusy(a.id, () => unpublishArticle(a.id).then(() => undefined))}
                            >
                              Unpublish
                            </button>
                          </>
                        )}
                        <button
                          className="btn btn--secondary btn--small"
                          disabled={busy}
                          onClick={() => withBusy(a.id, () => duplicateArticle(a).then(() => undefined))}
                        >
                          Duplicate
                        </button>
                        {a.status !== 'archived' && (
                          <button
                            className="btn btn--secondary btn--small"
                            disabled={busy}
                            onClick={() => withBusy(a.id, () => archiveArticle(a.id).then(() => undefined))}
                          >
                            Archive
                          </button>
                        )}
                        <button
                          className="btn btn--danger btn--small"
                          disabled={busy}
                          onClick={() => {
                            if (confirm('Delete this article permanently? This cannot be undone.')) {
                              void withBusy(a.id, () => deleteArticle(a.id))
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  )
}
