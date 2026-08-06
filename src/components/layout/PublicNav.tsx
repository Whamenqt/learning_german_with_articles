import { Link, useLocation } from 'react-router-dom'

/** Shared top nav for public (unauthenticated) pages — article pages and the sentence practice tool. */
export function PublicNav() {
  const { pathname } = useLocation()
  const onPractice = pathname.startsWith('/practice')

  return (
    <nav className="top-nav print-hide">
      <div className="container row row--between">
        <Link to="/">German News Learning</Link>
        <Link to="/practice" className={onPractice ? 'btn btn--small' : 'btn btn--secondary btn--small'}>
          Sentence Practice
        </Link>
      </div>
    </nav>
  )
}
