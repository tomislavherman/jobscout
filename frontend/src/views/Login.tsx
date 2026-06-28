import { useState } from 'react'
import type { CurrentUser } from '../types'
import { login } from '../api'
import { useT } from '../i18n'

export default function Login({
  onLogin,
  onSignup,
  modal = false,
}: {
  onLogin: (user: CurrentUser) => void
  onSignup?: () => void
  modal?: boolean
}) {
  const t = useT()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const user = await login(username, password)
      onLogin(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const card = (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 w-full max-w-lg">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">{t('sign_in')}</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">{t('username')}</label>
            <input
              type="text"
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">{t('password')}</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full py-2 px-4 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {loading ? t('signing_in') : t('sign_in')}
          </button>
        </form>
        {onSignup && (
          <p className="mt-4 text-center text-sm text-gray-500">
            {t('no_account')}{' '}
            <button onClick={onSignup} className="text-gray-900 font-medium hover:underline">
              {t('sign_up')}
            </button>
          </p>
        )}
      </div>
  )

  if (modal) return card
  return <div className="min-h-screen bg-gray-50 flex items-center justify-center">{card}</div>
}
