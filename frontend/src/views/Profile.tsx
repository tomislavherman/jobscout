import { useState } from 'react'
import type { CurrentUser } from '../types'
import { updateProfile, updatePassword, setSession } from '../api'

export default function Profile({
  user,
  onUserChange,
  onLogout,
}: {
  user: CurrentUser
  onUserChange: (u: CurrentUser) => void
  onLogout: () => void
}) {
  const [username, setUsername] = useState(user.username)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [usernameSuccess, setUsernameSuccess] = useState(false)
  const [savingUsername, setSavingUsername] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setUsernameError(null)
    setUsernameSuccess(false)
    if (username === user.username) return
    setSavingUsername(true)
    try {
      const data = await updateProfile(username)
      setSession(data.access_token, { username: data.username, role: data.role as CurrentUser['role'] }, data.refresh_token)
      onUserChange({ username: data.username, role: data.role as CurrentUser['role'] })
      setUsernameSuccess(true)
    } catch (err) {
      setUsernameError(err instanceof Error ? err.message : 'Failed to update username')
    } finally {
      setSavingUsername(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(false)
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }
    setSavingPassword(true)
    try {
      await updatePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess(true)
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-semibold mb-8">Account Settings</h2>

      {/* Username */}
      <section className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h3 className="font-medium mb-4">Change Username</h3>
        <form onSubmit={handleUsernameSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setUsernameSuccess(false) }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          {usernameError && <p className="text-sm text-red-500">{usernameError}</p>}
          {usernameSuccess && <p className="text-sm text-green-600">Username updated.</p>}
          <button
            type="submit"
            disabled={savingUsername || !username || username === user.username}
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {savingUsername ? 'Saving...' : 'Save'}
          </button>
        </form>
      </section>

      {/* Sign out — visible on mobile where sidebar is hidden */}
      <section className="lg:hidden bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <button
          onClick={onLogout}
          className="w-full py-2 px-4 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
        >
          Sign out
        </button>
      </section>

      {/* Password */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-medium mb-4">Change Password</h3>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setPasswordSuccess(false) }}
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          {passwordError && <p className="text-sm text-red-500">{passwordError}</p>}
          {passwordSuccess && <p className="text-sm text-green-600">Password updated.</p>}
          <button
            type="submit"
            disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {savingPassword ? 'Saving...' : 'Save'}
          </button>
        </form>
      </section>
    </div>
  )
}
