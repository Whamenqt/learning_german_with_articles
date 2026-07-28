import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()

  return (
    <>
      <nav className="top-nav print-hide">
        <div className="container">
          <Link to="/admin">German News Learning — Admin</Link>
          <div className="row">
            {user && <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{user.email}</span>}
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
