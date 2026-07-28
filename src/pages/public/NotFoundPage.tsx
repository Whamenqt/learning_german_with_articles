import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="container container--narrow page">
      <h1 style={{ fontSize: 28 }}>Page not found</h1>
      <Link to="/">Go home</Link>
    </div>
  )
}
