import { NavLink, Outlet } from 'react-router-dom'
import type { CurrentUser } from '../types'
import { useT } from '../i18n'
import LanguageToggle from './LanguageToggle'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block px-3 py-2 rounded text-sm transition-colors ${
    isActive ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'
  }`

const bottomLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex-1 py-3 text-center text-xs font-medium transition-colors ${
    isActive ? 'text-white' : 'text-gray-400 hover:text-gray-200'
  }`

export default function Layout({ user, onLogout }: { user: CurrentUser; onLogout: () => void }) {
  const t = useT()

  const navItems = [
    { to: '/new', label: t('nav_new') },
    { to: '/all', label: t('nav_all') },
    { to: '/sources', label: t('nav_sources') },
    { to: '/stats', label: t('nav_stats') },
    { to: '/about', label: t('nav_about') },
  ]

  return (
    <div className="flex h-dvh">
      {/* Sidebar — desktop only */}
      <nav className="hidden lg:flex w-56 bg-gray-900 text-white flex-col p-4 shrink-0">
        <h1 className="text-xl font-bold mb-6 px-2">JobScout</h1>
        <ul className="space-y-1 flex-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.to === '/'} className={navLinkClass}>
                {item.label}
              </NavLink>
            </li>
          ))}
          {user.role === 'admin' && (
            <li>
              <NavLink to="/admin" className={navLinkClass}>{t('nav_admin')}</NavLink>
            </li>
          )}
        </ul>
        <div className="mt-4 border-t border-gray-700 pt-4 px-3">
          <NavLink to="/profile" className={navLinkClass}>
            {t('nav_account')}
          </NavLink>
          <button
            onClick={onLogout}
            className="block w-full text-left px-3 py-2 rounded text-sm text-gray-300 hover:bg-gray-800 transition-colors"
          >
            {t('nav_sign_out')}
          </button>
          <div className="mt-3 px-3">
            <LanguageToggle />
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto overscroll-y-none p-4 lg:p-6 pb-20 lg:pb-6">
        <Outlet />
      </main>

      {/* Bottom nav — mobile only */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 z-40 flex items-center">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} className={bottomLinkClass}>
            {item.label}
          </NavLink>
        ))}
        {user.role === 'admin' && (
          <NavLink to="/admin" className={bottomLinkClass}>{t('nav_admin')}</NavLink>
        )}
        <NavLink to="/profile" className={bottomLinkClass}>
          {t('nav_account')}
        </NavLink>
        <LanguageToggle className="px-2" />
      </nav>
    </div>
  )
}
