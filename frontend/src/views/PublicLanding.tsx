import { useEffect, useState } from 'react'
import type { Job, CurrentUser } from '../types'
import { listPublicJobs } from '../api'
import JobCard from '../components/JobCard'
import Login from './Login'
import Signup from './Signup'
import PublicJobDetail from './PublicJobDetail'
import PullToRefresh from '../components/PullToRefresh'
import { useInfiniteScroll } from '../hooks/useInfiniteScroll'
import About from './About'

type View = 'jobs' | 'job' | 'about'
type Modal = 'login' | 'signup' | null

function PublicSidebar({ view, onNav, onSignIn }: { view: View; onNav: (v: View) => void; onSignIn: () => void }) {
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
          <li><button onClick={() => onNav('jobs')} className={linkClass('jobs')}>Job Listings</button></li>
          <li><button onClick={() => onNav('about')} className={linkClass('about')}>About</button></li>
        </ul>
        <div className="border-t border-gray-700 pt-4">
          <button onClick={onSignIn} className="block w-full text-left px-3 py-2 rounded text-sm text-gray-300 hover:bg-gray-800 transition-colors">
            Sign in
          </button>
        </div>
      </nav>

      {/* Bottom nav — mobile only */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 z-40 flex">
        <button onClick={() => onNav('jobs')} className={bottomClass('jobs')}>Listings</button>
        <button onClick={() => onNav('about')} className={bottomClass('about')}>About</button>
        <button onClick={onSignIn} className="flex-1 py-3 text-center text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors">Sign in</button>
      </nav>
    </>
  )
}

export default function PublicLanding({ onLogin }: { onLogin: (user: CurrentUser) => void }) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('jobs')
  const [modal, setModal] = useState<Modal>(null)
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null)
  const [shown, setShown] = useState(18)
  const loadMore = () => setShown((s) => s + 18)
  const sentinelRef = useInfiniteScroll(loadMore, shown < jobs.length)

  const loadJobs = async () => {
    const data = await listPublicJobs()
    setJobs(data)
    setShown(18)
  }

  useEffect(() => {
    loadJobs().catch(console.error).finally(() => setLoading(false))
  }, [])

  const openJob = (id: number) => { setSelectedJobId(id); setView('job') }

  const overlay = modal && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => setModal(null)}
    >
      <div className="w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        {modal === 'login' ? (
          <Login modal onLogin={onLogin} onSignup={() => setModal('signup')} />
        ) : (
          <Signup modal onSignup={onLogin} />
        )}
      </div>
    </div>
  )

  if (view === 'about') {
    return (
      <div className="flex h-screen">
        <PublicSidebar view={view} onNav={setView} onSignIn={() => setModal('login')} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 lg:pb-6">
          <About />
        </main>
        {overlay}
      </div>
    )
  }

  if (view === 'job' && selectedJobId != null) {
    return (
      <div className="flex h-screen">
        <PublicSidebar view={view} onNav={setView} onSignIn={() => setModal('login')} />
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <PublicJobDetail
            jobId={selectedJobId}
            onBack={() => setView('jobs')}
            onLogin={() => setModal('login')}
          />
        </main>
        {overlay}
      </div>
    )
  }

  return (
    <div className="flex h-screen">
      <PublicSidebar view={view} onNav={setView} onSignIn={() => setModal('login')} />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 lg:pb-6">
        <PullToRefresh onRefresh={loadJobs}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Job Listings</h2>
            {!loading && jobs.length > 0 && (
              <span className="hidden lg:inline text-sm text-gray-400">
                Showing {Math.min(shown, jobs.length)} of {jobs.length}
              </span>
            )}
          </div>

          {loading && jobs.length === 0 ? (
            <p className="text-gray-500">Loading jobs...</p>
          ) : jobs.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400 text-lg mb-2">No jobs yet</p>
              <p className="text-gray-400 text-sm">Jobs will appear here after the first sync.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {jobs.slice(0, shown).map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onStatusChange={() => {}}
                    authed={false}
                    onCardClick={() => openJob(job.id)}
                  />
                ))}
              </div>
              {shown < jobs.length && (
                <div className="mt-8">
                  <div ref={sentinelRef} />
                  <div className="hidden lg:flex justify-center">
                    <button
                      onClick={loadMore}
                      className="px-6 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Load more
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
