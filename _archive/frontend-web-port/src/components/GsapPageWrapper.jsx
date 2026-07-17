import { useEffect, useRef } from 'react'
import gsap from 'gsap'

/**
 * GsapPageWrapper
 *
 * Wrap any page content with this component to get automatic
 * GSAP entrance animations. The wrapper animates:
 *   - .gsap-header  → slides in from top
 *   - .gsap-card    → fades up with stagger
 *   - .gsap-row     → slides in from left with stagger
 *   - .gsap-fab     → bounces in from bottom-right
 *   - If none of those exist, falls back to animating all direct children
 *
 * Usage:
 *   import GsapPageWrapper from '../components/GsapPageWrapper'
 *
 *   export default function MyPage() {
 *     return (
 *       <GsapPageWrapper>
 *         <div className="gsap-header">...</div>
 *         <div className="gsap-card">...</div>
 *         <div className="gsap-card">...</div>
 *       </GsapPageWrapper>
 *     )
 *   }
 */
export default function GsapPageWrapper({ children, className = '' }) {
    const ref = useRef(null)

    useEffect(() => {
        if (!ref.current) return
        const ctx = gsap.context(() => {
            const tl = gsap.timeline()

            // Header — slide down with subtle scale
            const headers = ref.current.querySelectorAll('.gsap-header')
            if (headers.length > 0) {
                tl.fromTo(headers,
                    { opacity: 0, y: -24, scale: 0.97 },
                    { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'power3.out', clearProps: 'transform' },
                    0
                )
            }

            // Cards — springy stagger with subtle 3D rotation
            const cards = ref.current.querySelectorAll('.gsap-card')
            if (cards.length > 0) {
                tl.fromTo(cards,
                    { opacity: 0, y: 24, scale: 0.92, rotateX: 6 },
                    { opacity: 1, y: 0, scale: 1, rotateX: 0, duration: 0.5, stagger: 0.06, ease: 'back.out(1.3)', clearProps: 'transform' },
                    0.1
                )
            }

            // Table rows — smooth slide from left
            const rows = ref.current.querySelectorAll('.gsap-row')
            if (rows.length > 0) {
                tl.fromTo(rows,
                    { opacity: 0, x: -14 },
                    { opacity: 1, x: 0, duration: 0.3, stagger: 0.035, ease: 'power2.out', clearProps: 'transform' },
                    0.15
                )
            }

            // FAB / floating buttons — bounce in
            const fabs = ref.current.querySelectorAll('.gsap-fab')
            if (fabs.length > 0) {
                tl.fromTo(fabs,
                    { opacity: 0, scale: 0, y: 20 },
                    { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: 'back.out(2.5)', stagger: 0.06 },
                    0.25
                )
            }

            // Stat number count-up
            ref.current.querySelectorAll('.stat-value, .gsap-count').forEach(el => {
                const target = parseInt(el.textContent, 10) || 0
                if (target > 0) {
                    gsap.from(el, {
                        textContent: 0, duration: 1, delay: 0.4,
                        ease: 'power2.out', snap: { textContent: 1 },
                    })
                }
            })

            // Fallback: if nothing labeled, animate direct children
            const hasLabeled = headers.length + cards.length + rows.length + fabs.length > 0
            if (!hasLabeled) {
                const children = Array.from(ref.current.children)
                tl.fromTo(children,
                    { opacity: 0, y: 16 },
                    { opacity: 1, y: 0, duration: 0.4, stagger: 0.06, ease: 'power2.out', clearProps: 'transform' },
                    0
                )
            }
        }, ref)
        return () => ctx.revert()
    }, [])

    return (
        <div ref={ref} className={className}>
            {children}
        </div>
    )
}
