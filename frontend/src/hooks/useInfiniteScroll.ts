import { useEffect, useRef } from 'react'

const MOBILE = '(max-width: 1023px)'

export function useInfiniteScroll(onLoadMore: () => void, enabled: boolean) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const callbackRef = useRef(onLoadMore)
  callbackRef.current = onLoadMore

  useEffect(() => {
    if (!enabled) return
    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && window.matchMedia(MOBILE).matches) {
        callbackRef.current()
      }
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [enabled])

  return sentinelRef
}
