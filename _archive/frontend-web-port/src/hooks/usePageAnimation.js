import { useEffect, useRef } from 'react'
import gsap from 'gsap'

/**
 * Reusable GSAP page entrance animation hook.
 * Animates elements with class 'gsap-item' on mount.
 *
 * Usage:
 *   const ref = usePageAnimation()
 *   <div ref={ref}>
 *     <div className="gsap-item">...</div>
 *     <div className="gsap-item">...</div>
 *   </div>
 */
export function usePageAnimation(options = {}) {
    const {
        selector = '.gsap-item',
        fromY    = 24,
        fromX    = 0,
        delay    = 0,
        stagger  = 0.07,
        duration = 0.45,
        ease     = 'power2.out',
    } = options

    const ref = useRef(null)

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.fromTo(selector,
                { opacity: 0, y: fromY, x: fromX },
                { opacity: 1, y: 0, x: 0, duration, delay, stagger, ease, clearProps: 'transform' }
            )
        }, ref)
        return () => ctx.revert()
    }, [])

    return ref
}

/**
 * Animates a list of rows when data loads.
 * Call inside useEffect when data changes.
 */
export function animateList(selector = '.list-item', options = {}) {
    const { stagger = 0.05, duration = 0.35, fromX = -16 } = options
    gsap.fromTo(selector,
        { opacity: 0, x: fromX },
        { opacity: 1, x: 0, duration, stagger, ease: 'power2.out', clearProps: 'transform' }
    )
}

/**
 * Animate a modal appearing.
 */
export function animateModal(selector = '.gsap-modal') {
    gsap.fromTo(selector,
        { opacity: 0, scale: 0.93, y: 20 },
        { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: 'back.out(1.5)' }
    )
}

/**
 * Stagger-animate stat cards.
 */
export function animateStats(selector = '.stat-card', delay = 0) {
    gsap.fromTo(selector,
        { opacity: 0, y: 20, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.45, delay, stagger: 0.07, ease: 'power2.out' }
    )
}
