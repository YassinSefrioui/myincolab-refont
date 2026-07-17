import { useEffect, useState, useRef } from 'react'
import { Megaphone, Plus, X, Loader2, Paperclip, Download, Trash2, Globe, Building2,
    AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../api/axios'
import useAuthStore from '../store/authStore'
import { getAvatarUrl } from '../utils/avatarUrl'
import toast from 'react-hot-toast'
import gsap from 'gsap'

// ── Urgency config ─────────────────────────────────────────────────────────────
const URGENCY = {
    HIGH:   { label: 'HIGH',   icon: AlertCircle,   color: 'text-red-400',    bg: 'bg-red-500/15',    border: 'border-red-500/30',    dot: 'bg-red-400'    },
    MEDIUM: { label: 'MEDIUM', icon: AlertTriangle,  color: 'text-orange-400', bg: 'bg-orange-500/15', border: 'border-orange-500/30', dot: 'bg-orange-400' },
    LOW:    { label: 'LOW',    icon: Info,           color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20',  dot: 'bg-green-400'  },
}

export default function AnnouncementsPage() {
    const { t } = useTranslation()
    const { user } = useAuthStore()
    const pageRef  = useRef(null)
    const [searchParams] = useSearchParams()
    const highlightId = Number(searchParams.get('announcementId')) || null
    const [announcements, setAnnouncements] = useState([])
    const [loading, setLoading]             = useState(true)
    const [showModal, setShowModal]         = useState(false)
    const [isGlobalModal, setIsGlobalModal] = useState(false)
    const [form, setForm]                   = useState({ title: '', content: '', urgencyLevel: 'LOW' })
    const [file, setFile]                   = useState(null)
    const [posting, setPosting]             = useState(false)
    const [allGroups, setAllGroups]         = useState([])
    const [targetGroupIds, setTargetGroupIds] = useState([])
    const fileRef                           = useRef(null)

    useEffect(() => {
        api.get('/groups/root').then(r => setAllGroups(r.data.data || [])).catch(() => {})
    }, [])

    useEffect(() => {
        if (!pageRef.current) return
        const ctx = gsap.context(() => {
            gsap.fromTo(pageRef.current,
                { opacity: 0, y: 20 },
                { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }
            )
            // Stagger cards
            const cards = pageRef.current.querySelectorAll('.anim-card, [class*="rounded-2xl"][class*="border"]')
            if (cards.length) {
                gsap.fromTo(cards,
                    { opacity: 0, y: 18, scale: 0.96 },
                    { opacity: 1, y: 0, scale: 1, duration: 0.4, stagger: 0.06, delay: 0.15, ease: 'back.out(1.2)', clearProps: 'transform' }
                )
            }
            // Stagger rows
            const rows = pageRef.current.querySelectorAll('.anim-row, [class*="divide-y"] > div, table tbody tr')
            if (rows.length) {
                gsap.fromTo(rows,
                    { opacity: 0, x: -10 },
                    { opacity: 1, x: 0, duration: 0.25, stagger: 0.03, delay: 0.2, ease: 'power2.out', clearProps: 'transform' }
                )
            }
            // FABs
            const fabs = pageRef.current.querySelectorAll('button[class*="fixed"], .anim-fab')
            if (fabs.length) {
                gsap.fromTo(fabs,
                    { opacity: 0, scale: 0, y: 20 },
                    { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'back.out(2.5)', delay: 0.3 }
                )
            }
        }, pageRef)
        return () => ctx.revert()
    }, [])

    const isAdmin      = user?.role === 'ADMIN'
    const isSuperAdmin = user?.role === 'SUPER_ADMIN'
    const canPost      = isAdmin || isSuperAdmin
    const userId       = user?.id || user?.userId

    const fetchAnnouncements = async () => {
        try {
            const res = await api.get('/announcements')
            setAnnouncements(res.data.data || [])
        } catch { toast.error('Failed to load announcements') }
        finally { setLoading(false) }
    }
    useEffect(() => { fetchAnnouncements() }, [])

    useEffect(() => {
        if (!highlightId || loading) return
        const el = document.getElementById(`ann-${highlightId}`)
        if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)
    }, [highlightId, loading])

    const globalAnn  = announcements.filter(a => a.isGlobal)
    const companyAnn = announcements.filter(a => !a.isGlobal)

    const openModal = (global) => {
        setIsGlobalModal(global)
        setForm({ title: '', content: '', urgencyLevel: 'LOW' })
        setFile(null)
        setTargetGroupIds([])
        setShowModal(true)
    }

    const handlePost = async e => {
        e.preventDefault()
        if (!form.title.trim() || !form.content.trim()) return
        setPosting(true)
        try {
            const fd = new FormData()
            fd.append('title', form.title)
            fd.append('content', form.content)
            fd.append('urgencyLevel', form.urgencyLevel)
            if (file) fd.append('file', file)
            if (!isGlobalModal && targetGroupIds.length > 0) {
                targetGroupIds.forEach(id => fd.append('targetGroupIds', id))
            }
            const endpoint = isGlobalModal ? '/announcements/global' : '/announcements'
            await api.post(endpoint, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
            toast.success(isGlobalModal ? 'Global announcement posted!' : 'Announcement posted!')
            setShowModal(false)
            fetchAnnouncements()
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to post') }
        finally { setPosting(false) }
    }

    const handleDelete = async id => {
        if (!confirm('Delete this announcement?')) return
        try {
            await api.delete(`/announcements/${id}`)
            toast.success('Deleted')
            setAnnouncements(prev => prev.filter(a => a.id !== id))
        } catch { toast.error('Failed to delete') }
    }

    const handleDownloadAttachment = async ann => {
        try {
            const res = await api.get(`/announcements/${ann.id}/download`, { responseType: 'blob' })
            const url = URL.createObjectURL(res.data)
            const a   = document.createElement('a')
            a.href     = url
            a.download = ann.fileName || 'attachment'
            document.body.appendChild(a); a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        } catch { toast.error('Download failed') }
    }

    const formatDate = dt => new Date(dt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

    if (loading) return (
        <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
        </div>
    )

    return (
        <div ref={pageRef} className="p-6 max-w-3xl mx-auto space-y-8 min-h-full">

            {/* ── Header ──────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <Megaphone className="w-6 h-6 text-amber-400" /> {t('announcements.title')}
                    </h1>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {t('announcements.subtitle')}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {isAdmin && (
                        <button onClick={() => openModal(false)}
                                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-amber-500/20">
                            <Plus className="w-4 h-4" /> Company Announcement
                        </button>
                    )}
                    {isSuperAdmin && (
                        <button onClick={() => openModal(true)}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-600/20">
                            <Globe className="w-4 h-4" /> INCOLAB Announcement
                        </button>
                    )}
                </div>
            </div>

            {/* ── INCOLAB Global ────────────────────────────────────── */}
            <section>
                <div className="flex items-center gap-2 mb-3">
                    <Globe className="w-4 h-4 text-blue-400" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-blue-400">{t('announcements.incollabPlatform')}</h2>
                    <div className="flex-1 h-px" style={{ background: 'var(--border-primary)' }} />
                </div>
                {globalAnn.length === 0 ? (
                    <div className="text-center py-8 rounded-2xl border border-dashed" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-muted)' }}>
                        <Globe className="w-8 h-8 mx-auto mb-2 opacity-20" />
                        <p className="text-sm">{t('announcements.noGlobalAnnouncements')}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {globalAnn.map(ann => (
                            <div key={ann.id} id={`ann-${ann.id}`}
                                 className={`rounded-2xl transition-all duration-500 ${highlightId === ann.id ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-transparent' : ''}`}>
                                <AnnouncementCard ann={ann} isGlobal={true}
                                                  canDelete={isSuperAdmin || String(ann.createdBy?.id) === String(userId)} onDelete={handleDelete}
                                                  onDownload={handleDownloadAttachment} formatDate={formatDate} />
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* ── Company Announcements ─────────────────────────────── */}
            <section>
                <div className="flex items-center gap-2 mb-3">
                    <Building2 className="w-4 h-4 text-amber-400" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400">
                        {user?.companyName || t('announcements.company')}
                    </h2>
                    <div className="flex-1 h-px" style={{ background: 'var(--border-primary)' }} />
                </div>
                {companyAnn.length === 0 ? (
                    <div className="text-center py-8 rounded-2xl border border-dashed" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-muted)' }}>
                        <Megaphone className="w-8 h-8 mx-auto mb-2 opacity-20" />
                        <p className="text-sm">{t('announcements.noCompanyAnnouncements')}</p>
                        {isAdmin && (
                            <button onClick={() => openModal(false)} className="mt-3 text-sm text-amber-400 hover:text-amber-300 transition-colors">
                                {t('announcements.postTheFirstOne')}
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {companyAnn.map(ann => (
                            <div key={ann.id} id={`ann-${ann.id}`}
                                 className={`rounded-2xl transition-all duration-500 ${highlightId === ann.id ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-transparent' : ''}`}>
                                <AnnouncementCard ann={ann} isGlobal={false}
                                                  canDelete={isAdmin || isSuperAdmin || String(ann.createdBy?.id) === String(userId)} onDelete={handleDelete}
                                                  onDownload={handleDownloadAttachment} formatDate={formatDate} />
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* ── Create Modal ─────────────────────────────────────────── */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="rounded-2xl w-full max-w-lg shadow-2xl border max-h-[90vh] overflow-y-auto"
                         style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                        <div className="flex items-center justify-between p-6" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                            <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                {isGlobalModal
                                    ? <><Globe className="w-5 h-5 text-blue-400" /> {t('announcements.newIncollabAnnouncement')}</>
                                    : <><Megaphone className="w-5 h-5 text-amber-400" /> {t('announcements.newCompanyAnnouncement')}</>
                                }
                            </h2>
                            <button onClick={() => setShowModal(false)} style={{ color: 'var(--text-secondary)' }} className="hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {isGlobalModal && (
                            <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                <p className="text-xs text-blue-300 flex items-center gap-1.5">
                                    <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                                    {t('announcements.visibleToAllCompanies')}
                                </p>
                            </div>
                        )}

                        <form onSubmit={handlePost} className="p-6 space-y-4">
                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('announcements.titleLabel')}</label>
                                <input required value={form.title}
                                       onChange={e => setForm({ ...form, title: e.target.value })}
                                       placeholder={t('announcements.announcementTitle')}
                                       className="w-full rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                       style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }} />
                            </div>

                            {/* Urgency Level */}
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                    {t('announcements.urgencyLevel')}
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {Object.entries(URGENCY).map(([key, cfg]) => {
                                        const Icon = cfg.icon
                                        const isSelected = form.urgencyLevel === key
                                        return (
                                            <button key={key} type="button"
                                                    onClick={() => setForm({ ...form, urgencyLevel: key })}
                                                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                                                        isSelected
                                                            ? `${cfg.bg} ${cfg.border} ${cfg.color}`
                                                            : 'border-slate-600 text-slate-400 hover:border-slate-500'
                                                    }`}>
                                                <Icon className="w-3.5 h-3.5" />
                                                {key}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Content */}
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('announcements.message')}</label>
                                <textarea required rows={5} value={form.content}
                                          onChange={e => setForm({ ...form, content: e.target.value })}
                                          placeholder={t('announcements.writeAnnouncementHere')}
                                          className="w-full rounded-xl py-2.5 px-4 text-sm focus:outline-none resize-none"
                                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }} />
                            </div>

                            {/* Attachment */}
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                    {t('announcements.attachment')} <span className="font-normal" style={{ color: 'var(--text-muted)' }}>{t('announcements.optional')}</span>
                                </label>
                                {file ? (
                                    <div className="flex items-center gap-2 p-3 rounded-xl border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-input)' }}>
                                        <Paperclip className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                        <span className="text-sm truncate flex-1" style={{ color: 'var(--text-primary)' }}>{file.name}</span>
                                        <button type="button" onClick={() => setFile(null)} className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed cursor-pointer transition-all"
                                           style={{ borderColor: 'var(--border-input)', color: 'var(--text-muted)' }}>
                                        <Paperclip className="w-4 h-4" />
                                        <span className="text-sm">{t('announcements.clickToAttachFile')}</span>
                                        <input ref={fileRef} type="file" className="hidden" onChange={e => setFile(e.target.files[0] || null)} />
                                    </label>
                                )}
                            </div>

                            {/* Target groups */}
                            {!isGlobalModal && allGroups.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                        {t('announcements.targetGroups')} <span className="font-normal" style={{ color: 'var(--text-muted)' }}>{t('announcements.emptyEntireCompany')}</span>
                                    </label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {allGroups.map(g => (
                                            <button key={g.id} type="button"
                                                    onClick={() => setTargetGroupIds(prev =>
                                                        prev.includes(g.id) ? prev.filter(id => id !== g.id) : [...prev, g.id]
                                                    )}
                                                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${targetGroupIds.includes(g.id) ? 'bg-amber-500 border-amber-400 text-white' : 'border-slate-600 text-slate-400 hover:border-amber-500/50'}`}>
                                                {g.name}
                                            </button>
                                        ))}
                                    </div>
                                    {targetGroupIds.length > 0 && (
                                        <p className="text-xs mt-1.5 text-amber-400">
                                            Visible only to members of {targetGroupIds.length} selected group(s)
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)}
                                        className="flex-1 py-2.5 rounded-xl text-sm transition-all border"
                                        style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={posting}
                                        className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 text-white ${
                                            isGlobalModal ? 'bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900' : 'bg-amber-500 hover:bg-amber-400 disabled:bg-amber-900'
                                        }`}>
                                    {posting ? <><Loader2 className="w-4 h-4 animate-spin" />{t('announcements.posting')}</> : isGlobalModal ? <>📣 {t('announcements.postToAll')}</> : <>📢 {t('announcements.postAnnouncement')}</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Announcement Card ──────────────────────────────────────────────────────────

function AnnouncementCard({ ann, isGlobal, canDelete, onDelete, onDownload, formatDate }) {
    const urgency = URGENCY[ann.urgencyLevel] || URGENCY.LOW
    const UrgencyIcon = urgency.icon

    return (
        <div className="rounded-2xl border transition-all overflow-hidden"
             style={{ background: 'var(--bg-card)', borderColor: isGlobal ? 'rgba(59,130,246,0.25)' : 'var(--border-primary)' }}>

            {/* Urgency header bar */}
            <div className={`flex items-center gap-2 px-4 py-2 ${urgency.bg} border-b ${urgency.border}`}>
                <UrgencyIcon className={`w-3.5 h-3.5 ${urgency.color} flex-shrink-0`} />
                <span className={`text-xs font-bold tracking-wider ${urgency.color}`}>
                    {ann.urgencyLevel || 'LOW'} PRIORITY
                </span>
                {isGlobal && (
                    <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20 font-medium flex items-center gap-1">
                        <Globe className="w-2.5 h-2.5" /> INCOLAB
                    </span>
                )}
            </div>

            <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                        {ann.createdBy?.profilePhotoUrl ? (
                            <img src={getAvatarUrl(ann.createdBy)} className="w-9 h-9 rounded-full object-cover flex-shrink-0" alt="" />
                        ) : (
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isGlobal ? 'bg-blue-500/20' : 'bg-amber-500/20'}`}>
                                <span className={`font-bold text-sm ${isGlobal ? 'text-blue-400' : 'text-amber-400'}`}>
                                    {ann.createdBy?.fullName?.charAt(0)}
                                </span>
                            </div>
                        )}
                        <div className="min-w-0">
                            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{ann.createdBy?.fullName}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(ann.createdAt)}</p>
                        </div>
                    </div>
                    {canDelete && (
                        <button onClick={() => onDelete(ann.id)}
                                className="p-1.5 rounded-lg flex-shrink-0 transition-all hover:bg-red-500/10 hover:text-red-400"
                                style={{ color: 'var(--text-muted)' }}>
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
                <h2 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{ann.title}</h2>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{ann.content}</p>
                {ann.fileName && (
                    <button onClick={() => onDownload(ann)}
                            className="mt-3 flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 border border-blue-500/20 hover:border-blue-400/40 bg-blue-500/5 px-3 py-2 rounded-xl transition-all w-full">
                        <Paperclip className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate flex-1 text-left">{ann.fileName}</span>
                        <Download className="w-3.5 h-3.5 flex-shrink-0" />
                    </button>
                )}
                {ann.targetGroups?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                        {ann.targetGroups.map(g => (
                            <span key={g.id} className="text-xs px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-400">
                                {g.name}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
