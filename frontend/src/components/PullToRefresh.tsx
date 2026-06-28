import { useEffect, useRef, useState } from 'react'

const THRESHOLD = 64

export default function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<void>
  children: React.ReactNode
}) {
  const [height, setHeight] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [ready, setReady] = useState(false)
  const startY = useRef(0)
  const pulling = useRef(false)
  const dist = useRef(0)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    const scrollTop = () => document.querySelector('main')?.scrollTop ?? 0

    const onStart = (e: TouchEvent) => {
      if (refreshing || scrollTop() > 0) return
      startY.current = e.touches[0].clientY
      pulling.current = true
    }

    const onMove = (e: TouchEvent) => {
      if (!pulling.current || refreshing) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0) { dist.current = 0; setHeight(0); setReady(false); return }
      const capped = Math.min(dy * 0.5, THRESHOLD)
      dist.current = capped
      setHeight(capped)
      setReady(capped >= THRESHOLD)
    }

    const onEnd = async () => {
      if (!pulling.current) return
      pulling.current = false
      if (dist.current >= THRESHOLD) {
        setReady(false)
        setRefreshing(true)
        setHeight(40)
        try { await onRefreshRef.current() } finally {
          setRefreshing(false)
          setHeight(0)
          dist.current = 0
        }
      } else {
        setHeight(0)
        setReady(false)
        dist.current = 0
      }
    }

    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: true })
    document.addEventListener('touchend', onEnd)
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
    }
  }, [refreshing])

  return (
    <div>
      <div
        className="flex items-center justify-center overflow-hidden lg:hidden"
        style={{ height, transition: refreshing ? 'none' : 'height 0.15s' }}
      >
        <svg
          className={`w-5 h-5 text-gray-400 ${refreshing ? 'animate-spin' : ''}`}
          style={{ transform: `rotate(${ready && !refreshing ? 180 : 0}deg)`, transition: 'transform 0.2s' }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {children}
    </div>
  )
}
