import { useEffect, useRef, useCallback } from 'react'
import gsap from 'gsap'

/**
 * useIncoAnimations — Master animation hook for all INCO LAB pages.
 *
 * Provides:
 *  - GSAP entrance animations for common elements
 *  - P5-style floating particles background (optional, canvas-based)
 *  - Stagger animations for lists, cards, rows
 *  - Modal entrance/exit helpers
 *  - Number count-up for stat displays
 *
 * Usage:
 *   const { containerRef, animateModal, animateList } = useIncoAnimations({
 *     particles: false,       // enable floating dots background
 *     particleColor: [96, 165, 250],  // RGB base color
 *   })
 *
 *   return <div ref={containerRef}>...</div>
 */
export default function useIncoAnimations(options = {}) {
    const {
        particles = false,
        particleColor = [96, 165, 250],
        particleCount = 30,
    } = options

    const containerRef = useRef(null)
    const canvasRef = useRef(null)
    const animFrameRef = useRef(null)

    // ── GSAP page entrance ─────────────────────────────────────────────
    useEffect(() => {
        const el = containerRef.current
        if (!el) return

        const ctx = gsap.context(() => {
            // Page-level headers
            const headers = el.querySelectorAll('.anim-header, .gsap-header, [data-anim="header"]')
            if (headers.length) {
                gsap.fromTo(headers,
                    { opacity: 0, y: -20 },
                    { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', stagger: 0.08 }
                )
            }

            // Stat cards
            const stats = el.querySelectorAll('.anim-stat, .dash-stat, [data-anim="stat"]')
            if (stats.length) {
                gsap.fromTo(stats,
                    { opacity: 0, y: 25, scale: 0.92 },
                    { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.08, delay: 0.1, ease: 'back.out(1.3)', clearProps: 'transform' }
                )
            }

            // Cards
            const cards = el.querySelectorAll('.anim-card, .gsap-card, [data-anim="card"]')
            if (cards.length) {
                gsap.fromTo(cards,
                    { opacity: 0, y: 20, scale: 0.97 },
                    { opacity: 1, y: 0, scale: 1, duration: 0.45, stagger: 0.06, delay: 0.15, ease: 'power2.out', clearProps: 'transform' }
                )
            }

            // Table rows
            const rows = el.querySelectorAll('.anim-row, .gsap-row, [data-anim="row"]')
            if (rows.length) {
                gsap.fromTo(rows,
                    { opacity: 0, x: -14 },
                    { opacity: 1, x: 0, duration: 0.3, stagger: 0.04, delay: 0.2, ease: 'power2.out', clearProps: 'transform' }
                )
            }

            // Sections
            const sections = el.querySelectorAll('.anim-section, .dash-section, [data-anim="section"]')
            if (sections.length) {
                gsap.fromTo(sections,
                    { opacity: 0, y: 20 },
                    { opacity: 1, y: 0, duration: 0.5, stagger: 0.1, delay: 0.2, ease: 'power2.out' }
                )
            }

            // FABs
            const fabs = el.querySelectorAll('.anim-fab, .gsap-fab, [data-anim="fab"]')
            if (fabs.length) {
                gsap.fromTo(fabs,
                    { opacity: 0, scale: 0, y: 20 },
                    { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: 'back.out(2.5)', delay: 0.3 }
                )
            }

            // Tabs
            const tabs = el.querySelectorAll('.anim-tabs, [data-anim="tabs"]')
            if (tabs.length) {
                gsap.fromTo(tabs,
                    { opacity: 0, y: 12 },
                    { opacity: 1, y: 0, duration: 0.4, delay: 0.12, ease: 'power2.out' }
                )
            }

            // Count-up numbers
            el.querySelectorAll('.anim-count, .stat-value').forEach(el => {
                const target = parseInt(el.textContent, 10) || 0
                if (target > 0) {
                    gsap.from(el, {
                        textContent: 0,
                        duration: 1,
                        delay: 0.4,
                        ease: 'power2.out',
                        snap: { textContent: 1 },
                    })
                }
            })

            // Fallback: if no labeled elements, animate direct children
            const total = headers.length + stats.length + cards.length + rows.length + sections.length + fabs.length + tabs.length
            if (total === 0) {
                const children = Array.from(el.children)
                if (children.length) {
                    gsap.fromTo(children,
                        { opacity: 0, y: 16 },
                        { opacity: 1, y: 0, duration: 0.4, stagger: 0.06, ease: 'power2.out', clearProps: 'transform' }
                    )
                }
            }
        }, el)

        return () => ctx.revert()
    }, [])

    // ── P5-style particle canvas ───────────────────────────────────────
    useEffect(() => {
        if (!particles) return
        const container = containerRef.current
        if (!container) return

        const canvas = document.createElement('canvas')
        canvas.style.cssText = 'position:absolute;inset:0;z-index:0;pointer-events:none;opacity:0.5;'
        container.style.position = container.style.position || 'relative'
        container.insertBefore(canvas, container.firstChild)
        canvasRef.current = canvas

        const ctx = canvas.getContext('2d')
        let w, h
        const resize = () => {
            w = canvas.width = container.offsetWidth
            h = canvas.height = container.offsetHeight
        }
        resize()

        const pts = Array.from({ length: particleCount }, () => ({
            x: Math.random() * (w || 800),
            y: Math.random() * (h || 600),
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            r: Math.random() * 2 + 0.5,
            a: Math.random() * 0.4 + 0.1,
        }))

        const [cr, cg, cb] = particleColor

        const draw = () => {
            ctx.clearRect(0, 0, w, h)
            for (let i = 0; i < pts.length; i++) {
                const p = pts[i]
                p.x += p.vx; p.y += p.vy
                if (p.x < 0) p.x = w; if (p.x > w) p.x = 0
                if (p.y < 0) p.y = h; if (p.y > h) p.y = 0

                ctx.beginPath()
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
                ctx.fillStyle = `rgba(${cr},${cg},${cb},${p.a})`
                ctx.fill()

                // Connect nearby
                for (let j = i + 1; j < pts.length; j++) {
                    const q = pts[j]
                    const dx = p.x - q.x, dy = p.y - q.y
                    const d = Math.sqrt(dx * dx + dy * dy)
                    if (d < 120) {
                        ctx.beginPath()
                        ctx.moveTo(p.x, p.y)
                        ctx.lineTo(q.x, q.y)
                        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${0.08 * (1 - d / 120)})`
                        ctx.lineWidth = 0.5
                        ctx.stroke()
                    }
                }
            }
            animFrameRef.current = requestAnimationFrame(draw)
        }
        draw()

        const ro = new ResizeObserver(resize)
        ro.observe(container)

        return () => {
            cancelAnimationFrame(animFrameRef.current)
            ro.disconnect()
            canvas.remove()
        }
    }, [particles, particleCount, particleColor])

    // ── Helpers ─────────────────────────────────────────────────────────

    const animateModal = useCallback((el, direction = 'in') => {
        if (!el) return
        if (direction === 'in') {
            gsap.fromTo(el,
                { opacity: 0, scale: 0.92, y: 20 },
                { opacity: 1, scale: 1, y: 0, duration: 0.35, ease: 'back.out(1.5)' }
            )
        } else {
            gsap.to(el, { opacity: 0, scale: 0.95, y: 10, duration: 0.2, ease: 'power2.in' })
        }
    }, [])

    const animateList = useCallback((selector, container) => {
        const el = container || containerRef.current
        if (!el) return
        const items = el.querySelectorAll(selector)
        if (items.length) {
            gsap.fromTo(items,
                { opacity: 0, y: 12 },
                { opacity: 1, y: 0, duration: 0.3, stagger: 0.04, ease: 'power2.out', clearProps: 'transform' }
            )
        }
    }, [])

    const animateTabSwitch = useCallback((selector) => {
        const el = containerRef.current
        if (!el) return
        const target = el.querySelector(selector) || el.querySelectorAll('.anim-tab-content, .profile-content')
        if (target.length !== undefined) {
            gsap.fromTo(target, { opacity: 0, x: 12 }, { opacity: 1, x: 0, duration: 0.3, ease: 'power2.out' })
        } else if (target) {
            gsap.fromTo(target, { opacity: 0, x: 12 }, { opacity: 1, x: 0, duration: 0.3, ease: 'power2.out' })
        }
    }, [])

    return {
        containerRef,
        animateModal,
        animateList,
        animateTabSwitch,
    }
}
