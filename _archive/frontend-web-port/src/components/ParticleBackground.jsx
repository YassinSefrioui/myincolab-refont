import { useEffect, useRef } from 'react'
import useThemeStore from '../store/themeStore'

// Detect mobile once at module level
const IS_MOBILE = typeof navigator !== 'undefined' &&
    (navigator.maxTouchPoints > 0 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent))

export default function ParticleBackground() {
    const canvasRef = useRef(null)
    const animRef   = useRef(null)
    const mouseRef  = useRef({ x: -1000, y: -1000 })
    const { theme } = useThemeStore()

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        let w = canvas.width  = window.innerWidth
        let h = canvas.height = window.innerHeight

        const isDark = theme !== 'light'

        // Mobile: far fewer particles, no gradient lines
        const COUNT = IS_MOBILE
            ? Math.min(20, Math.floor((w * h) / 30000))
            : Math.min(75, Math.floor((w * h) / 18000))

        const particles = Array.from({ length: COUNT }, () => ({
            x:          Math.random() * w,
            y:          Math.random() * h,
            vx:         (Math.random() - 0.5) * 0.45,
            vy:         (Math.random() - 0.5) * 0.45,
            baseR:      Math.random() * 2 + 0.8,
            pulsePhase: Math.random() * Math.PI * 2,
            pulseSpeed: Math.random() * 0.025 + 0.01,
            baseHue:    210 + Math.random() * 50,
            alpha:      Math.random() * 0.45 + 0.15,
        }))

        let stars = []
        let frame = 0

        const onResize = () => {
            w = canvas.width  = window.innerWidth
            h = canvas.height = window.innerHeight
        }
        const onMouseMove = e => { mouseRef.current = { x: e.clientX, y: e.clientY } }
        window.addEventListener('resize', onResize)
        if (!IS_MOBILE) window.addEventListener('mousemove', onMouseMove)

        const particleAlpha = isDark ? 1    : 0.4
        const lineAlpha     = isDark ? 0.13 : 0.06
        const lightness     = isDark ? 65   : 40

        // Pre-built solid line colour for mobile (avoid per-line gradient)
        const mobileLine = `hsla(220, 75%, 65%, ${lineAlpha})`

        const draw = () => {
            // ── 30 fps cap on mobile (skip odd frames) ──────────────────────
            if (IS_MOBILE && frame % 2 === 1) {
                frame++
                animRef.current = requestAnimationFrame(draw)
                return
            }

            ctx.clearRect(0, 0, w, h)
            frame++
            const mx = mouseRef.current.x
            const my = mouseRef.current.y

            // ── Shooting stars (desktop only — too expensive on mobile) ──────
            if (!IS_MOBILE) {
                if (Math.random() < 0.003) {
                    const fromLeft = Math.random() > 0.5
                    stars.push({
                        x:   fromLeft ? -10 : w + 10,
                        y:   Math.random() * h * 0.6,
                        vx:  fromLeft ? (Math.random() * 3 + 2) : -(Math.random() * 3 + 2),
                        vy:  Math.random() * 2 + 1,
                        life: 1,
                        len: Math.random() * 80 + 40,
                        hue: 200 + Math.random() * 60,
                    })
                }
                for (const s of stars) {
                    const tailX = s.x - s.vx * (s.len / Math.hypot(s.vx, s.vy))
                    const tailY = s.y - s.vy * (s.len / Math.hypot(s.vx, s.vy))
                    const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y)
                    grad.addColorStop(0, `hsla(${s.hue}, 90%, 80%, 0)`)
                    grad.addColorStop(1, `hsla(${s.hue}, 90%, 90%, ${s.life * (isDark ? 0.7 : 0.3)})`)
                    ctx.beginPath()
                    ctx.moveTo(tailX, tailY)
                    ctx.lineTo(s.x, s.y)
                    ctx.strokeStyle = grad
                    ctx.lineWidth   = 1.5
                    ctx.stroke()
                    s.x += s.vx; s.y += s.vy; s.life -= 0.018
                }
                stars = stars.filter(s => s.life > 0 && s.x > -20 && s.x < w + 20 && s.y < h + 20)
            }

            // ── Particles ─────────────────────────────────────────────────
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i]

                p.pulsePhase += p.pulseSpeed
                const pulsedR = p.baseR * (1 + 0.28 * Math.sin(p.pulsePhase))

                p.x += p.vx
                p.y += p.vy

                if (p.x < -10) p.x = w + 10
                if (p.x > w + 10) p.x = -10
                if (p.y < -10) p.y = h + 10
                if (p.y > h + 10) p.y = -10

                // Mouse interaction — desktop only
                if (!IS_MOBILE) {
                    const dx   = p.x - mx
                    const dy   = p.y - my
                    const dist = Math.sqrt(dx * dx + dy * dy)
                    if (dist < 80) {
                        const force = (80 - dist) / 80 * 0.04
                        p.vx += dx * force * 0.15
                        p.vy += dy * force * 0.15
                    } else if (dist < 220) {
                        const force = (220 - dist) / 220 * 0.004
                        p.vx -= dx * force * 0.05
                        p.vy -= dy * force * 0.05
                    }
                }

                p.vx *= 0.994
                p.vy *= 0.994
                const speed = Math.hypot(p.vx, p.vy)
                if (speed > 1.5) { p.vx *= 1.5 / speed; p.vy *= 1.5 / speed }

                const dynamicHue = p.baseHue + speed * 120

                // ── Draw particle dot ──────────────────────────────────────
                if (IS_MOBILE) {
                    // Solid circle — no gradient creation on mobile
                    ctx.beginPath()
                    ctx.arc(p.x, p.y, pulsedR * 2, 0, Math.PI * 2)
                    ctx.fillStyle = `hsla(${dynamicHue}, 85%, ${lightness}%, ${p.alpha * particleAlpha})`
                    ctx.fill()
                } else {
                    // Full radial gradient on desktop
                    const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, pulsedR * 2)
                    grd.addColorStop(0, `hsla(${dynamicHue}, 85%, ${lightness}%, ${p.alpha * particleAlpha})`)
                    grd.addColorStop(1, `hsla(${dynamicHue}, 85%, ${lightness}%, 0)`)
                    ctx.beginPath()
                    ctx.arc(p.x, p.y, pulsedR * 2, 0, Math.PI * 2)
                    ctx.fillStyle = grd
                    ctx.fill()
                }

                // ── Connect nearby particles ───────────────────────────────
                for (let j = i + 1; j < particles.length; j++) {
                    const q   = particles[j]
                    const ddx = p.x - q.x
                    const ddy = p.y - q.y
                    // Use squared distance to skip sqrt when particle is far
                    const d2  = ddx * ddx + ddy * ddy
                    if (d2 < 150 * 150) {
                        const d = Math.sqrt(d2)
                        const a = lineAlpha * (1 - d / 150)
                        ctx.beginPath()
                        ctx.moveTo(p.x, p.y)
                        ctx.lineTo(q.x, q.y)

                        if (IS_MOBILE) {
                            // Solid colour — no gradient object creation on mobile
                            ctx.strokeStyle = `hsla(220, 75%, 65%, ${a})`
                        } else {
                            const lineGrad = ctx.createLinearGradient(p.x, p.y, q.x, q.y)
                            lineGrad.addColorStop(0, `hsla(${dynamicHue}, 75%, 65%, ${a})`)
                            lineGrad.addColorStop(1, `hsla(${q.baseHue}, 75%, 65%, ${a})`)
                            ctx.strokeStyle = lineGrad
                        }
                        ctx.lineWidth = 0.6
                        ctx.stroke()
                    }
                }
            }

            animRef.current = requestAnimationFrame(draw)
        }
        draw()

        return () => {
            cancelAnimationFrame(animRef.current)
            window.removeEventListener('resize', onResize)
            if (!IS_MOBILE) window.removeEventListener('mousemove', onMouseMove)
        }
    }, [theme])

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed', inset: 0,
                zIndex: 0,
                pointerEvents: 'none',
                opacity: theme === 'light' ? 0.45 : 0.75,
            }}
        />
    )
}
