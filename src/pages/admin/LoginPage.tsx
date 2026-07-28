import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'

export function LoginPage() {
  const { user, signInWithPassword } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) {
    const from = (location.state as { from?: Location })?.from
    return <Navigate to={from?.pathname ?? '/admin'} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error: signInError } = await signInWithPassword(email, password)
    setSubmitting(false)
    if (signInError) setError(signInError)
  }

  return (
    <div className="container container--narrow page">
      <h1 style={{ fontSize: 28 }}>German News Learning</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>Admin sign in</p>

      <form onSubmit={handleSubmit} className="card stack">
        {error && <div className="alert alert--error">{error}</div>}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="hint" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          There is no public sign-up. Admin accounts are created manually in the Supabase dashboard
          (Authentication → Users → Add user).
        </p>
      </form>
    </div>
  )
}
