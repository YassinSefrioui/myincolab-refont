import { useEffect, useRef } from 'react'

/**
 * Calls `callback` on two triggers:
 *  1. Periodically every `intervalMs` (default 30 seconds)
 *  2. Immediately when the browser tab becomes visible again (user switches back)
 *
 * Uses a ref so the callback is always the latest version (no stale closure).
 */
export default function useAutoRefresh(callback, intervalMs = 1000) {
    const cbRef = useRef(callback)
    cbRef.current = callback

    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === 'visible') cbRef.current()
        }
        document.addEventListener('visibilitychange', onVisible)
        const timer = setInterval(() => cbRef.current(), intervalMs)
        return () => {
            document.removeEventListener('visibilitychange', onVisible)
            clearInterval(timer)
        }
    }, [intervalMs])
}
