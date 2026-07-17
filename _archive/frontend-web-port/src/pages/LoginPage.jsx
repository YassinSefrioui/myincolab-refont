import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, KeyRound, ShieldAlert, AlertTriangle, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import gsap from 'gsap'
import api from '../api/axios'
import useAuthStore from '../store/authStore'
import ParticleBackground from '../components/ParticleBackground'
import ForgotPasswordModal from '../components/ForgotPasswordModal'

export default function LoginPage() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { login } = useAuthStore()
    const [forgotOpen, setForgotOpen] = useState(false)

    const [mode, setMode]               = useState('login')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading]         = useState(false)
    const [form, setForm]               = useState({ email: '', password: '', guestCode: '' })

    // Brute force state
    const [attemptsRemaining, setAttemptsRemaining] = useState(null)  // null = no warning yet
    const [lockedUntil, setLockedUntil]             = useState(null)  // Date object
    const [countdown, setCountdown]                 = useState(0)     // seconds

    const cardRef    = useRef(null)
    const logoRef    = useRef(null)
    const timerRef   = useRef(null)

    useEffect(() => {
        // Logo entrance: float in with glow
        if (logoRef.current) {
            gsap.fromTo(logoRef.current,
                { opacity: 0, y: -30, scale: 0.8 },
                { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: 'elastic.out(1, 0.6)' }
            )
        }
        // Card entrance: staggered reveal
        gsap.fromTo(cardRef.current,
            { opacity: 0, y: 50, scale: 0.92 },
            { opacity: 1, y: 0, scale: 1, duration: 0.7, delay: 0.25, ease: 'power3.out', clearProps: 'transform' }
        )
        return () => clearInterval(timerRef.current)
    }, [])

    // Countdown timer when locked
    const startCountdown = useCallback((seconds) => {
        setCountdown(seconds)
        clearInterval(timerRef.current)
        timerRef.current = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current)
                    setLockedUntil(null)
                    setAttemptsRemaining(null)
                    return 0
                }
                return prev - 1
            })
        }, 1000)
    }, [])

    const formatCountdown = (s) => {
        const m = Math.floor(s / 60)
        const sec = s % 60
        return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    }

    const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value })

    const handleLogin = async e => {
        e.preventDefault()
        if (lockedUntil) return  // blocked — don't even try

        setLoading(true)
        try {
            const res = await api.post('/auth/login', {
                email:    form.email,
                password: form.password,
            })
            const { token, ...user } = res.data.data
            // Primary auth = HttpOnly cookie (backend sets it on this response,
            // axios automatically ships it with `withCredentials`).
            // localStorage copy is kept ONLY for the WebSocket / SFU paths that
            // still need the raw JWT in the URL — they'll be migrated next.
            window.__authToken = token
            localStorage.setItem('token', token)
            login(token, user)
            clearInterval(timerRef.current)
            setAttemptsRemaining(null)
            setLockedUntil(null)
            toast.success(t('login.welcomeBack', { name: user.fullName }))
            navigate('/')
        } catch (err) {
            const status  = err.response?.status
            const message = err.response?.data?.message || t('login.loginFailed')

            if (status === 429) {
                // Account locked
                const retryAfter = parseInt(err.response?.headers?.['retry-after'] || '900', 10)
                setLockedUntil(new Date(Date.now() + retryAfter * 1000))
                setAttemptsRemaining(0)
                startCountdown(retryAfter)
                // Shake animation
                gsap.fromTo(cardRef.current,
                    { x: 0 },
                    { x: [-10, 10, -8, 8, -4, 4, 0], duration: 0.5, ease: 'power2.out' }
                )
            } else if (status === 401) {
                // Parse remaining attempts from message
                // e.g. "Invalid email or password. 3 attempts remaining before account lock."
                const match = message.match(/(\d+) attempt/)
                if (match) {
                    setAttemptsRemaining(parseInt(match[1], 10))
                }
            }

            toast.error(message)
        } finally {
            setLoading(false)
        }
    }

    const handleGuestLogin = async e => {
        e.preventDefault()
        setLoading(true)
        try {
            const res = await api.post('/auth/guest', { code: form.guestCode })
            const { token, ...user } = res.data.data
            // Same security model as the regular login — cookie is primary,
            // localStorage copy retained for WS/SFU compatibility.
            window.__authToken = token
            localStorage.setItem('token', token)
            login(token, user)
            toast.success(t('login.guestAccessGranted'))
            navigate('/guest')
        } catch (err) {
            toast.error(err.response?.data?.message || t('login.invalidGuestCode'))
        } finally {
            setLoading(false)
        }
    }

    const isLocked = !!lockedUntil

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4 overflow-hidden relative">

            {/* P5-style particle network canvas */}
            <ParticleBackground />

            {/* Animated gradient orbs (background ambience) */}
            <div className="login-orb login-orb-1" />
            <div className="login-orb login-orb-2" />
            <div className="login-orb login-orb-3" />
            <div className="login-orb login-orb-4" />

            {/* Animated dot grid overlay */}
            <div className="login-grid" />

            <div className="w-full max-w-md relative z-10">

                {/* Logo — animated entrance */}
                <div className="text-center mb-8" ref={logoRef}>
                    <div className="inline-flex items-center justify-center w-20 h-20 mb-4">
                        <img src="/logo.jpeg" alt="INCO LAB" className="w-full h-full object-contain drop-shadow-[0_0_16px_rgba(99,102,241,0.6)]" />
                    </div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">INCO LAB</h1>
                    <p className="text-[var(--text-secondary)] mt-1 text-sm">Internal Collaboration Platform</p>
                </div>

                {/* Form Card — glassmorphism with animated border */}
                <div className="login-card-wrapper">
                    <div className="bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-primary)] rounded-2xl p-8 shadow-2xl login-card" ref={cardRef}>

                    {/* Tab Switch */}
                    <div className="flex rounded-xl bg-[var(--bg-input)] p-1 mb-6">
                        <button onClick={() => setMode('login')}
                                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'login' ? 'bg-blue-600 text-white shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                            {t('login.signIn')}
                        </button>
                        <button onClick={() => setMode('guest')}
                                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'guest' ? 'bg-blue-600 text-white shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                            {t('login.guestAccess')}
                        </button>
                    </div>

                    {/* Login Form */}
                    {mode === 'login' && (
                        <form onSubmit={handleLogin} className="space-y-4">

                            {/* ── Locked banner ─────────────────────────────── */}
                            {isLocked && (
                                <div className="flex flex-col items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                                    <div className="flex items-center gap-2 text-red-400">
                                        <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                                        <p className="text-sm font-semibold">Account Temporarily Locked</p>
                                    </div>
                                    <p className="text-xs text-red-300 text-center">
                                        Too many failed attempts. Please wait or contact your administrator.
                                    </p>
                                    <div className="flex items-center gap-2 bg-red-500/20 px-4 py-2 rounded-lg">
                                        <Clock className="w-4 h-4 text-red-300" />
                                        <span className="text-red-200 font-mono text-lg font-bold tracking-widest">
                                            {formatCountdown(countdown)}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* ── Attempts warning ──────────────────────────── */}
                            {!isLocked && attemptsRemaining !== null && attemptsRemaining > 0 && (
                                <div className={`flex items-start gap-2.5 p-3 rounded-xl border ${
                                    attemptsRemaining <= 2
                                        ? 'bg-red-500/10 border-red-500/30 text-red-400'
                                        : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                }`}>
                                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium">Incorrect password</p>
                                        <p className="text-xs mt-0.5 opacity-80">
                                            {attemptsRemaining === 1
                                                ? '⚠️ Last attempt — account will be locked after this.'
                                                : `${attemptsRemaining} attempts remaining before your account is locked for 15 minutes.`}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">{t('login.email')}</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                                    <input type="email" name="email" value={form.email} onChange={handleChange}
                                           placeholder={t('login.emailPlaceholder')} required disabled={isLocked}
                                           className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-[var(--text-placeholder)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed" />
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">{t('login.password')}</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                                    <input type={showPassword ? 'text' : 'password'} name="password"
                                           value={form.password} onChange={handleChange}
                                           placeholder={t('login.passwordPlaceholder')} required disabled={isLocked}
                                           className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl py-2.5 pl-10 pr-10 text-white placeholder-[var(--text-placeholder)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed" />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Forgot password link — opens the 3-step reset modal */}
                            <button
                                type="button"
                                onClick={() => setForgotOpen(true)}
                                className="block ml-auto text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                Forgot password?
                            </button>

                            {/* Submit */}
                            <button type="submit" disabled={loading || isLocked}
                                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-blue-600/20 mt-2">
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                        </svg>
                                        {t('login.signingIn')}
                                    </span>
                                ) : isLocked ? 'Account Locked' : t('login.signIn')}
                            </button>
                        </form>
                    )}
                    <ForgotPasswordModal open={forgotOpen} onClose={() => setForgotOpen(false)} />

                    {/* Guest Form */}
                    {mode === 'guest' && (
                        <form onSubmit={handleGuestLogin} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">{t('login.guestAccessCode')}</label>
                                <div className="relative">
                                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                                    <input type="text" name="guestCode" value={form.guestCode}
                                           onChange={handleChange} placeholder={t('login.guestCodePlaceholder')} required
                                           className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-[var(--text-placeholder)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm" />
                                </div>
                            </div>
                            <p className="text-xs text-[var(--text-muted)]">{t('login.guestDescription')}</p>
                            <button type="submit" disabled={loading}
                                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-blue-600/20">
                                {loading ? t('login.verifying') : t('login.accessPlatform')}
                            </button>
                        </form>
                    )}
                </div>
                </div>

                <p className="text-center text-[var(--text-muted)] text-xs mt-6">{t('login.footer')}</p>
            </div>
        </div>
    )
}
