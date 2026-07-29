import { Link } from 'react-router-dom'
import { PublicLayout } from '@/components/layout/PublicLayout'

export function NotFoundPage() {
  return (
    <PublicLayout>
      <div className="container container--narrow page">
        <h1 style={{ fontSize: 28 }}>Seite nicht gefunden</h1>
        <Link to="/learn">Zur Artikelübersicht</Link>
      </div>
    </PublicLayout>
  )
}
