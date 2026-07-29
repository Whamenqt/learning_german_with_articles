import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="public-nav print-hide">
        <div className="container public-nav__inner">
          <Link to="/" className="brand">
            <span className="brand__mark">DE</span>
            <span>
              <strong>Klug auf Deutsch</strong>
              <small>Learn German. Learn something else.</small>
            </span>
          </Link>
          <nav aria-label="Main navigation">
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/learn">Learn</NavLink>
            <Link to="/login" className="nav-admin">Admin</Link>
          </nav>
        </div>
      </header>
      {children}
    </>
  )
}
