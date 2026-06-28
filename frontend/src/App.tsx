import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Layout from './components/Layout'
import NewJobs from './views/NewJobs'
import AllJobs from './views/AllJobs'
import JobDetail from './views/JobDetail'
import Stats from './views/Stats'
import Sources from './views/Sources'
import Admin from './views/Admin'
import Profile from './views/Profile'
import About from './views/About'
import PublicLanding from './views/PublicLanding'
import type { CurrentUser } from './types'
import { restoreSession, clearTokens } from './api'

export default function App() {
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined) // undefined = loading
  const navigate = useNavigate()

  useEffect(() => {
    restoreSession().then((u) => setUser(u ?? null))
  }, [])

  useEffect(() => {
    const handler = () => { clearTokens(); setUser(null); navigate('/', { replace: true }) }
    window.addEventListener('auth:logout', handler)
    return () => window.removeEventListener('auth:logout', handler)
  }, [])

  const handleLogin = (u: CurrentUser) => {
    const redirect = sessionStorage.getItem('postLoginRedirect')
    sessionStorage.removeItem('postLoginRedirect')
    if (redirect) navigate(redirect, { replace: true })
    setUser(u)
  }

  if (user === undefined) return null // brief loading before session check

  if (!user) return <PublicLanding onLogin={handleLogin} />

  const handleLogout = () => { clearTokens(); setUser(null); navigate('/', { replace: true }) }

  return (
    <Routes>
      <Route element={<Layout user={user} onLogout={handleLogout} />}>
        <Route index element={<Navigate to="/new" replace />} />
        <Route path="/new" element={<NewJobs />} />
        <Route path="/all" element={<AllJobs />} />
        <Route path="/jobs/:id" element={<JobDetail />} />
        <Route path="/sources" element={<Sources />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/profile" element={<Profile user={user} onUserChange={setUser} onLogout={handleLogout} />} />
        <Route path="/about" element={<About />} />
        {user.role === 'admin' && <Route path="/admin" element={<Admin currentUser={user} />} />}
      </Route>
    </Routes>
  )
}
