import { useState, useEffect } from 'react'
import { Mail, KeyRound, ShieldCheck, Lock, X, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api/axios'

/**
 * Three-step forgot-password modal:
 *   1. enter email     → POST /api/auth/forgot-password
 *   2. enter 6-digit code → POST /api/auth/verify-reset-code
 *   3. choose new password → POST /api/auth/reset-password
 *
 * Backend deliberately answers identically whether the email exists or not
 * at step 1 to prevent account enumeration — we mirror that in the UI by
 * always advancing to step 2 after the request, never surfacing "user not
 * found".
 *
 * Password policy enforced both client- and server-side: ≥ 8 characters and
 * at least one uppercase letter.
 */
export default function ForgotPasswordModal({ open, onClose }) {
    const [step, setStep] = useState(1)
    const [email, setEmail] = useState('')
    const [code, setCode] = useState('')
    const [pw, setPw] = useState('')
    const [pw2, setPw2] = useState('')
    const [loading, setLoading] = useState(false)
    const [done, setDone] = useState(false)

    // Reset whenever the modal is closed so reopening starts from step 1.
    useEffect(() => {
        if (!open) {
            setStep(1); setEmail(''); setCode(''); setPw(''); setPw2('')
            setLoading(false); setDone(false)
        }
    }, [open])

    if (!open) return null

    const passwordValid = pw.length >= 8 && /[A-Z]/.test(pw)
    const passwordsMatch = pw === pw2 && pw.length > 0

    const requestCode = async (e) => {
        e?.preventDefault()
        if (!email.trim()) return
        setLoading(true)
        try {
            await api.post('/auth/forgot-password', { email: email.trim() })
            // Step always advances regardless of whether the email exists —
            // the backend already kept the response opaque for security.
            toast.success('If that email is registered, a code has been sent.')
            setStep(2)
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not send code')
        }
        setLoading(false)
    }

    const verifyCode = async (e) => {
        e?.preventDefault()
        if (code.length !== 6) return
        setLoading(true)
        try {
            await api.post('/auth/verify-reset-code', { email: email.trim(), code: code.trim() })
            setStep(3)
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Invalid code')
        }
        setLoading(false)
    }

    const resetPassword = async (e) => {
        e?.preventDefault()
        if (!passwordValid || !passwordsMatch) return
        setLoading(true)
        try {
            await api.post('/auth/reset-password', {
                email: email.trim(), code: code.trim(), newPassword: pw,
            })
            setDone(true)
            toast.success('Password updated — please log in.')
            setTimeout(() => onClose(), 1800)
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not reset password')
        }
        setLoading(false)
    }

    return (
        <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-card)]">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center">
                            {step === 1 && <Mail className="w-4.5 h-4.5 text-blue-400" />}
                            {step === 2 && <KeyRound className="w-4.5 h-4.5 text-blue-400" />}
                            {step === 3 && <Lock className="w-4.5 h-4.5 text-blue-400" />}
                        </div>
                        <div>
                            <h3 className="text-[var(--text-primary)] font-semibold text-sm">Reset your password</h3>
                            <p className="text-[var(--text-secondary)] text-[11px]">Step {step} of 3</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5">
                    {/* Progress bar */}
                    <div className="flex items-center gap-1 mb-5">
                        {[1, 2, 3].map((n) => (
                            <div key={n} className={`flex-1 h-1 rounded-full transition-all ${
                                step >= n ? 'bg-blue-500' : 'bg-[var(--border-card)]'
                            }`} />
                        ))}
                    </div>

                    {done ? (
                        <div className="flex flex-col items-center text-center py-6 gap-2">
                            <CheckCircle2 className="w-12 h-12 text-green-400" />
                            <p className="text-[var(--text-primary)] font-semibold">Password updated</p>
                            <p className="text-[var(--text-secondary)] text-xs">You can now sign in with your new password.</p>
                        </div>
                    ) : step === 1 ? (
                        <form onSubmit={requestCode} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                                    <input
                                        type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                        autoFocus required placeholder="you@company.com"
                                        className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl py-2.5 pl-10 pr-4 text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    />
                                </div>
                                <p className="text-[var(--text-secondary)] text-[11px] mt-2">
                                    We'll email a 6-digit code if this address is registered.
                                </p>
                            </div>
                            <Submit loading={loading} disabled={!email.trim()} label="Send code" />
                        </form>
                    ) : step === 2 ? (
                        <form onSubmit={verifyCode} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Reset code</label>
                                <input
                                    type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    autoFocus required placeholder="123456"
                                    className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl py-3 px-4 text-center text-[var(--text-primary)] text-2xl tracking-[0.5em] font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-[var(--text-secondary)] text-[11px] mt-2">
                                    Check the inbox for <span className="font-medium text-[var(--text-primary)]">{email}</span>. The code expires in 15 minutes.
                                </p>
                            </div>
                            <Submit loading={loading} disabled={code.length !== 6} label="Verify" />
                            <button type="button" onClick={() => setStep(1)} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline w-full text-center">
                                Use a different email
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={resetPassword} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">New password</label>
                                <input
                                    type="password" value={pw} onChange={(e) => setPw(e.target.value)}
                                    autoFocus required minLength={8} placeholder="Min 8 chars, 1 uppercase"
                                    className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl py-2.5 px-4 text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                                <PolicyChip ok={pw.length >= 8} label="≥ 8 characters" />
                                <PolicyChip ok={/[A-Z]/.test(pw)} label="At least one uppercase letter" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Confirm password</label>
                                <input
                                    type="password" value={pw2} onChange={(e) => setPw2(e.target.value)}
                                    required minLength={8}
                                    className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl py-2.5 px-4 text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                                {pw2.length > 0 && !passwordsMatch && (
                                    <p className="text-red-400 text-[11px] mt-1">Passwords don't match</p>
                                )}
                            </div>
                            <Submit loading={loading} disabled={!passwordValid || !passwordsMatch} label="Update password" />
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}

function Submit({ loading, disabled, label }) {
    return (
        <button type="submit" disabled={loading || disabled}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 text-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <>
                    {label} <ArrowRight className="w-4 h-4" />
                </>
            )}
        </button>
    )
}

function PolicyChip({ ok, label }) {
    return (
        <div className={`flex items-center gap-1.5 mt-1.5 text-[11px] ${ok ? 'text-green-400' : 'text-[var(--text-secondary)]'}`}>
            <ShieldCheck className={`w-3 h-3 ${ok ? 'opacity-100' : 'opacity-40'}`} />
            <span>{label}</span>
        </div>
    )
}
