import { useState, useEffect, useRef } from 'react'
import {
    User, Mail, Shield, Globe, LogOut,
    Check, Loader2, Camera, Sun, Moon
    , BellOff, Bell } from 'lucide-react'
import api from '../api/axios'
import useAuthStore from '../store/authStore'
import { getAvatarUrl } from '../utils/avatarUrl'
import useThemeStore from '../store/themeStore'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n/index.js'
import gsap from 'gsap'

const LANGUAGES = [
    { code: 'en', label: 'English',  flag: '🇬🇧' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'es', label: 'Español',  flag: '🇪🇸' },
    { code: 'zh', label: '中文',     flag: '🇨🇳' },
    { code: 'it', label: 'Italiano', flag: '🇮🇹' },
]

const STATUSES = [
    { value: 'ONLINE', label: 'profile.online', color: 'bg-emerald-400' },
    { value: 'AWAY',   label: 'profile.away',   color: 'bg-amber-400'   },
    { value: 'BUSY',   label: 'profile.busy',   color: 'bg-red-400'     },
]

export default function ProfilePage() {
    const { user, updateUser, logout } = useAuthStore()
    const { theme, toggleTheme }       = useThemeStore()
    const navigate   = useNavigate()
    const { t }      = useTranslation()
    const containerRef = useRef(null)
    const cardRef      = useRef(null)

    const [form, setForm]           = useState({ fullName: '', email: '', language: 'en', status: 'ONLINE' })
    const [passwords, setPasswords] = useState({ current: '', newPass: '', confirm: '' })
    const [saving, setSaving]       = useState(false)
    const [savingPw, setSavingPw]   = useState(false)
    const [uploadingPhoto, setUploadingPhoto] = useState(false)
    const [activeTab, setActiveTab] = useState('profile')
    const [dndUntil, setDndUntil]   = useState(() => {
        const saved = localStorage.getItem('dnd-until')
        return saved && new Date(saved) > new Date() ? new Date(saved) : null
    })

    useEffect(() => {
        if (user) {
            setForm({
                fullName: user.fullName || '',
                email:    user.email    || '',
                language: (user.preferredLanguage || user.language || 'EN').toLowerCase(),
                status:   user.presenceStatus || user.status || 'ONLINE',
            })
        }
    }, [user])

    // ── GSAP entrance animation ──────────────────────────────────────────────
    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.fromTo('.profile-header-card',
                { opacity: 0, y: -30, scale: 0.95 },
                { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'back.out(1.3)', clearProps: 'transform' }
            )
            gsap.fromTo('.profile-avatar',
                { opacity: 0, scale: 0.7, rotation: -10 },
                { opacity: 1, scale: 1, rotation: 0, duration: 0.5, delay: 0.15, ease: 'back.out(1.5)', clearProps: 'transform' }
            )
            gsap.fromTo('.profile-tabs',
                { opacity: 0, y: 20 },
                { opacity: 1, y: 0, duration: 0.45, delay: 0.2, ease: 'back.out(1.2)' }
            )
            gsap.fromTo('.profile-content',
                { opacity: 0, y: 20, scale: 0.98 },
                { opacity: 1, y: 0, scale: 1, duration: 0.45, delay: 0.3, ease: 'power2.out', clearProps: 'transform' }
            )
        }, containerRef)
        return () => ctx.revert()
    }, [])

    // Animate tab content on switch
    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.fromTo('.profile-content',
                { opacity: 0, x: 18, scale: 0.98 },
                { opacity: 1, x: 0, scale: 1, duration: 0.35, ease: 'power2.out', clearProps: 'transform' }
            )
        })
        return () => ctx.revert()
    }, [activeTab])

    const handleSaveProfile = async e => {
        e?.preventDefault()
        setSaving(true)
        try {
            const res = await api.put('/users/me', {
                fullName:          form.fullName,
                preferredLanguage: form.language.toUpperCase(),
                presenceStatus:    form.status,
            })
            updateUser(res.data.data)
            i18n.changeLanguage(form.language)
            localStorage.setItem('lang', form.language)
            toast.success(t('profile.save'))
        } catch (err) {
            toast.error(err.response?.data?.message || t('errors.failedToUpdateProfile'))
        } finally { setSaving(false) }
    }

    const handleChangePassword = async e => {
        e.preventDefault()
        if (passwords.newPass !== passwords.confirm) { toast.error(t('errors.passwordsDoNotMatch')); return }
        if (passwords.newPass.length < 8) { toast.error(t('errors.passwordTooShort')); return }
        setSavingPw(true)
        try {
            await api.put('/users/me/password', {
                currentPassword: passwords.current,
                newPassword:     passwords.newPass,
            })
            toast.success(t('errors.passwordChanged'))
            setPasswords({ current: '', newPass: '', confirm: '' })
        } catch (err) {
            toast.error(err.response?.data?.message || t('errors.failedToChangePassword'))
        } finally { setSavingPw(false) }
    }

    const enableDnd = (minutes) => {
        const until = new Date(Date.now() + minutes * 60 * 1000)
        localStorage.setItem('dnd-until', until.toISOString())
        setDndUntil(until)
        toast.success(`Do Not Disturb enabled for ${minutes >= 60 ? Math.round(minutes/60) + 'h' : minutes + 'min'}`)
    }

    const disableDnd = () => {
        localStorage.removeItem('dnd-until')
        setDndUntil(null)
        toast.success('Do Not Disturb disabled')
    }

    const handleLogout = async () => {
        try { await api.post('/auth/logout') } catch {}
        logout()
        navigate('/login')
    }

    const handleLogoutAll = async () => {
        try {
            await api.post('/auth/logout-all')
            toast.success(t('profile.signedOutAllDevices') || 'Signed out of all devices')
        } catch {}
        logout()
        navigate('/login')
    }

    const handlePhotoUpload = async file => {
        if (!file) return
        if (file.size > 5 * 1024 * 1024) { toast.error('Max 5MB'); return }
        if (!file.type.startsWith('image/')) { toast.error('Images only'); return }
        setUploadingPhoto(true)
        const fd = new FormData(); fd.append('file', file)
        try {
            const res = await api.post('/users/me/photo', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
            updateUser({ ...user, profilePhotoUrl: res.data.data })
            toast.success('Photo updated!')
            // Avatar bounce animation
            gsap.fromTo('.profile-avatar', { scale: 1.15 }, { scale: 1, duration: 0.4, ease: 'elastic.out(1,0.5)' })
        } catch { toast.error('Failed to upload photo') }
        finally { setUploadingPhoto(false) }
    }

    const roleColor = {
        SUPER_ADMIN: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
        ADMIN:    'text-red-400 bg-red-400/10 border-red-400/20',
        MANAGER:  'text-amber-400 bg-amber-400/10 border-amber-400/20',
        EMPLOYEE: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
        GUEST:    'text-slate-400 bg-slate-400/10 border-slate-400/20',
    }

    const currentStatus = STATUSES.find(s => s.value === form.status) || STATUSES[0]

    const inputClass = `w-full rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all
        bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]`

    const cardClass = `rounded-2xl p-6 border transition-all
        bg-[var(--bg-card)] border-[var(--border-primary)]`

    return (
        <div ref={containerRef} className="max-w-2xl mx-auto p-6 h-full overflow-y-auto">

            {/* Header Card */}
            <div className={`${cardClass} mb-6 profile-header-card`}>
                <div className="flex items-center gap-5">

                    {/* Avatar */}
                    <div className="relative group cursor-pointer profile-avatar">
                        <label className="cursor-pointer">
                            {user?.profilePhotoUrl ? (
                                <img src={getAvatarUrl(user)} alt="Profile"
                                     className="w-20 h-20 rounded-2xl object-cover shadow-lg" />
                            ) : (
                                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-blue-600/20">
                                    {user?.fullName?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                            )}
                            <div className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                {uploadingPhoto
                                    ? <Loader2 className="w-6 h-6 text-white animate-spin" />
                                    : <Camera className="w-6 h-6 text-white" />}
                            </div>
                            <input type="file" accept="image/*" className="hidden"
                                   disabled={uploadingPhoto}
                                   onChange={e => handlePhotoUpload(e.target.files[0])} />
                        </label>
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[var(--bg-secondary)] ${currentStatus.color}`} />
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{user?.fullName}</h1>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{user?.email}</p>
                        <div className="flex items-center gap-2 mt-2">
                            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${roleColor[user?.role] || roleColor.EMPLOYEE}`}>
                                {user?.role}
                            </span>
                            <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                                <div className={`w-2 h-2 rounded-full ${currentStatus.color}`} />
                                {t(currentStatus.label)}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        {/* ✅ Dark/Light toggle */}
                        <button onClick={toggleTheme}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all border"
                                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
                                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
                            {theme === 'dark'
                                ? <Sun className="w-4 h-4 text-amber-400" />
                                : <Moon className="w-4 h-4 text-blue-500" />}
                            <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
                        </button>

                        {/* Logout */}
                        <button onClick={handleLogout}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium transition-all border border-red-500/20">
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline">{t('profile.signOut')}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="profile-tabs flex gap-1 rounded-xl p-1 mb-6 border"
                 style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                {[
                    { key: 'profile',  label: t('profile.profile'),  icon: User   },
                    { key: 'security', label: t('profile.security'), icon: Shield },
                    { key: 'language', label: t('profile.language'), icon: Globe  },
                ].map(({ key, label, icon: Icon }) => (
                    <button key={key} onClick={() => setActiveTab(key)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                activeTab === key
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                    : 'text-slate-400 hover:text-white'
                            }`}>
                        <Icon className="w-4 h-4" />
                        {label}
                    </button>
                ))}
            </div>

            {/* Tab: Profile */}
            {activeTab === 'profile' && (
                <form onSubmit={handleSaveProfile} className={`${cardClass} space-y-5 profile-content`}>
                    <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{t('profile.title')}</h2>

                    <div>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('profile.fullName')}</label>
                        <input type="text" value={form.fullName}
                               onChange={e => setForm({ ...form, fullName: e.target.value })}
                               className={inputClass} />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('profile.email')}</label>
                        <input type="email" value={form.email} disabled
                               className={`${inputClass} cursor-not-allowed opacity-60`} />
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('profile.emailCannotChange')}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('profile.status')}</label>
                        <div className="flex gap-2">
                            {STATUSES.map(s => (
                                <button key={s.value} type="button"
                                        onClick={() => setForm({ ...form, status: s.value })}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                                            form.status === s.value
                                                ? 'border-slate-500 text-white'
                                                : 'text-slate-400 hover:text-white'
                                        }`}
                                        style={{ background: form.status === s.value ? 'var(--bg-secondary)' : 'var(--bg-input)', borderColor: form.status === s.value ? 'var(--border-primary)' : 'transparent' }}>
                                    <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                                    {t(s.label)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button type="submit" disabled={saving}
                            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20">
                        {saving
                            ? <><Loader2 className="w-4 h-4 animate-spin" />{t('profile.saving')}</>
                            : <><Check className="w-4 h-4" />{t('profile.save')}</>}
                    </button>
                </form>
            )}

            {/* Tab: Security */}
            {activeTab === 'security' && (
                <>
                <form onSubmit={handleChangePassword} className={`${cardClass} space-y-5 profile-content`}>
                    <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{t('profile.security')}</h2>

                    {[
                        { key: 'current', label: t('profile.currentPassword'), placeholder: '••••••••' },
                        { key: 'newPass', label: t('profile.newPassword'),     placeholder: '••••••••' },
                        { key: 'confirm', label: t('profile.confirmPassword'), placeholder: '••••••••' },
                    ].map(({ key, label, placeholder }) => (
                        <div key={key}>
                            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{label}</label>
                            <input type="password" value={passwords[key]}
                                   onChange={e => setPasswords({ ...passwords, [key]: e.target.value })}
                                   placeholder={placeholder} className={inputClass} />
                        </div>
                    ))}

                    {passwords.newPass && (
                        <div className="space-y-1">
                            {[
                                { ok: passwords.newPass.length >= 8,   label: t('profile.passwordMinLength') },
                                { ok: /[A-Z]/.test(passwords.newPass), label: t('profile.passwordUppercase')  },
                                { ok: /[0-9]/.test(passwords.newPass), label: t('profile.passwordNumber')     },
                            ].map(({ ok, label }) => (
                                <div key={label} className={`flex items-center gap-2 text-xs ${ok ? 'text-emerald-400' : 'text-slate-500'}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                                    {label}
                                </div>
                            ))}
                        </div>
                    )}

                    <button type="submit" disabled={savingPw || !passwords.current || !passwords.newPass || !passwords.confirm}
                            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all flex items-center justify-center gap-2">
                        {savingPw
                            ? <><Loader2 className="w-4 h-4 animate-spin" />{t('profile.updating')}</>
                            : <><Shield className="w-4 h-4" />{t('profile.updatePassword')}</>}
                    </button>
                </form>

                {/* Sign out all devices */}
                <div className={`${cardClass} mt-4 profile-content`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                {t('profile.signOutAllDevices') || 'Sign out of all devices'}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                {t('profile.signOutAllDevicesDesc') || 'Invalidates all active sessions on every device.'}
                            </p>
                        </div>
                        <button onClick={handleLogoutAll}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium transition-all border border-red-500/20 ml-4 whitespace-nowrap">
                            <LogOut className="w-4 h-4" />
                            {t('profile.signOutAll') || 'Sign out all'}
                        </button>
                    </div>
                </div>
                </>
            )}

            {/* Tab: Language */}
            {activeTab === 'language' && (
                <div className={`${cardClass} space-y-5 profile-content`}>
                    <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{t('profile.language')}</h2>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('profile.languageDescription')}</p>

                    <div className="space-y-2">
                        {LANGUAGES.map(lang => (
                            <button key={lang.code} onClick={() => setForm({ ...form, language: lang.code })}
                                    className="w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left"
                                    style={{
                                        background: form.language === lang.code ? 'rgba(37,99,235,0.1)' : 'var(--bg-input)',
                                        borderColor: form.language === lang.code ? 'rgba(59,130,246,0.5)' : 'var(--border-input)',
                                        color: 'var(--text-primary)',
                                    }}>
                                <span className="text-2xl">{lang.flag}</span>
                                <span className="font-medium">{lang.label}</span>
                                {form.language === lang.code && <Check className="w-4 h-4 text-blue-400 ml-auto" />}
                            </button>
                        ))}
                    </div>

                    <button onClick={handleSaveProfile} disabled={saving}
                            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2">
                        {saving
                            ? <><Loader2 className="w-4 h-4 animate-spin" />{t('profile.saving')}</>
                            : <><Check className="w-4 h-4" />{t('profile.save')}</>}
                    </button>
                </div>
            )}

            {/* Tab: Do Not Disturb */}
            {activeTab === 'dnd' && (
                <div className="space-y-4">
                    <div className="p-5 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                        <div className="flex items-center gap-3 mb-4">
                            {dndUntil ? (
                                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                    <BellOff className="w-5 h-5 text-amber-400" />
                                </div>
                            ) : (
                                <div className="w-10 h-10 rounded-xl bg-slate-700/50 flex items-center justify-center">
                                    <Bell className="w-5 h-5 text-slate-400" />
                                </div>
                            )}
                            <div>
                                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                                    Do Not Disturb
                                </p>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                    {dndUntil
                                        ? `Active until ${dndUntil.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`
                                        : 'Silence all notifications'}
                                </p>
                            </div>
                            {dndUntil && (
                                <button onClick={disableDnd}
                                        className="ml-auto text-xs text-red-400 hover:text-red-300 border border-red-500/30 px-3 py-1.5 rounded-lg transition-all">
                                    Disable
                                </button>
                            )}
                        </div>

                        {!dndUntil && (
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { label: '30 minutes', minutes: 30 },
                                    { label: '1 hour',     minutes: 60 },
                                    { label: '2 hours',    minutes: 120 },
                                    { label: '4 hours',    minutes: 240 },
                                    { label: 'Until tomorrow', minutes: 24*60 },
                                    { label: 'All day',    minutes: 8*60 },
                                ].map(opt => (
                                    <button key={opt.minutes}
                                            onClick={() => enableDnd(opt.minutes)}
                                            className="py-3 px-4 rounded-xl text-sm font-medium border transition-all text-left hover:border-blue-500/40 hover:bg-blue-500/5"
                                            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}>
                                        🔕 {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-4 rounded-xl border text-xs" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-muted)', background: 'var(--bg-card)' }}>
                        When Do Not Disturb is active, message and notification sounds are silenced.
                        Calls are still shown but without sound.
                    </div>
                </div>
            )}
        </div>
    )
}
