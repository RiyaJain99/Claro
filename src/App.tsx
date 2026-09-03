import { useEffect, useState } from 'react'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import { api } from './api/client'

export default function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    api.getAuthStatus()
      .then((res: { authenticated: boolean }) => setAuthenticated(res.authenticated))
      .catch(() => setAuthenticated(false))
  }, [])

  if (authenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading...</p>
      </div>
    )
  }

  if (authenticated) {
    return <Dashboard />
  }

  return <Landing />
}
