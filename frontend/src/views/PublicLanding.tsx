import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { Job, CurrentUser } from '../types'
import { listPublicJobs } from '../api'
import JobCard from '../components/JobCard'
import Login from './Login'
import Signup from './Signup'
import PublicJobDetail from './PublicJobDetail'
import PullToRefresh from '../components/PullToRefresh'
import { useInfiniteScroll } from '../hooks/useInfiniteScroll'
import About from './About'
import { useT } from '../i18n'
import LanguageToggle from '../components/LanguageToggle'

type View = 'jobs' | 'job' | 'about'
type Modal = 'login' | 'signup' | null

function PublicSidebar({ view, onNav, onSignIn }: { view: View; onNav: (v: View) => void; onSignIn: () => void }) {
  const t = useT()
  const linkClass = (v: View) =>
    `block px-3 py-2 rounded text-sm transition-colors ${view === v ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'}`
  const bottomClass = (v: View) =>
    `flex-1 py-3 text-center text-xs font-medium transition-colors ${view === v ? 'text-white' : 'text-gray-400 hover:text-gray-200'}`

  return (
    <>
      {/* Sidebar — desktop only */}
      <nav className="hidden lg:flex w-56 bg-gray-900 text-white flex-col p-4 shrink-0">
        <h1 className="text-xl font-bold mb-6 px-2">JobScout</h1>
        <ul className="space-y-1 flex-1">
          <li><button onClick={() => onNav('jobs')} className={linkClass('jobs')}>{t('job_listings')}</button></li>
          <li><button onClick={() => onNav('about')} className={linkClass('about')}>{t('nav_about')}</button></li>
        </ul>
        <div className="border-t border-gray-700 pt-4">
          <button onClick={onSignIn} className="block w-full text-left px-3 py-2 rounded text-sm text-gray-300 hover:bg-gray-800 transition-colors">
            {t('nav_sign_in')}
          </button>
          <div className="mt-3 px-3">
            <LanguageToggle />
          </div>
        </div>
      </nav>

      {/* Bottom nav — mobile only */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 z-40 flex items-center">
        <button onClick={() => onNav('jobs')} className={bottomClass('jobs')}>{t('nav_listings')}</button>
        <button onClick={() => onNav('about')} className={bottomClass('about')}>{t('nav_about')}</button>
        <button onClick={onSignIn} className="flex-1 py-3 text-center text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors">{t('nav_sign_in')}</button>
        <LanguageToggle className="px-2" />
      </nav>
    </>
  )
}

export default function PublicLanding({ onLogin }: { onLogin: (user: CurrentUser) => void }) {
  const t = useT()
  const navigate = useNavigate()
  const location = useLocation()
  const [jobs, setJobs] = useState<Job[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [view, setView] = useState<View>('jobs')
  const [modal, setModal] = useState<Modal>(null)
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null)

  const loadJobs = async () => {
    const page = await listPublicJobs()
    setJobs(page.jobs)
    setCursor(page.next_cursor)
    setHasMore(page.next_cursor !== null)
  }

  const loadMore = async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await listPublicJobs(cursor)
      setJobs(prev => [...prev, ...page.jobs])
      setCursor(page.next_cursor)
      setHasMore(page.next_cursor !== null)
    } finally {
      setLoadingMore(false)
    }
  }

  const sentinelRef = useInfiniteScroll(loadMore, hasMore && !loadingMore)

  useEffect(() => {
    loadJobs().catch(console.error).finally(() => setLoading(false))
  }, [])

  // Sync view state from URL — covers initial load and browser back/forward.
  // useLocation().pathname is already stripped of the basename by React Router.
  useEffect(() => {
    const path = location.pathname
    const match = path.match(/^\/jobs\/(\d+)$/)
    if (match) {
      setSelectedJobId(parseInt(match[1]))
      setView('job')
    } else if (path === '/about') {
      setSelectedJobId(null)
      setView('about')
    } else {
      setSelectedJobId(null)
      setView('jobs')
    }
  }, [location.pathname])

  const openJob = (id: number) => {
    setSelectedJobId(id)
    setView('job')
    navigate(`/jobs/${id}`)
  }

  const handleNav = (v: View) => {
    setView(v)
    if (v !== 'job') setSelectedJobId(null)
    if (v === 'jobs') navigate('/')
    else if (v === 'about') navigate('/about')
  }

  const openAuthModal = (type: Modal) => {
    if (view === 'job' && selectedJobId != null) {
      sessionStorage.setItem('postLoginRedirect', `/jobs/${selectedJobId}`)
    }
    setModal(type)
  }

  const overlay = modal && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => setModal(null)}
    >
      <div className="w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        {modal === 'login' ? (
          <Login modal onLogin={onLogin} onSignup={() => openAuthModal('signup')} />
        ) : (
          <Signup modal onSignup={onLogin} />
        )}
      </div>
    </div>
  )

  if (view === 'about') {
    return (
      <div className="flex h-dvh">
        <PublicSidebar view={view} onNav={handleNav} onSignIn={() => openAuthModal('login')} />
        <main className="flex-1 overflow-y-auto overscroll-y-none p-4 lg:p-6 pb-20 lg:pb-6">
          <About />
        </main>
        {overlay}
      </div>
    )
  }

  if (view === 'job' && selectedJobId != null) {
    return (
      <div className="flex h-dvh">
        <PublicSidebar view={view} onNav={handleNav} onSignIn={() => openAuthModal('login')} />
        <main className="flex-1 overflow-y-auto overscroll-y-none p-4 lg:p-6 pb-20 lg:pb-6">
          <PublicJobDetail
            jobId={selectedJobId}
            onBack={() => handleNav('jobs')}
            onLogin={() => openAuthModal('login')}
          />
        </main>
        {overlay}
      </div>
    )
  }

  return (
    <div className="flex h-screen">
      <PublicSidebar view={view} onNav={handleNav} onSignIn={() => openAuthModal('login')} />
      <main className="flex-1 overflow-y-auto overscroll-y-none p-4 lg:p-6 pb-20 lg:pb-6">
        <PullToRefresh onRefresh={loadJobs}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">{t('job_listings')}</h2>
            {!loading && jobs.length > 0 && (
              <span className="hidden lg:inline text-sm text-gray-400">
                {t('showing_count', { count: jobs.length })}
              </span>
            )}
          </div>

          {loading && jobs.length === 0 ? (
            <p className="text-gray-500">{t('loading_jobs')}</p>
          ) : jobs.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400 text-lg mb-2">{t('no_jobs_yet')}</p>
              <p className="text-gray-400 text-sm">{t('jobs_appear_after_sync')}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onStatusChange={() => {}}
                    authed={false}
                    onCardClick={() => openJob(job.id)}
                  />
                ))}
              </div>
              {hasMore && (
                <div className="mt-8">
                  <div ref={sentinelRef} />
                  <div className="hidden lg:flex justify-center">
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="px-6 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      {loadingMore ? t('loading') : t('load_more')}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </PullToRefresh>
      </main>
      {overlay}
    </div>
  )
}
