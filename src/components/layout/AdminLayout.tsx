import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'

const SITE_URL = (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined) ?? ''

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const siteHome = (SITE_URL || window.location.origin).replace(/\/$/, '') + '/'

  return (
    <>
      <nav className="top-nav print-hide">
        <div className="container">
          <Link to="/admin">German News Learning — Admin</Link>
          <div className="row">
            {user && <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{user.email}</span>}
            <a href={siteHome} target="_blank" rel="noreferrer" className="btn btn--secondary btn--small">
              View site ↗
            </a>
            <Link to="/admin/articles/new" className="btn btn--small">
              + Create Article
            </Link>
            {user && (
              <button className="btn btn--secondary btn--small" onClick={() => void signOut()}>
                Log out
              </button>
            )}
          </div>
        </div>
      </nav>
      <main className="container page">{children}</main>
    </>
  )
}
