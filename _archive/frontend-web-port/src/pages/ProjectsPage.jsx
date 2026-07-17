import SearchableSelect from '../components/SearchableSelect'
import UserProfileModal from '../components/UserProfileModal'
import FilePreviewModal from '../components/FilePreviewModal'
import { useEffect, useState, useRef } from 'react'

const getMediaUrl = (url) => {
    if (!url) return url
    const token = localStorage.getItem('token')
    if (!token) return url
    const sep = url.includes('?') ? '&' : '?'
    return `${url}${sep}t=${token}`
}
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import {
    FolderOpen, Plus, Users, Calendar, X, Loader2, Upload, Download,
    FileText, Star, Eye, AlertTriangle, BookOpen, Search,
    MessageSquare, Send, Pin, Trash2, CheckSquare, Flag,
    Paperclip, Languages, AtSign, GitBranch, Archive, RotateCcw, ChevronRight, Volume2, Copy
} from 'lucide-react'
import VoiceChannelsPanel from '../components/VoiceChannelsPanel'
import { useTranslation } from 'react-i18next'
import gsap from 'gsap'
import api from '../api/axios'
import useAuthStore from '../store/authStore'
import toast from 'react-hot-toast'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { getAvatarUrl } from '../utils/avatarUrl'

const LANG_CODE = { en:'en',fr:'fr',es:'es',zh:'zh',it:'it', EN:'en',FR:'fr',ES:'es',ZH:'zh',IT:'it' }

async function translateText(text, targetLang) {
    const lang = LANG_CODE[targetLang] || 'en'
    try {
        const res  = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${lang}`)
        const data = await res.json()
        if (data.responseStatus === 200 && data.responseData?.translatedText) return data.responseData.translatedText
        throw new Error()
    } catch {
        const res  = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(text)}`)
        const data = await res.json()
        const t    = data?.[0]?.map(i => i?.[0]).filter(Boolean).join('')
        if (t) return t
        throw new Error('Translation failed')
    }
}

export default function ProjectsPage() {
    const { t } = useTranslation()
    const location = useLocation()
    const navigate = useNavigate()
    const [projects, setProjects] = useState([])
    const [loading, setLoading]   = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [creating, setCreating]  = useState(false)
    const [selected, setSelected]  = useState(null)
    const [form, setForm] = useState({ name: '', description: '', startDate: '', endDate: '', linkedProjectId: '' })
    const [initialMembers, setInitialMembers] = useState([])
    const [allUsers, setAllUsers] = useState([])
    const [allGroups, setAllGroups] = useState([])
    useEffect(() => { api.get('/users/search').then(r => setAllUsers(r.data.data || [])).catch(() => {}) }, [])
    useEffect(() => { api.get('/groups').then(r => setAllGroups(r.data.data || [])).catch(() => {}) }, [])

    const containerRef    = useRef(null)
    const wasSelectedRef  = useRef(false)   // tracks if a project was open (for browser-back refetch)

    useEffect(() => {
        if (loading) return
        const ctx = gsap.context(() => {
            gsap.fromTo('.projects-header',
                { opacity: 0, y: -24, scale: 0.97 },
                { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'power3.out', clearProps: 'transform' }
            )
            gsap.fromTo('.project-card',
                { opacity: 0, y: 28, scale: 0.92, rotateX: 8 },
                { opacity: 1, y: 0, scale: 1, rotateX: 0, duration: 0.5, stagger: 0.07, delay: 0.1,
                    ease: 'back.out(1.3)', clearProps: 'transform' }
            )
            gsap.fromTo('.projects-fab',
                { opacity: 0, scale: 0, y: 20 },
                { opacity: 1, scale: 1, y: 0, duration: 0.45, delay: 0.25, ease: 'back.out(2.5)' }
            )
            // Project stat badges count-up
            document.querySelectorAll('.project-card .stat-value').forEach(el => {
                const target = parseInt(el.textContent, 10) || 0
                if (target > 0) {
                    gsap.from(el, { textContent: 0, duration: 0.8, delay: 0.4, ease: 'power2.out', snap: { textContent: 1 } })
                }
            })
        }, containerRef)
        return () => ctx.revert()
    }, [loading])

    const fetchProjects = async () => {
        try { const res = await api.get('/projects'); setProjects(res.data.data || []) }
        catch { toast.error(t('errors.failedToLoadProjects')) }
        finally { setLoading(false) }
    }
    useEffect(() => { fetchProjects() }, [])

    const [autoTab,         setAutoTab]         = useState(null)
    const [autoTaskId,      setAutoTaskId]      = useState(null)
    const [autoCreateTask,  setAutoCreateTask]  = useState(false)

    // ── Advanced filters ──────────────────────────────────────────────────
    // Default to ACTIVE so the dashboard isn't cluttered by archived /
    // completed projects; user can flip the chip strip to see the rest.
    const [filterStatus,     setFilterStatus]     = useState('ACTIVE')
    const [filterQuery,      setFilterQuery]      = useState('')
    const [filterStartFrom,  setFilterStartFrom]  = useState('')
    const [filterStartTo,    setFilterStartTo]    = useState('')
    const [filterEndFrom,    setFilterEndFrom]    = useState('')
    const [filterEndTo,      setFilterEndTo]      = useState('')
    const [filterManagerId,  setFilterManagerId]  = useState('')
    const [showAdvanced,     setShowAdvanced]     = useState(false)

    useEffect(() => {
        if (loading) return

        // Support location.state from global search
        const state = location.state
        if (state?.openProjectId) {
            const p = projects.find(pr => pr.id === state.openProjectId || String(pr.id) === String(state.openProjectId))
            if (p) {
                setSelected(p)
                wasSelectedRef.current = true
                if (state.openTaskId) { setAutoTab('tasks'); setAutoTaskId(state.openTaskId) }
                navigate('/projects?projectId=' + p.id, { replace: true })
                return
            }
        }

        // URL params
        const params    = new URLSearchParams(location.search)
        const projectId = params.get('projectId')
        const taskId    = params.get('taskId')
        const tab       = params.get('tab')
        const action    = params.get('action')

        if (projects.length === 0) return

        if (taskId) {
            if (tab) setAutoTab(tab)
            if (projectId) {
                const p = projects.find(pr => String(pr.id) === projectId)
                if (p) { setSelected(p); wasSelectedRef.current = true }
            } else if (projects.length > 0) { setSelected(projects[0]); wasSelectedRef.current = true }
        } else if (projectId) {
            const p = projects.find(pr => String(pr.id) === projectId)
            if (p) {
                setSelected(p)
                wasSelectedRef.current = true
                if (tab) setAutoTab(tab)
                if (action === 'create_task') setAutoCreateTask(true)
            }
        } else {
            // No project in URL — user came back (or initial load)
            if (wasSelectedRef.current) {
                wasSelectedRef.current = false
                setSelected(null)
                fetchProjects()
            }
            // Auto-open create modal when AI navigates with ?action=create
            if (action === 'create') {
                setShowModal(true)
                navigate('/projects', { replace: true })
            }
        }
    }, [loading, projects, location.search, location.state])


    const handleCreate = async e => {
        e.preventDefault(); setCreating(true)
        try {
            await api.post('/projects', { ...form, initialMembers, linkedProjectId: form.linkedProjectId || null })
            toast.success(t('errors.projectCreated'))
            setShowModal(false)
            setForm({ name:'',description:'',startDate:'',endDate:'',linkedProjectId:'' })
            setInitialMembers([])
            fetchProjects()
        } catch (err) { toast.error(err.response?.data?.message || t('errors.failedToCreateProject')) }
        finally { setCreating(false) }
    }

    const statusBadge = s => ({
        ACTIVE:    'bg-blue-500/20 text-blue-400 border-blue-500/30',
        OVERDUE:   'bg-red-500/20 text-red-400 border-red-500/30',
        COMPLETED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        ARCHIVED:  'bg-slate-500/20 text-slate-400 border-slate-500/30',
    })[s] || 'bg-blue-500/20 text-blue-400 border-blue-500/30'

    /** Returns 'OVERDUE' if the project is active but past its end date */
    const effectiveStatus = p =>
        p.status === 'ACTIVE' && p.endDate && new Date(p.endDate) < new Date()
            ? 'OVERDUE'
            : p.status

    // Manager = first MANAGER member, or fallback to createdBy.
    const getManagerId = (p) => {
        const mgr = (p.members || []).find(m => (m.role || '').toUpperCase() === 'MANAGER')
        return mgr?.user?.id || p.createdBy?.id || null
    }
    const inRange = (raw, from, to) => {
        if (!from && !to) return true
        if (!raw) return false
        const t = new Date(raw).getTime()
        if (Number.isNaN(t)) return false
        if (from && t < new Date(from).getTime()) return false
        if (to) { const end = new Date(to); end.setHours(23,59,59,999); if (t > end.getTime()) return false }
        return true
    }
    const filteredProjects = projects.filter(p => {
        if (filterStatus !== 'ALL' && effectiveStatus(p) !== filterStatus) return false
        if (filterQuery) {
            const q = filterQuery.toLowerCase()
            if (!(p.name||'').toLowerCase().includes(q) && !(p.description||'').toLowerCase().includes(q)) return false
        }
        if (!inRange(p.startDate, filterStartFrom, filterStartTo)) return false
        if (!inRange(p.endDate, filterEndFrom, filterEndTo)) return false
        if (filterManagerId && String(getManagerId(p)) !== String(filterManagerId)) return false
        return true
    })

    const statusCounts = {
        ALL:       projects.length,
        ACTIVE:    projects.filter(p => effectiveStatus(p) === 'ACTIVE').length,
        OVERDUE:   projects.filter(p => effectiveStatus(p) === 'OVERDUE').length,
        COMPLETED: projects.filter(p => effectiveStatus(p) === 'COMPLETED').length,
        ARCHIVED:  projects.filter(p => effectiveStatus(p) === 'ARCHIVED').length,
    }
    // Pre-baked class lookup — Tailwind JIT doesn't pick up dynamic `bg-${c}-500` strings.
    const STATUS_FILTERS = [
        { key: 'ACTIVE',    label: t('projects.filter.active')    || 'Active',
          active: 'bg-blue-500/20 text-blue-300 border-blue-500/40',       count: 'bg-blue-500/30' },
        { key: 'OVERDUE',   label: t('projects.filter.overdue')   || 'Overdue',
          active: 'bg-red-500/20 text-red-300 border-red-500/40',          count: 'bg-red-500/30' },
        { key: 'COMPLETED', label: t('projects.filter.completed') || 'Completed',
          active: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', count: 'bg-emerald-500/30' },
        { key: 'ARCHIVED',  label: t('projects.filter.archived')  || 'Archived',
          active: 'bg-slate-500/20 text-slate-300 border-slate-500/40',    count: 'bg-slate-500/30' },
        { key: 'ALL',       label: t('projects.filter.all')       || 'All',
          active: 'bg-violet-500/20 text-violet-300 border-violet-500/40', count: 'bg-violet-500/30' },
    ]
    const advancedCount =
        (filterQuery ? 1 : 0) +
        ((filterStartFrom || filterStartTo) ? 1 : 0) +
        ((filterEndFrom || filterEndTo) ? 1 : 0) +
        (filterManagerId ? 1 : 0)
    const resetFilters = () => {
        setFilterQuery(''); setFilterStartFrom(''); setFilterStartTo('')
        setFilterEndFrom(''); setFilterEndTo(''); setFilterManagerId('')
    }

    if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin w-8 h-8 text-blue-500" /></div>
    if (selected) return <ProjectDetail project={selected} onBack={() => navigate('/projects')} statusBadge={statusBadge} effectiveStatus={effectiveStatus} autoTab={autoTab} autoTaskId={autoTaskId} autoCreateTask={autoCreateTask} />

    return (
        <div className="p-6 space-y-6 w-full min-h-full" ref={containerRef}>
            <div className="flex items-center justify-between projects-header">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2"><FolderOpen className="w-6 h-6 text-blue-400" />{t('projects.title')}</h1>
                    <p className="text-[var(--text-secondary)] text-sm mt-1">
                        {statusCounts.ACTIVE} {t('projects.active')} · {statusCounts.OVERDUE} {t('projects.filter.overdue')?.toLowerCase() || 'overdue'}
                    </p>
                </div>
                <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-600/20 projects-fab">
                    <Plus className="w-4 h-4" /> {t('projects.new')}
                </button>
            </div>

            {/* ── Filter bar ─────────────────────────────────────────────── */}
            <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    {STATUS_FILTERS.map(f => {
                        const active = filterStatus === f.key
                        return (
                            <button
                                key={f.key}
                                onClick={() => setFilterStatus(f.key)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                                    active
                                        ? f.active
                                        : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-primary)] hover:border-[var(--border-primary-hover)]'
                                }`}
                            >
                                {f.label}
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${active ? f.count : 'bg-[var(--bg-secondary)]'}`}>
                                    {statusCounts[f.key] ?? 0}
                                </span>
                            </button>
                        )
                    })}
                    <div className="flex-1" />
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                        <input
                            value={filterQuery}
                            onChange={e => setFilterQuery(e.target.value)}
                            placeholder={t('common.search') || 'Search by name…'}
                            className="pl-8 pr-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-full text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 w-56"
                        />
                    </div>
                    <button
                        onClick={() => setShowAdvanced(v => !v)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                            (showAdvanced || advancedCount > 0)
                                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                                : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-primary)] hover:border-[var(--border-primary-hover)]'
                        }`}
                    >
                        {t('common.filters') || 'Filters'}
                        {advancedCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-500/30">{advancedCount}</span>
                        )}
                    </button>
                    {(advancedCount > 0 || filterStatus !== 'ACTIVE') && (
                        <button
                            onClick={() => { resetFilters(); setFilterStatus('ACTIVE') }}
                            className="px-3 py-1.5 rounded-full border border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs font-semibold"
                        >
                            {t('common.reset') || 'Reset'}
                        </button>
                    )}
                </div>

                {showAdvanced && (
                    <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                                {t('projects.startDate') || 'Start date'} — From
                            </label>
                            <input type="date" value={filterStartFrom} onChange={e => setFilterStartFrom(e.target.value)}
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)]" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                                {t('projects.startDate') || 'Start date'} — To
                            </label>
                            <input type="date" value={filterStartTo} onChange={e => setFilterStartTo(e.target.value)}
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)]" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                                {t('projects.endDate') || 'End date'} — From
                            </label>
                            <input type="date" value={filterEndFrom} onChange={e => setFilterEndFrom(e.target.value)}
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)]" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                                {t('projects.endDate') || 'End date'} — To
                            </label>
                            <input type="date" value={filterEndTo} onChange={e => setFilterEndTo(e.target.value)}
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)]" />
                        </div>
                        <div className="md:col-span-2 lg:col-span-4">
                            <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                                {t('projects.manager') || 'Manager'}
                            </label>
                            <select value={filterManagerId} onChange={e => setFilterManagerId(e.target.value)}
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)]">
                                <option value="">{t('common.any') || 'Any manager'}</option>
                                {allUsers.map(u => (
                                    <option key={u.id} value={u.id}>{u.fullName || u.email}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

                <p className="text-xs text-[var(--text-muted)]">
                    {filteredProjects.length} / {projects.length} {t('projects.title')?.toLowerCase() || 'projects'}
                </p>
            </div>

            {filteredProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-[var(--text-muted)]">
                    <FolderOpen className="w-16 h-16 mb-4 opacity-20" />
                    <p className="text-lg font-medium">{t('projects.noProjects')}</p>
                    <button onClick={() => setShowModal(true)} className="mt-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all"><Plus className="w-4 h-4" /> {t('projects.new')}</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProjects.map(project => (
                        <div key={project.id} onClick={() => navigate('/projects?projectId=' + project.id)}
                             className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl p-5 hover:border-blue-500/40 hover:bg-[var(--bg-card-hover)] cursor-pointer transition-all group project-card">
                            <div className="flex items-start justify-between mb-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center"><FolderOpen className="w-5 h-5 text-blue-400" /></div>
                                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${statusBadge(effectiveStatus(project))}`}>{effectiveStatus(project)}</span>
                            </div>
                            <h3 className="font-semibold text-[var(--text-primary)] mb-1 group-hover:text-blue-300 transition-colors">{project.name}</h3>
                            <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-4">{project.description || t('projects.noDescriptionProvided')}</p>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="flex -space-x-1.5">
                                        {project.members?.slice(0,4).map(m => (
                                            <div key={m.id} className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 border-2 border-[var(--bg-secondary)] flex items-center justify-center">
                                                <span className="text-white text-xs font-bold">{m.user?.fullName?.charAt(0)}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <span className="text-xs text-[var(--text-muted)]"><Users className="w-3 h-3 inline mr-1" />{project.members?.length}</span>
                                </div>
                                {project.endDate && <div className={`flex items-center gap-1 text-xs ${effectiveStatus(project) === 'OVERDUE' ? 'text-red-400 font-semibold' : 'text-[var(--text-muted)]'}`}><Calendar className="w-3 h-3" />{new Date(project.endDate).toLocaleDateString()}</div>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && createPortal(
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
                    <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-[var(--border-primary)] flex-shrink-0">
                            <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t('projects.new')}</h2>
                            <button onClick={() => setShowModal(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4 overflow-y-auto">
                            <div><label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">{t('projects.projectName')}</label>
                                <input type="text" required value={form.name} onChange={e => setForm({...form,name:e.target.value})} placeholder={t('projects.projectNamePlaceholder')}
                                       className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl py-2.5 px-4 text-white placeholder-[var(--text-placeholder)] focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" /></div>
                            <div><label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">{t('projects.description')}</label>
                                <textarea rows={3} value={form.description} onChange={e => setForm({...form,description:e.target.value})} placeholder={t('projects.descriptionPlaceholder')}
                                          className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl py-2.5 px-4 text-white placeholder-[var(--text-placeholder)] focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none" /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">{t('projects.startDate')}</label>
                                    <input type="date" value={form.startDate} onChange={e => setForm({...form,startDate:e.target.value})}
                                           className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" /></div>
                                <div><label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">{t('projects.endDate')}</label>
                                    <input type="date" value={form.endDate} onChange={e => setForm({...form,endDate:e.target.value})}
                                           className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" /></div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Link to Previous Project <span className="text-[var(--text-muted)] font-normal">(optional)</span></label>
                                <SearchableSelect
                                    options={projects.map(p => ({ value: p.id, label: p.name, sublabel: p.status }))}
                                    value={form.linkedProjectId}
                                    onChange={v => setForm({...form, linkedProjectId: v || ''})}
                                    placeholder="None — independent project"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Add Groups <span className="text-[var(--text-muted)] font-normal">(optional — adds all group members)</span></label>
                                <SearchableSelect
                                    options={allGroups.map(g => ({ value: g.id, label: g.name, sublabel: `${g.members?.length ?? 0} members` }))}
                                    value=""
                                    onChange={async gid => {
                                        if (!gid) return
                                        try {
                                            const res = await api.get(`/groups/${gid}`)
                                            const grpMembers = res.data.data?.members || []
                                            const toAdd = grpMembers
                                                .filter(m => !initialMembers.find(im => im.userId === m.id))
                                                .map(m => ({ userId: m.id, role: 'EMPLOYEE' }))
                                            if (toAdd.length) setInitialMembers(prev => [...prev, ...toAdd])
                                            else toast(`All members of this group are already added.`)
                                        } catch { toast.error('Failed to load group members') }
                                    }}
                                    placeholder="Select a group to bulk-add its members..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Add Members <span className="text-[var(--text-muted)] font-normal">(optional)</span></label>
                                <SearchableSelect
                                    options={allUsers.filter(u => !initialMembers.find(m => m.userId === u.id)).map(u => ({ value: u.id, label: u.fullName, sublabel: u.email }))}
                                    value=""
                                    onChange={uid => { if (uid) setInitialMembers(prev => [...prev, { userId: uid, role: 'EMPLOYEE' }]) }}
                                    placeholder="Search users to add..."
                                />
                                {initialMembers.length > 0 && (
                                    <div className="mt-2 space-y-1.5">
                                        {initialMembers.map((m, i) => {
                                            const u = allUsers.find(u => u.id === m.userId)
                                            return (
                                                <div key={m.userId} className="flex items-center gap-2 p-2 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg">
                                                    <div className="w-6 h-6 rounded-full bg-blue-600/30 flex items-center justify-center flex-shrink-0">
                                                        <span className="text-blue-400 text-xs font-bold">{u?.fullName?.charAt(0)}</span>
                                                    </div>
                                                    <span className="text-sm text-[var(--text-primary)] flex-1 truncate">{u?.fullName}</span>
                                                    <select value={m.role}
                                                            onChange={e => setInitialMembers(prev => prev.map((x,j) => j===i ? {...x, role: e.target.value} : x))}
                                                            className="text-xs bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg px-2 py-1 focus:outline-none">
                                                        <option value="EMPLOYEE">Employee</option>
                                                        <option value="MANAGER">Manager</option>
                                                    </select>
                                                    <button type="button" onClick={() => setInitialMembers(prev => prev.filter((_,j)=>j!==i))}
                                                            className="text-[var(--text-muted)] hover:text-red-400 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => { setShowModal(false); setInitialMembers([]) }} className="flex-1 py-2.5 rounded-xl border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm transition-all">{t('common.cancel')}</button>
                                <button type="submit" disabled={creating} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium text-sm transition-all flex items-center justify-center gap-2">
                                    {creating ? <><Loader2 className="w-4 h-4 animate-spin" />Creating...</> : `${t('common.create')} Project`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}

// ─── Project Detail ───────────────────────────────────────────────────────────

function ProjectDetail({ project, onBack, statusBadge, effectiveStatus, autoTab, autoTaskId, autoCreateTask }) {
    const { user } = useAuthStore()
    const [tab, setTab]     = useState(autoTab || 'tasks')
    const [members, setMembers] = useState(project.members || [])
    const [users, setUsers]     = useState([])
    const [memberForm, setMemberForm] = useState({ userId: '', role: 'EMPLOYEE' })
    const [addingMember, setAddingMember] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [editForm, setEditForm] = useState({ name: project.name, description: project.description || '', startDate: project.startDate || '', endDate: project.endDate || '' })
    const [saving, setSaving] = useState(false)
    const [availableGroups, setAvailableGroups] = useState([])
    const [availableUsers, setAvailableUsers] = useState([])
    const [pendingMembers, setPendingMembers] = useState([])   // members to add on save

    const globalManagerOrAdmin = user?.role === 'MANAGER' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
    const projectRole = members.find(m => m.user?.id === user?.id)?.role
    const isCreator = String(project.createdBy?.id) === String(user?.id)
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
    // Edit / Archive / Delete: ONLY creator or ADMIN
    const canManageProject = isAdmin || isCreator
    // Add/remove members, manage tasks: creator, ADMIN, or project MANAGER role
    const isManagerOrAdmin = globalManagerOrAdmin || projectRole === 'MANAGER' || isCreator

    useEffect(() => { api.get('/users/search').then(r => setUsers(r.data.data || [])).catch(() => {}) }, [])
    useEffect(() => {
        if (!showEditModal) { setPendingMembers([]); return }
        api.get('/users/search').then(r => setAvailableUsers(r.data.data || [])).catch(() => {})
        api.get('/groups').then(r => setAvailableGroups(r.data.data || [])).catch(() => {})
    }, [showEditModal])

    const handleAddMember = async e => {
        e.preventDefault(); setAddingMember(true)
        try {
            await api.post(`/projects/${project.id}/members`, { userId: parseInt(memberForm.userId), role: memberForm.role })
            toast.success('Member added!')
            const res = await api.get(`/projects/${project.id}`)
            setMembers(res.data.data?.members || [])
            setMemberForm({ userId: '', role: 'EMPLOYEE' })
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to add member') }
        finally { setAddingMember(false) }
    }

    const handleSaveEdit = async e => {
        e.preventDefault(); setSaving(true)
        try {
            await api.put(`/projects/${project.id}`, editForm)
            // Bulk-add any pending members (from groups or individual picks)
            const existingIds = new Set(members.map(m => m.user?.id))
            for (const pm of pendingMembers) {
                if (!existingIds.has(pm.userId)) {
                    try { await api.post(`/projects/${project.id}/members`, { userId: pm.userId, role: pm.role }) }
                    catch { /* skip duplicates / errors silently */ }
                }
            }
            toast.success('Project updated!')
            setShowEditModal(false)
            setPendingMembers([])
            // Refresh members list
            const res = await api.get(`/projects/${project.id}`)
            setMembers(res.data.data?.members || [])
            // Update local display
            project.name = editForm.name
            project.description = editForm.description
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to update') }
        finally { setSaving(false) }
    }

    const handleComplete = async () => {
        if (!window.confirm('Mark this project as Completed? You can still view it but it will no longer be Active.')) return
        try { await api.patch(`/projects/${project.id}/complete`); toast.success('Project marked as completed!'); onBack() }
        catch { toast.error('Failed to complete project') }
    }

    const handleArchive = async () => {
        try { await api.patch(`/projects/${project.id}/archive`); toast.success('Project archived'); onBack() }
        catch { toast.error('Failed to archive') }
    }

    const handleDeleteProject = async () => {
        if (!window.confirm('Delete this project permanently? All tasks, files, conversations and data will be deleted. This cannot be undone.')) return
        try { await api.delete(`/projects/${project.id}`); toast.success('Project deleted'); onBack() }
        catch (err) {
            // If the soft delete failed and the user is an admin, offer force-delete.
            const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
            const status  = err?.response?.status
            if (isAdmin && (status === 409 || status === 500)) {
                if (window.confirm('Delete failed. Force-delete this project and all related data as admin?')) {
                    try {
                        await api.delete(`/projects/${project.id}?force=true`)
                        toast.success('Project force-deleted')
                        onBack()
                        return
                    } catch { toast.error('Force-delete also failed') }
                }
            } else {
                toast.error(err?.response?.data?.message || 'Failed to delete project')
            }
        }
    }

    const handleForceDeleteProject = async () => {
        if (!window.confirm('ADMIN: Force-delete this project? This bypasses ownership checks and removes all tasks, files, decisions, issues, calendar events, conversations and guest codes. Cannot be undone.')) return
        try { await api.delete(`/projects/${project.id}?force=true`); toast.success('Project force-deleted'); onBack() }
        catch (err) { toast.error(err?.response?.data?.message || 'Failed to force-delete') }
    }

    const TABS = [
        { key: 'chat',      label: 'Chat',       icon: MessageSquare },
        { key: 'tasks',     label: 'Tasks',      icon: CheckSquare   },
        { key: 'files',     label: 'Files',      icon: FileText      },
        { key: 'decisions', label: 'Decisions',  icon: BookOpen      },
        { key: 'voice',     label: 'Voice',      icon: Volume2       },
        { key: 'members',   label: 'Members',    icon: Users         },
        ...(project.linkedProjectId ? [{ key: 'inherited', label: `Hérité`, icon: GitBranch }] : []),
    ]

    return (
        <div className="flex flex-col h-full">
            <div className="p-6 border-b border-[var(--border-primary)] bg-[var(--bg-card)]">
                <div className="flex items-center gap-3 mb-4">
                    <button onClick={onBack} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm flex items-center gap-1 transition-colors">← Back</button>
                    <span className="text-[var(--text-muted)]">/</span>
                    <span className="text-[var(--text-primary)] font-medium">{project.name}</span>
                </div>
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-xl font-bold text-[var(--text-primary)]">{project.name}</h1>
                            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${statusBadge(effectiveStatus(project))}`}>{effectiveStatus(project)}</span>
                        </div>
                        <p className="text-[var(--text-secondary)] text-sm">{project.description || 'No description'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {canManageProject && project.status !== 'COMPLETED' && (
                            <button onClick={() => setShowEditModal(true)} className="text-xs text-blue-400 border border-blue-500/30 hover:bg-blue-500/10 px-3 py-1.5 rounded-lg transition-all">Edit</button>
                        )}
                        {canManageProject && (project.status === 'ACTIVE') && (
                            <button onClick={handleComplete} className="text-xs text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1">
                                ✓ Complete
                            </button>
                        )}
                        {canManageProject && project.status === 'ACTIVE' && (
                            <button onClick={handleArchive} className="text-xs text-amber-400 border border-amber-500/30 hover:bg-amber-500/10 px-3 py-1.5 rounded-lg transition-all">Archive</button>
                        )}
                        {canManageProject && (
                            <button onClick={handleDeleteProject} className="text-xs text-red-400 border border-red-500/30 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-all">Delete</button>
                        )}
                        {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
                            <button onClick={handleForceDeleteProject}
                                    className="text-xs text-red-300 bg-red-600/20 border border-red-500/50 hover:bg-red-600/30 px-3 py-1.5 rounded-lg transition-all font-semibold"
                                    title="Admin force-delete: bypass checks and remove all related data">
                                ⚠ Force delete
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex gap-1 mt-5">
                    {TABS.map(({ key, label, icon: Icon }) => (
                        <button key={key} onClick={() => setTab(key)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === key ? 'bg-blue-600 text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'}`}>
                            <Icon className="w-4 h-4" />{label}
                        </button>
                    ))}
                </div>
            </div>
            {/* Edit Project Modal */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between p-6 border-b border-slate-700">
                            <h2 className="text-lg font-semibold text-white">Edit Project</h2>
                            <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSaveEdit} className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Name *</label>
                                <input required value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})}
                                       className="w-full bg-slate-900/50 border border-slate-600/50 rounded-xl py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
                                <textarea rows={3} value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})}
                                          className="w-full bg-slate-900/50 border border-slate-600/50 rounded-xl py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Start Date</label>
                                    <input type="date" value={editForm.startDate} onChange={e => setEditForm({...editForm, startDate: e.target.value})}
                                           className="w-full bg-slate-900/50 border border-slate-600/50 rounded-xl py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">End Date</label>
                                    <input type="date" value={editForm.endDate} onChange={e => setEditForm({...editForm, endDate: e.target.value})}
                                           className="w-full bg-slate-900/50 border border-slate-600/50 rounded-xl py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                                </div>
                            </div>
                            {/* ── Add Groups ── */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Add Groups <span className="text-slate-500 font-normal">(bulk-add all group members)</span></label>
                                <SearchableSelect
                                    options={availableGroups.map(g => ({ value: g.id, label: g.name, sublabel: `${g.members?.length ?? 0} members` }))}
                                    value=""
                                    onChange={async gid => {
                                        if (!gid) return
                                        try {
                                            const res = await api.get(`/groups/${gid}`)
                                            const grpMembers = res.data.data?.members || []
                                            const existingIds = new Set([
                                                ...members.map(m => m.user?.id),
                                                ...pendingMembers.map(pm => pm.userId),
                                            ])
                                            const toAdd = grpMembers
                                                .filter(m => !existingIds.has(m.id))
                                                .map(m => ({ userId: m.id, role: 'EMPLOYEE', _name: m.fullName }))
                                            if (toAdd.length) setPendingMembers(prev => [...prev, ...toAdd])
                                            else toast(`All members of this group are already in the project.`)
                                        } catch { toast.error('Failed to load group members') }
                                    }}
                                    placeholder="Select a group..."
                                />
                            </div>
                            {/* ── Add Individual Members ── */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Add Members <span className="text-slate-500 font-normal">(individual)</span></label>
                                <SearchableSelect
                                    options={availableUsers
                                        .filter(u => !members.find(m => m.user?.id === u.id) && !pendingMembers.find(pm => pm.userId === u.id))
                                        .map(u => ({ value: u.id, label: u.fullName, sublabel: u.email }))}
                                    value=""
                                    onChange={uid => {
                                        if (!uid) return
                                        const u = availableUsers.find(u => u.id === uid)
                                        setPendingMembers(prev => [...prev, { userId: uid, role: 'EMPLOYEE', _name: u?.fullName }])
                                    }}
                                    placeholder="Search users to add..."
                                />
                                {pendingMembers.length > 0 && (
                                    <div className="mt-2 space-y-1.5">
                                        <p className="text-xs text-slate-400 mb-1">Will be added on save:</p>
                                        {pendingMembers.map((pm, i) => (
                                            <div key={pm.userId} className="flex items-center gap-2 p-2 bg-slate-900/50 border border-slate-600/50 rounded-lg">
                                                <div className="w-6 h-6 rounded-full bg-blue-600/30 flex items-center justify-center flex-shrink-0">
                                                    <span className="text-blue-400 text-xs font-bold">{pm._name?.charAt(0)}</span>
                                                </div>
                                                <span className="text-sm text-white flex-1 truncate">{pm._name}</span>
                                                <select value={pm.role}
                                                        onChange={e => setPendingMembers(prev => prev.map((x, j) => j === i ? {...x, role: e.target.value} : x))}
                                                        className="text-xs bg-slate-800 border border-slate-600 text-white rounded-lg px-2 py-1 focus:outline-none">
                                                    <option value="EMPLOYEE">Employee</option>
                                                    <option value="MANAGER">Manager</option>
                                                </select>
                                                <button type="button" onClick={() => setPendingMembers(prev => prev.filter((_, j) => j !== i))}
                                                        className="text-slate-400 hover:text-red-400 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => { setShowEditModal(false); setPendingMembers([]) }} className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:text-white text-sm transition-all">Cancel</button>
                                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium text-sm transition-all flex items-center justify-center gap-2">
                                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : `Save Changes${pendingMembers.length ? ` (+${pendingMembers.length} members)` : ''}`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className={`flex-1 ${tab === 'chat' ? 'overflow-hidden' : 'overflow-y-auto p-6'}`}>
                {tab === 'chat'      && <ProjectGroupChat project={project} />}
                {tab === 'tasks'     && <ProjectTasksTab project={project} members={members} isManagerOrAdmin={isManagerOrAdmin} autoTaskId={autoTaskId} autoCreateTask={autoCreateTask} />}
                {tab === 'files'     && <FileHub projectId={project.id} />}
                {tab === 'decisions' && <DecisionsTab projectId={project.id} isManagerOrAdmin={isManagerOrAdmin} />}
                {tab === 'voice'     && (
                    <div className="max-w-md">
                        <VoiceChannelsPanel type="PROJECT" id={project.id} defaultMode="audio" />
                    </div>
                )}
                {tab === 'members'   && <MembersTab members={members} users={users} memberForm={memberForm} setMemberForm={setMemberForm} addingMember={addingMember} handleAddMember={handleAddMember} isManagerOrAdmin={isManagerOrAdmin} canRemoveMembers={canManageProject} projectId={project.id} onMembersChange={() => api.get(`/projects/${project.id}`).then(r => setMembers(r.data.data?.members || []))} />}
                {tab === 'inherited' && <InheritedTab projectId={project.id} linkedProjectId={project.linkedProjectId} />}
            </div>
        </div>
    )
}

// ─── Issues Tab ───────────────────────────────────────────────────────────────

const SEVERITY_COLOR = {
    LOW:      'text-slate-400 bg-slate-400/10 border-slate-400/20',
    MEDIUM:   'text-amber-400 bg-amber-400/10 border-amber-400/20',
    HIGH:     'text-orange-400 bg-orange-400/10 border-orange-400/20',
    CRITICAL: 'text-red-400 bg-red-400/10 border-red-400/20',
}
const ISSUE_STATUS_COLOR = {
    OPEN:        'text-red-400 bg-red-400/10',
    IN_PROGRESS: 'text-amber-400 bg-amber-400/10',
    RESOLVED:    'text-emerald-400 bg-emerald-400/10',
    CLOSED:      'text-slate-400 bg-slate-400/10',
}

function IssuesTab({ projectId, isManagerOrAdmin }) {
    const [issues, setIssues]       = useState([])
    const [loading, setLoading]     = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [selected, setSelected]   = useState(null)
    const [creating, setCreating]   = useState(false)
    const [users, setUsers]         = useState([])
    const [form, setForm] = useState({ title: '', description: '', rootCause: '', severity: 'MEDIUM', assignedToUserId: '' })

    const fetchIssues = async () => {
        try { const res = await api.get(`/issues/project/${projectId}`); setIssues(res.data.data || []) }
        catch { toast.error('Failed to load issues') }
        finally { setLoading(false) }
    }
    useEffect(() => { fetchIssues(); api.get('/users/search').then(r => setUsers(r.data.data || [])).catch(() => {}) }, [projectId])

    const handleCreate = async e => {
        e.preventDefault(); setCreating(true)
        try {
            await api.post('/issues', { ...form, projectId, assignedToUserId: form.assignedToUserId ? parseInt(form.assignedToUserId) : null })
            toast.success('Issue logged!'); setShowModal(false)
            setForm({ title:'',description:'',rootCause:'',severity:'MEDIUM',assignedToUserId:'' }); fetchIssues()
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to create issue') }
        finally { setCreating(false) }
    }

    const handleChangeStatus = async (issueId, status) => {
        try { await api.patch(`/issues/${issueId}/status`, { status }); toast.success('Status updated'); fetchIssues(); setSelected(null) }
        catch (err) { toast.error(err.response?.data?.message || 'Failed to update status') }
    }

    const handleDelete = async id => {
        if (!confirm('Delete this issue?')) return
        try { await api.delete(`/issues/${id}`); toast.success('Issue deleted'); fetchIssues() }
        catch { toast.error('Failed to delete') }
    }

    if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin w-6 h-6 text-blue-500" /></div>

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-slate-400 text-sm">{issues.length} issues · {issues.filter(i => i.status === 'OPEN').length} open</p>
                <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 px-3 py-2 rounded-xl text-sm font-medium transition-all">
                    <Plus className="w-4 h-4" /> Log Issue
                </button>
            </div>

            {issues.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                    <AlertTriangle className="w-10 h-10 mb-3 opacity-20" />
                    <p>No issues logged — great work!</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {issues.map(issue => (
                        <div key={issue.id} onClick={() => setSelected(issue)}
                             className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 cursor-pointer hover:border-slate-600 transition-all group">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${SEVERITY_COLOR[issue.severity]}`}>{issue.severity}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ISSUE_STATUS_COLOR[issue.status]}`}>{issue.status?.replace('_',' ')}</span>
                                    </div>
                                    <p className="text-sm font-medium text-white truncate group-hover:text-blue-300 transition-colors">{issue.title}</p>
                                    {issue.description && <p className="text-xs text-slate-400 mt-1 line-clamp-1">{issue.description}</p>}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {issue.reportedBy && (
                                        <div className="w-6 h-6 rounded-full bg-slate-600/50 flex items-center justify-center" title={issue.reportedBy.fullName}>
                                            <span className="text-slate-300 text-xs font-bold">{issue.reportedBy.fullName?.charAt(0)}</span>
                                        </div>
                                    )}
                                    <span className="text-xs text-slate-500">{new Date(issue.createdAt).toLocaleDateString()}</span>
                                    {(isManagerOrAdmin || String(issue.reportedBy?.id) === String(user?.id)) && (
                                        <button onClick={e => { e.stopPropagation(); handleDelete(issue.id) }} className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-red-400 transition-all">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-slate-700">
                            <h2 className="text-lg font-semibold text-white">Log New Issue</h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Title *</label>
                                <input type="text" required value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="Brief description of the issue"
                                       className="w-full bg-slate-900/50 border border-slate-600/50 rounded-xl py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm" /></div>
                            <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
                                <textarea rows={3} value={form.description} onChange={e => setForm({...form,description:e.target.value})} placeholder="What happened?"
                                          className="w-full bg-slate-900/50 border border-slate-600/50 rounded-xl py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm resize-none" /></div>
                            <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Root Cause</label>
                                <textarea rows={2} value={form.rootCause} onChange={e => setForm({...form,rootCause:e.target.value})} placeholder="Why did this happen?"
                                          className="w-full bg-slate-900/50 border border-slate-600/50 rounded-xl py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm resize-none" /></div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Severity</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {['LOW','MEDIUM','HIGH','CRITICAL'].map(s => (
                                        <button key={s} type="button" onClick={() => setForm({...form,severity:s})}
                                                className={`py-2 rounded-xl text-xs font-medium border transition-all ${form.severity === s ? SEVERITY_COLOR[s]+' border-current' : 'bg-slate-700/50 text-slate-400 border-transparent hover:text-white'}`}>{s}</button>
                                    ))}
                                </div>
                            </div>
                            <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Assign To</label>
                                <SearchableSelect
                                    options={users.map(u => ({ value: u.id, label: u.fullName, sublabel: u.email }))}
                                    value={form.assignedToUserId}
                                    onChange={v => setForm({...form, assignedToUserId: v || ''})}
                                    placeholder="Unassigned"
                                    nullLabel="Unassigned"
                                /></div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:text-white text-sm transition-all">Cancel</button>
                                <button type="submit" disabled={creating} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-red-800 text-white font-medium text-sm transition-all flex items-center justify-center gap-2">
                                    {creating ? <><Loader2 className="w-4 h-4 animate-spin" />Logging...</> : 'Log Issue'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Issue Detail Modal */}
            {selected && (
                <IssueDetailModal issue={selected} onClose={() => setSelected(null)} onChangeStatus={handleChangeStatus} isManagerOrAdmin={isManagerOrAdmin} />
            )}
        </div>
    )
}

function IssueDetailModal({ issue, onClose, onChangeStatus, isManagerOrAdmin }) {
    const NEXT_STATUS = { OPEN: ['IN_PROGRESS'], IN_PROGRESS: ['RESOLVED'], RESOLVED: ['CLOSED'] }
    const nextStatuses = NEXT_STATUS[issue.status] || []

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between p-6 border-b border-slate-700">
                    <div className="flex-1 pr-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${SEVERITY_COLOR[issue.severity]}`}>{issue.severity}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ISSUE_STATUS_COLOR[issue.status]}`}>{issue.status?.replace('_',' ')}</span>
                        </div>
                        <h2 className="text-lg font-semibold text-white">{issue.title}</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white flex-shrink-0"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-4">
                    {issue.description && <div><p className="text-xs text-slate-500 mb-1">Description</p><p className="text-sm text-slate-300">{issue.description}</p></div>}
                    {issue.rootCause && <div><p className="text-xs text-slate-500 mb-1">Root Cause</p><p className="text-sm text-slate-300">{issue.rootCause}</p></div>}
                    {issue.correctiveAction && <div><p className="text-xs text-slate-500 mb-1">Corrective Action</p><p className="text-sm text-slate-300">{issue.correctiveAction}</p></div>}
                    <div className="grid grid-cols-2 gap-4">
                        {issue.reportedBy && <div><p className="text-xs text-slate-500 mb-1">Reported By</p><p className="text-sm text-white">{issue.reportedBy.fullName}</p></div>}
                        {issue.assignedTo && <div><p className="text-xs text-slate-500 mb-1">Assigned To</p><p className="text-sm text-white">{issue.assignedTo.fullName}</p></div>}
                        <div><p className="text-xs text-slate-500 mb-1">Created</p><p className="text-sm text-white">{new Date(issue.createdAt).toLocaleDateString()}</p></div>
                        {issue.resolvedAt && <div><p className="text-xs text-slate-500 mb-1">Resolved</p><p className="text-sm text-white">{new Date(issue.resolvedAt).toLocaleDateString()}</p></div>}
                    </div>
                    {issue.statusHistory?.length > 0 && (
                        <div>
                            <p className="text-xs text-slate-500 mb-2">Status History</p>
                            <div className="space-y-1">
                                {issue.statusHistory.map((h, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                                        <span>{h.status?.replace('_',' ')}</span>
                                        {h.changedAt && <span className="text-slate-600">— {new Date(h.changedAt).toLocaleDateString()}</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {isManagerOrAdmin && nextStatuses.length > 0 && (
                        <div className="flex gap-2 pt-2">
                            {nextStatuses.map(s => (
                                <button key={s} onClick={() => onChangeStatus(issue.id, s)}
                                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all">
                                    Mark as {s.replace('_',' ')}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ─── Decisions Tab ────────────────────────────────────────────────────────────

function DecisionsTab({ projectId, isManagerOrAdmin }) {
    const [decisions, setDecisions] = useState([])
    const [loading, setLoading]     = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [selected, setSelected]   = useState(null)
    const [creating, setCreating]   = useState(false)
    const [search, setSearch]       = useState('')
    const [form, setForm] = useState({ title: '', decision: '', rationale: '' })

    const fetchDecisions = async () => {
        try { const res = await api.get(`/decisions/project/${projectId}`); setDecisions(res.data.data || []) }
        catch { toast.error('Failed to load decisions') }
        finally { setLoading(false) }
    }
    useEffect(() => { fetchDecisions() }, [projectId])

    const handleCreate = async e => {
        e.preventDefault(); setCreating(true)
        try {
            await api.post('/decisions', { ...form, projectId })
            toast.success('Decision logged!'); setShowModal(false)
            setForm({ title:'',decision:'',rationale:'' }); fetchDecisions()
        } catch (err) { toast.error(err.response?.data?.message || 'Failed') }
        finally { setCreating(false) }
    }

    const handleSearch = async () => {
        if (!search.trim()) { fetchDecisions(); return }
        try { const res = await api.get(`/decisions/project/${projectId}/search?keyword=${encodeURIComponent(search)}`); setDecisions(res.data.data || []) }
        catch {}
    }

    if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin w-6 h-6 text-blue-500" /></div>

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" placeholder="Search decisions..." value={search}
                           onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
                           className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl py-2 pl-9 pr-4 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                {isManagerOrAdmin && (
                    <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 px-3 py-2 rounded-xl text-sm font-medium transition-all ml-auto">
                        <Plus className="w-4 h-4" /> Log Decision
                    </button>
                )}
            </div>

            {decisions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                    <BookOpen className="w-10 h-10 mb-3 opacity-20" />
                    <p>No decisions logged yet</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {decisions.map(dec => (
                        <div key={dec.id} onClick={() => setSelected(dec)}
                             className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 cursor-pointer hover:border-indigo-500/30 transition-all group">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-white mb-1 group-hover:text-indigo-300 transition-colors">{dec.title}</p>
                                    <p className="text-xs text-slate-400 line-clamp-2">{dec.decision}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    {dec.madeBy && <p className="text-xs text-slate-500">{dec.madeBy.fullName}</p>}
                                    <p className="text-xs text-slate-600 mt-0.5">{new Date(dec.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                            {dec.rationale && <p className="text-xs text-slate-500 mt-2 italic line-clamp-1">Rationale: {dec.rationale}</p>}
                            <div className="flex items-center gap-3 mt-2">
                                {dec.linkedTaskId && <span className="text-xs text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">Task #{dec.linkedTaskId}</span>}
                                {dec.linkedFileId && <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">File #{dec.linkedFileId}</span>}
                                {dec.comments?.length > 0 && <span className="text-xs text-slate-500">{dec.comments.length} comment{dec.comments.length > 1 ? 's' : ''}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-slate-700">
                            <h2 className="text-lg font-semibold text-white">Log Decision</h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Title *</label>
                                <input type="text" required value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="What was decided?"
                                       className="w-full bg-slate-900/50 border border-slate-600/50 rounded-xl py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" /></div>
                            <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Decision *</label>
                                <textarea rows={3} required value={form.decision} onChange={e => setForm({...form,decision:e.target.value})} placeholder="Describe the decision in detail..."
                                          className="w-full bg-slate-900/50 border border-slate-600/50 rounded-xl py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none" /></div>
                            <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Rationale</label>
                                <textarea rows={2} value={form.rationale} onChange={e => setForm({...form,rationale:e.target.value})} placeholder="Why was this decision made?"
                                          className="w-full bg-slate-900/50 border border-slate-600/50 rounded-xl py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none" /></div>
                            <div className="p-3 bg-indigo-600/10 border border-indigo-500/20 rounded-xl">
                                <p className="text-xs text-indigo-300">Decisions are permanent records. Once submitted, they cannot be edited.</p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:text-white text-sm transition-all">Cancel</button>
                                <button type="submit" disabled={creating} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-medium text-sm transition-all flex items-center justify-center gap-2">
                                    {creating ? <><Loader2 className="w-4 h-4 animate-spin" />Logging...</> : 'Log Decision'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Decision Detail */}
            {selected && <DecisionDetailModal decision={selected} onClose={() => setSelected(null)} onRefresh={fetchDecisions} />}
        </div>
    )
}

function DecisionDetailModal({ decision, onClose, onRefresh }) {
    const [comment, setComment] = useState('')
    const [sending, setSending] = useState(false)

    const handleComment = async e => {
        e.preventDefault(); if (!comment.trim()) return; setSending(true)
        try { await api.post(`/decisions/${decision.id}/comments`, { content: comment }); toast.success('Comment added'); setComment(''); onRefresh() }
        catch { toast.error('Failed to add comment') }
        finally { setSending(false) }
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between p-6 border-b border-slate-700">
                    <div className="flex-1 pr-4">
                        <div className="flex items-center gap-2 mb-2">
                            <BookOpen className="w-4 h-4 text-indigo-400" />
                            <span className="text-xs text-indigo-400 font-medium">Decision Log</span>
                        </div>
                        <h2 className="text-lg font-semibold text-white">{decision.title}</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white flex-shrink-0"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div><p className="text-xs text-slate-500 mb-1">Decision</p><p className="text-sm text-slate-200 leading-relaxed">{decision.decision}</p></div>
                    {decision.rationale && <div><p className="text-xs text-slate-500 mb-1">Rationale</p><p className="text-sm text-slate-300 italic">{decision.rationale}</p></div>}
                    <div className="grid grid-cols-2 gap-4">
                        {decision.madeBy && <div><p className="text-xs text-slate-500 mb-1">Made By</p><p className="text-sm text-white">{decision.madeBy.fullName}</p></div>}
                        <div><p className="text-xs text-slate-500 mb-1">Date</p><p className="text-sm text-white">{new Date(decision.createdAt).toLocaleDateString()}</p></div>
                    </div>
                    {(decision.linkedTaskId || decision.linkedFileId) && (
                        <div className="flex items-center gap-2">
                            {decision.linkedTaskId && <span className="text-xs text-blue-400 bg-blue-400/10 px-2 py-1 rounded">Linked Task #{decision.linkedTaskId}</span>}
                            {decision.linkedFileId && <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">Linked File #{decision.linkedFileId}</span>}
                        </div>
                    )}
                    {/* Comments */}
                    <div className="border-t border-slate-700 pt-4">
                        <p className="text-xs text-slate-500 mb-3">Comments ({decision.comments?.length || 0})</p>
                        <div className="space-y-3 mb-3 max-h-48 overflow-y-auto">
                            {decision.comments?.length === 0 && <p className="text-xs text-slate-600 text-center py-2">No comments yet</p>}
                            {decision.comments?.map(c => (
                                <div key={c.id} className="flex gap-3">
                                    <div className="w-6 h-6 rounded-full bg-indigo-600/20 flex items-center justify-center flex-shrink-0">
                                        <span className="text-indigo-400 text-xs font-bold">{c.user?.fullName?.charAt(0)}</span>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-xs font-medium text-white">{c.user?.fullName}</span>
                                            <span className="text-xs text-slate-600">{new Date(c.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-sm text-slate-300">{c.content}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <form onSubmit={handleComment} className="flex gap-2">
                            <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a comment..."
                                   className="flex-1 bg-slate-900/50 border border-slate-600/50 rounded-xl py-2 px-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            <button type="submit" disabled={sending || !comment.trim()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white text-sm font-medium transition-all disabled:opacity-50">
                                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── File Hub ─────────────────────────────────────────────────────────────────

function FileHub({ projectId }) {
    const [files, setFiles]         = useState([])
    const [loading, setLoading]     = useState(true)
    const [uploading, setUploading] = useState(false)
    const [dragOver, setDragOver]   = useState(false)
    const [selected, setSelected]   = useState(null)
    const [previewFile, setPreviewFile] = useState(null)

    const fetchFiles = async () => {
        try { const res = await api.get(`/files/project/${projectId}`); setFiles(res.data.data || []) }
        catch {} finally { setLoading(false) }
    }
    useEffect(() => { fetchFiles() }, [projectId])

    const handleUpload = async file => {
        if (!file) return
        if (file.size > 50*1024*1024) { toast.error('File too large (max 50MB)'); return }
        setUploading(true)
        const fd = new FormData(); fd.append('file', file); fd.append('projectId', projectId)
        try { await api.post('/files/upload', fd, { headers: { 'Content-Type':'multipart/form-data' } }); toast.success('File uploaded!'); fetchFiles() }
        catch (err) { toast.error(err.response?.data?.message || 'Upload failed') }
        finally { setUploading(false) }
    }

    const handleDownload = async (fileId, fileName) => {
        try {
            const res = await api.get(`/files/${fileId}/download`, { responseType: 'blob' })
            const url = URL.createObjectURL(res.data)
            const a = document.createElement('a')
            a.href = url
            a.download = fileName || 'file'
            document.body.appendChild(a)
            a.click()
            setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a) }, 200)
        } catch { toast.error('Download failed') }
    }

    const handleFollow   = async id => { try { await api.post(`/files/${id}/follow`);   toast.success('Following!'); fetchFiles() } catch {} }
    const handleUnfollow = async id => { try { await api.delete(`/files/${id}/follow`); toast.success('Unfollowed'); fetchFiles() } catch {} }

    const getIcon = t => {
        if (!t) return '📄'
        if (t.includes('image')) return '🖼️'
        if (t.includes('pdf')) return '📕'
        if (t.includes('word')||t.includes('document')) return '📝'
        if (t.includes('sheet')||t.includes('excel')) return '📊'
        if (t.includes('video')) return '🎬'
        if (t.includes('zip')||t.includes('rar')) return '🗜️'
        return '📄'
    }
    const fmtSize = b => { if(!b) return '—'; if(b<1024) return b+' B'; if(b<1024*1024) return (b/1024).toFixed(1)+' KB'; return (b/1024/1024).toFixed(1)+' MB' }

    if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin w-6 h-6 text-blue-500" /></div>

    return (
        <div className="space-y-4">
            <div onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)} onDrop={e=>{e.preventDefault();setDragOver(false);const f=e.dataTransfer.files[0];if(f)handleUpload(f)}}
                 className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${dragOver?'border-blue-500 bg-blue-500/5':'border-slate-600/50 hover:border-slate-500'}`}>
                {uploading ? (
                    <div className="flex flex-col items-center gap-2"><Loader2 className="animate-spin w-8 h-8 text-blue-500" /><p className="text-slate-400 text-sm">Uploading...</p></div>
                ) : (
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center"><Upload className="w-6 h-6 text-blue-400" /></div>
                        <div><p className="text-white font-medium">Drop files here or</p><p className="text-slate-400 text-sm mt-0.5">Max 50MB per file</p></div>
                        <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-all">
                            Browse Files <input type="file" className="hidden" onChange={e=>handleUpload(e.target.files[0])} />
                        </label>
                    </div>
                )}
            </div>
            {files.length === 0 ? (
                <div className="text-center py-12 text-slate-500"><FileText className="w-10 h-10 mx-auto mb-3 opacity-20" /><p>No files yet — upload the first one!</p></div>
            ) : (
                <div className="space-y-2">
                    {files.map(file => (
                        <div key={file.id} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 flex items-center gap-4 hover:border-slate-600 transition-all">
                            <div className="text-2xl flex-shrink-0">{getIcon(file.mimeType)}</div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{file.originalName}</p>
                                <div className="flex items-center gap-3 mt-0.5">
                                    <span className="text-xs text-slate-500">{fmtSize(file.fileSize)}</span>
                                    <span className="text-xs text-slate-600">v{file.version||1}</span>
                                    {file.uploadedBy && <span className="text-xs text-slate-500">by {file.uploadedBy.fullName}</span>}
                                    <span className="text-xs text-slate-600">{new Date(file.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <button onClick={()=>file.isFollowing?handleUnfollow(file.id):handleFollow(file.id)} title={file.isFollowing?'Unfollow':'Follow'}
                                        className={`p-2 rounded-lg transition-all ${file.isFollowing?'text-amber-400 bg-amber-400/10 hover:bg-amber-400/20':'text-slate-400 hover:text-amber-400 hover:bg-slate-700/50'}`}>
                                    <Star className="w-4 h-4" />
                                </button>
                                <button onClick={()=>handleDownload(file.id, file.originalName)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all" title="Download"><Download className="w-4 h-4" /></button>
                                <button onClick={()=>setPreviewFile(file)} className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 transition-all" title="Preview"><Eye className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {previewFile && <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
            {selected && <FileDetailModal file={selected} onClose={()=>setSelected(null)} onRefresh={fetchFiles} getIcon={getIcon} fmtSize={fmtSize} handleDownload={handleDownload} />}
        </div>
    )
}

function FileDetailModal({ file, onClose, onRefresh, getIcon, fmtSize, handleDownload }) {
    const [comments, setComments] = useState([])
    const [versions, setVersions] = useState([])
    const [comment, setComment]   = useState('')
    const [sending, setSending]   = useState(false)
    const [uploading, setUploading] = useState(false)
    const [tab, setTab]           = useState('preview')

    useEffect(() => {
        api.get(`/files/${file.id}/comments`).then(r => setComments(r.data.data || [])).catch(() => {})
        api.get(`/files/${file.id}/versions`).then(r => setVersions(r.data.data || [])).catch(() => {})
    }, [file.id])

    const handleComment = async e => {
        e.preventDefault(); if (!comment.trim()) return; setSending(true)
        try {
            await api.post(`/files/${file.id}/comments`, { content: comment })
            setComment('')
            const r = await api.get(`/files/${file.id}/comments`)
            setComments(r.data.data || [])
            toast.success('Comment added!')
        } catch { toast.error('Failed to add comment') }
        finally { setSending(false) }
    }
    const handleNewVersion = async f => {
        if (!f) return; setUploading(true)
        const fd = new FormData(); fd.append('file', f)
        try {
            await api.post(`/files/${file.id}/version`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
            toast.success('New version uploaded!'); onRefresh(); onClose()
        } catch { toast.error('Upload failed') }
        finally { setUploading(false) }
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col" style={{maxHeight:'90vh'}}>
                <div className="flex items-start justify-between p-6 border-b border-slate-700 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">{getIcon(file.mimeType)}</span>
                        <div>
                            <h2 className="text-base font-semibold text-white">{file.originalName}</h2>
                            <p className="text-xs text-slate-400 mt-0.5">{fmtSize(file.fileSize)} · v{file.version||1} · by {file.uploadedBy?.fullName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <div className="flex gap-1 p-3 border-b border-slate-700 flex-shrink-0">
                    {['preview','comments','versions'].map(t => (
                        <button key={t} onClick={() => setTab(t)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${tab===t?'bg-blue-600 text-white':'text-slate-400 hover:text-white'}`}>
                            {t}{t==='comments'&&comments.length>0&&` (${comments.length})`}{t==='versions'&&versions.length>0&&` (${versions.length})`}
                        </button>
                    ))}
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    {tab==='preview' && (
                        <div className="space-y-4">
                            {file.mimeType?.includes('image') ? (
                                <div className="flex items-center justify-center bg-slate-900/50 rounded-xl p-4">
                                    <img src={file.downloadUrl} alt={file.originalName} className="max-w-full max-h-80 rounded-xl object-contain" />
                                </div>
                            ) : file.mimeType?.includes('pdf') ? (
                                <iframe src={file.downloadUrl} className="w-full rounded-xl bg-white" style={{height:360}} title={file.originalName} />
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                    <span className="text-5xl mb-4">{getIcon(file.mimeType)}</span>
                                    <p className="text-sm">Preview not available for this file type</p>
                                </div>
                            )}
                            <button onClick={() => handleDownload(file.id, file.originalName)}
                                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all flex items-center justify-center gap-2">
                                <Download className="w-4 h-4" /> Download
                            </button>
                        </div>
                    )}
                    {tab==='comments' && (
                        <div className="space-y-4">
                            <div className="space-y-3 max-h-72 overflow-y-auto">
                                {comments.length===0
                                    ? <p className="text-slate-500 text-sm text-center py-8">No comments yet</p>
                                    : comments.map(c => (
                                        <div key={c.id} className="flex gap-3">
                                            <div className="w-7 h-7 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                                                <span className="text-blue-400 text-xs font-bold">{c.user?.fullName?.charAt(0)}</span>
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="text-xs font-medium text-white">{c.user?.fullName}</span>
                                                    <span className="text-xs text-slate-500">{new Date(c.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                <p className="text-sm text-slate-300">{c.content}</p>
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>
                            <form onSubmit={handleComment} className="flex gap-2">
                                <input value={comment} onChange={e=>setComment(e.target.value)} placeholder="Write a comment..."
                                       className="flex-1 bg-slate-900/50 border border-slate-600/50 rounded-xl py-2 px-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <button type="submit" disabled={sending||!comment.trim()}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-white text-sm font-medium transition-all disabled:opacity-50">
                                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </button>
                            </form>
                        </div>
                    )}
                    {tab==='versions' && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 p-3 bg-blue-600/10 border border-blue-500/20 rounded-xl">
                                <div className="w-8 h-8 rounded-lg bg-blue-600/30 flex items-center justify-center text-xs font-bold text-blue-300">v{file.version||1}</div>
                                <div className="flex-1">
                                    <p className="text-sm text-white font-medium">{file.originalName} <span className="text-xs text-blue-400 ml-1">current</span></p>
                                    <p className="text-xs text-slate-400">{new Date(file.createdAt).toLocaleDateString()} · by {file.uploadedBy?.fullName}</p>
                                </div>
                                <button onClick={() => handleDownload(file.id, file.originalName)} className="p-1.5 text-slate-400 hover:text-white"><Download className="w-4 h-4" /></button>
                            </div>
                            {versions.filter(v => v.id !== file.id).map(v => (
                                <div key={v.id} className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-xl">
                                    <div className="w-8 h-8 rounded-lg bg-slate-600/50 flex items-center justify-center text-xs font-bold text-slate-300">v{v.version}</div>
                                    <div className="flex-1">
                                        <p className="text-sm text-white">{v.originalName}</p>
                                        <p className="text-xs text-slate-400">{new Date(v.createdAt).toLocaleDateString()} · by {v.uploadedBy?.fullName}</p>
                                    </div>
                                    <button onClick={() => handleDownload(v.id, v.originalName)} className="p-1.5 text-slate-400 hover:text-white"><Download className="w-4 h-4" /></button>
                                </div>
                            ))}
                            <div className="border-t border-slate-700 pt-3">
                                <label className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:border-blue-500 hover:text-blue-400 text-sm cursor-pointer transition-all ${uploading?'opacity-50 cursor-not-allowed':''}`}>
                                    {uploading ? <><Loader2 className="w-4 h-4 animate-spin" />Uploading...</> : <><Upload className="w-4 h-4" />Upload new version</>}
                                    <input type="file" className="hidden" disabled={uploading} onChange={e=>handleNewVersion(e.target.files[0])} />
                                </label>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ─── Members Tab ──────────────────────────────────────────────────────────────

function MembersTab({ members, users, memberForm, setMemberForm, addingMember, handleAddMember, isManagerOrAdmin, canRemoveMembers, projectId, onMembersChange }) {
    const [profileUser, setProfileUser] = useState(null)
    const [removingId, setRemovingId]   = useState(null)
    const { user: currentUser } = useAuthStore()

    const handleRemoveMember = async (userId) => {
        if (!confirm('Remove this member from the project?')) return
        setRemovingId(userId)
        try {
            await api.delete(`/projects/${projectId}/members/${userId}`)
            toast.success('Member removed')
            if (onMembersChange) onMembersChange()
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to remove') }
        finally { setRemovingId(null) }
    }

    return (
        <div className="space-y-6 max-w-lg">
            {profileUser && <UserProfileModal user={profileUser} onClose={() => setProfileUser(null)} />}
            <div>
                <h3 className="text-sm font-semibold text-white mb-3">Project Members ({members.length})</h3>
                <div className="space-y-2">
                    {members.map(m => (
                        <div key={m.id}
                             className="flex items-center gap-3 p-3 bg-slate-800/60 border border-slate-700/50 rounded-xl hover:border-blue-500/30 transition-all group">
                            <div className="w-9 h-9 rounded-full bg-blue-600/20 flex items-center justify-center cursor-pointer"
                                 onClick={() => setProfileUser(m.user)}>
                                <span className="text-blue-400 font-bold">{m.user?.fullName?.charAt(0)}</span>
                            </div>
                            <div className="flex-1 cursor-pointer" onClick={() => setProfileUser(m.user)}>
                                <p className="text-sm text-white font-medium group-hover:text-blue-300 transition-colors">{m.user?.fullName}</p>
                                <p className="text-xs text-slate-400">{m.user?.email}</p>
                            </div>
                            <span className="text-xs text-slate-400 bg-slate-700/50 px-2 py-1 rounded-lg flex-shrink-0">{m.role}</span>
                            {(canRemoveMembers ?? isManagerOrAdmin) && String(m.user?.id) !== String(currentUser?.id) && (
                                <button onClick={() => handleRemoveMember(m.user?.id)}
                                        disabled={removingId === m.user?.id}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all flex-shrink-0"
                                        title="Remove member">
                                    {removingId === m.user?.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            {isManagerOrAdmin && (
                <div>
                    <h3 className="text-sm font-semibold text-white mb-3">Add Member</h3>
                    <form onSubmit={handleAddMember} className="space-y-3">
                        <SearchableSelect
                            options={users.filter(u=>!members.find(m=>m.user?.id===u.id)).map(u => ({ value: u.id, label: u.fullName, sublabel: u.email }))}
                            value={memberForm.userId}
                            onChange={v => setMemberForm({...memberForm, userId: v || ''})}
                            placeholder="Select a user..."
                            nullLabel="Select a user..."
                        />
                        <SearchableSelect
                            options={[{value:'MANAGER',label:'Manager'},{value:'EMPLOYEE',label:'Employee'},{value:'GUEST',label:'Guest'}]}
                            value={memberForm.role}
                            onChange={v => setMemberForm({...memberForm, role: v || 'EMPLOYEE'})}
                            nullable={false}
                            placeholder="Select role"
                        />
                        <button type="submit" disabled={addingMember||!memberForm.userId} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium text-sm transition-all flex items-center justify-center gap-2">
                            {addingMember?<><Loader2 className="w-4 h-4 animate-spin"/>Adding...</>:'Add Member'}
                        </button>
                    </form>
                </div>
            )}
        </div>
    )
}

// ─── Project Group Chat ───────────────────────────────────────────────────────

function ProjectGroupChat({ project }) {
    const { user, token } = useAuthStore()
    const userId = user?.id || user?.userId
    const targetLang = user?.preferredLanguage || 'en'

    const [conversation, setConversation] = useState(null)
    const [messages, setMessages]         = useState([])
    const [input, setInput]               = useState('')
    const [loading, setLoading]           = useState(true)
    const [sending, setSending]           = useState(false)
    const [stagedFiles, setStagedFiles]   = useState([])
    const [showOriginal, setShowOriginal] = useState(false)
    const [pinnedMessages, setPinnedMessages] = useState([])
    const [showPinned, setShowPinned]     = useState(false)
    const [searchQuery, setSearchQuery]   = useState('')
    const [searchResults, setSearchResults] = useState(null)
    const [showSearch, setShowSearch]     = useState(false)
    const [members, setMembers]           = useState([])
    const [typingUsers, setTypingUsers]   = useState([])
    const typingTimerRef                  = useRef(null)
    const isTypingRef                     = useRef(false)

    // @mention autocomplete
    const [mentionQuery, setMentionQuery]       = useState('')
    const [mentionResults, setMentionResults]   = useState([])
    const [showMentions, setShowMentions]       = useState(false)
    const [mentionedIds, setMentionedIds]       = useState([])

    const bottomRef = useRef(null)
    const stompRef  = useRef(null)
    const inputRef  = useRef(null)
    const fileRef   = useRef(null)
    const dragCounter = useRef(0)

    useEffect(() => {
        const load = async () => {
            try {
                const res  = await api.get(`/chat/conversations/project/${project.id}`)
                const conv = res.data.data
                setConversation(conv)
                const msgRes = await api.get(`/chat/conversations/${conv.id}/messages`)
                setMessages((msgRes.data.data || []).reverse())
                const pinRes = await api.get(`/chat/conversations/${conv.id}/pinned`)
                setPinnedMessages(pinRes.data.data || [])
                // load members for @mentions
                const projRes = await api.get(`/projects/${project.id}`)
                setMembers((projRes.data.data?.members || []).map(m => m.user).filter(Boolean))
            } catch { toast.error('Failed to load group chat') }
            finally { setLoading(false) }
        }
        load()
    }, [project.id])

    useEffect(() => {
        if (!conversation) return
        const tok = localStorage.getItem('token') ||
            JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.token
        const client = new Client({
            webSocketFactory: () => new SockJS(`${window.location.protocol}//${window.location.host}/ws`),
            connectHeaders: { Authorization: `Bearer ${tok}` },
            onConnect: () => {
                client.subscribe(`/topic/conversation/${conversation.id}`, msg => {
                    const newMsg = JSON.parse(msg.body)
                    setMessages(prev => prev.find(m => m.id === newMsg.id) ? prev : [...prev, newMsg])
                })
                client.subscribe(`/topic/conversation/${conversation.id}/typing`, msg => {
                    try {
                        const data = JSON.parse(msg.body)
                        if (String(data.userId) === String(userId)) return
                        setTypingUsers(prev => {
                            const exists = prev.find(u => u.id === data.userId)
                            if (data.typing) {
                                return exists ? prev : [...prev, { id: data.userId, fullName: data.fullName }]
                            }
                            return prev.filter(u => u.id !== data.userId)
                        })
                    } catch {}
                })
            },
        })
        client.activate()
        stompRef.current = client
        return () => client.deactivate()
    }, [conversation?.id])

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

    const sendTyping = (isTyping) => {
        const client = stompRef.current
        if (!client?.connected || !conversation) return
        client.publish({
            destination: `/app/chat/${conversation.id}/typing`,
            body: JSON.stringify({ typing: isTyping, userId, fullName: user?.fullName })
        })
    }

    const handleInputChange = e => {
        const val = e.target.value
        setInput(val)

        // Typing indicator
        if (!isTypingRef.current) { isTypingRef.current = true; sendTyping(true) }
        clearTimeout(typingTimerRef.current)
        typingTimerRef.current = setTimeout(() => { isTypingRef.current = false; sendTyping(false) }, 2000)

        const cursor = e.target.selectionStart
        const textBefore = val.slice(0, cursor)
        const match = textBefore.match(/@(\w*)$/)
        if (match) {
            const q = match[1].toLowerCase()
            setMentionQuery(q)
            const filtered = members.filter(m =>
                m.fullName?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q)
            ).slice(0, 5)
            setMentionResults(filtered)
            setShowMentions(filtered.length > 0)
        } else {
            setShowMentions(false)
        }
    }

    const insertMention = (member) => {
        const cursor = inputRef.current?.selectionStart || input.length
        const before = input.slice(0, cursor)
        const after  = input.slice(cursor)
        const replaced = before.replace(/@\w*$/, `@${member.fullName} `)
        setInput(replaced + after)
        setMentionedIds(prev => [...new Set([...prev, member.id])])
        setShowMentions(false)
        setTimeout(() => inputRef.current?.focus(), 0)
    }

    const handleSend = async () => {
        const hasText = !!input.trim()
        const hasFiles = stagedFiles.length > 0
        if (!hasText && !hasFiles) return
        if (!conversation || sending) return
        setSending(true)
        isTypingRef.current = false
        sendTyping(false)

        if (hasFiles) {
            const filesToUpload = [...stagedFiles]
            setStagedFiles([])
            for (const file of filesToUpload) {
                if (file.size > 50 * 1024 * 1024) { toast.error(`${file.name}: Max 50MB`); continue }
                try {
                    const fd = new FormData()
                    fd.append('file', file)
                    await api.post(`/chat/conversations/${conversation.id}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
                } catch { toast.error(`Failed to upload ${file.name}`) }
            }
            if (!hasText) { setSending(false); return }
        }

        if (hasText) {
            try {
                await api.post(`/chat/conversations/${conversation.id}/messages`, {
                    content: input.trim(),
                    messageType: 'TEXT',
                    mentionedUserIds: mentionedIds.length ? mentionedIds : null,
                })
                setInput('')
                setMentionedIds([])
                inputRef.current?.focus()
            } catch { toast.error('Failed to send message') }
        }
        setSending(false)
    }

    const handleFileSelect = e => {
        const files = Array.from(e.target.files || [])
        if (files.length > 0) setStagedFiles(prev => [...prev, ...files])
        e.target.value = ''
    }

    const handlePaste = (e) => {
        const items = Array.from(e.clipboardData?.items || [])
        const fileItems = items.filter(i => i.kind === 'file')
        if (fileItems.length === 0) return
        e.preventDefault()
        const files = fileItems.map(i => i.getAsFile()).filter(Boolean)
        if (files.length > 0) setStagedFiles(prev => [...prev, ...files])
    }

    const handleDragEnter = (e) => { e.preventDefault(); dragCounter.current++; if (e.dataTransfer.items?.length > 0) {} }
    const handleDragLeave = (e) => { e.preventDefault(); dragCounter.current-- }
    const handleDragOver  = (e) => { e.preventDefault() }
    const handleDrop      = (e) => {
        e.preventDefault()
        dragCounter.current = 0
        const files = Array.from(e.dataTransfer.files)
        if (files.length > 0) setStagedFiles(prev => [...prev, ...files])
    }

    const handleKeyDown = e => {
        if (showMentions && (e.key === 'Escape')) { setShowMentions(false); return }
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
    }

    const handleDelete = async msgId => {
        try {
            await api.delete(`/chat/messages/${msgId}`)
            setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isDeleted: true, content: null } : m))
        } catch { toast.error('Cannot delete this message') }
    }

    const handleReact = async (msgId, emoji) => {
        try {
            await api.post(`/chat/messages/${msgId}/react`, { emoji })
            setMessages(prev => prev.map(m => {
                if (m.id !== msgId) return m
                const reactions = { ...(m.reactions || {}) }
                const users = reactions[emoji] || []
                const myName = user?.fullName
                reactions[emoji] = users.includes(myName)
                    ? users.filter(u => u !== myName)
                    : [...users, myName]
                return { ...m, reactions }
            }))
        } catch {}
    }

    const handlePin = async msgId => {
        try {
            await api.patch(`/chat/messages/${msgId}/pin`)
            toast.success('Message pinned!')
            const pinRes = await api.get(`/chat/conversations/${conversation.id}/pinned`)
            setPinnedMessages(pinRes.data.data || [])
            setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isPinned: !m.isPinned } : m))
        } catch {}
    }

    const handleSearch = async () => {
        if (!searchQuery.trim()) { setSearchResults(null); return }
        try {
            const res = await api.get(`/chat/conversations/${conversation.id}/search?keyword=${encodeURIComponent(searchQuery)}`)
            setSearchResults(res.data.data || [])
        } catch {}
    }

    const displayMessages = searchResults !== null ? [...searchResults].reverse() : messages

    if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin w-6 h-6 text-blue-500" /></div>

    return (
        <div className="flex flex-col h-full"
             onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-slate-700/50 bg-slate-800/20 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-600/20 flex items-center justify-center">
                        <MessageSquare className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-white">{project.name}</p>
                        <p className="text-xs text-slate-400">{conversation?.participants?.length || 0} members · Group Chat</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setShowOriginal(v => !v)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition-all mr-1 ${showOriginal ? 'bg-amber-600/20 border-amber-500/40 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200 bg-slate-800/60'}`}
                        title={showOriginal ? 'Show translations' : 'Show original messages'}>
                        <Languages className="w-3.5 h-3.5" />
                        <span className="text-xs font-semibold">{showOriginal ? 'Original' : 'Translated'}</span>
                    </button>
                    <button onClick={() => { setShowSearch(!showSearch); if (showSearch) { setSearchQuery(''); setSearchResults(null) } }}
                            className={`p-2 rounded-xl transition-all ${showSearch ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
                        <Search className="w-4 h-4" />
                    </button>
                    <button onClick={() => setShowPinned(!showPinned)}
                            className={`p-2 rounded-xl transition-all ${showPinned ? 'bg-amber-600/20 text-amber-400' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
                        <Pin className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Search bar */}
            {showSearch && (
                <div className="flex items-center gap-2 px-6 py-2 border-b border-slate-700/30 bg-slate-800/10 flex-shrink-0">
                    <input type="text" placeholder="Search messages..." value={searchQuery}
                           onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
                           className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-xl py-1.5 px-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button onClick={handleSearch} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium transition-all">Search</button>
                    {searchResults !== null && (
                        <button onClick={() => { setSearchResults(null); setSearchQuery('') }}
                                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-xs font-medium transition-all">Clear</button>
                    )}
                </div>
            )}

            {/* Pinned panel */}
            {showPinned && (
                <div className="border-b border-amber-500/20 bg-amber-500/5 flex-shrink-0 max-h-40 overflow-y-auto">
                    <div className="px-6 py-2 flex items-center gap-2">
                        <Pin className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs font-semibold text-amber-400">{pinnedMessages.length} Pinned</span>
                    </div>
                    {pinnedMessages.length === 0
                        ? <p className="text-xs text-slate-500 px-6 pb-3">No pinned messages.</p>
                        : <div className="px-6 pb-3 space-y-2">
                            {pinnedMessages.map(msg => (
                                <div key={msg.id} className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/20 rounded-xl p-2.5">
                                    <div className="w-5 h-5 rounded-full bg-blue-600/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <span className="text-blue-400 text-xs font-bold">{msg.sender?.fullName?.charAt(0)}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-xs font-medium text-amber-300">{msg.sender?.fullName}</span>
                                        <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">{msg.content}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    }
                </div>
            )}

            {/* Search result banner */}
            {searchResults !== null && (
                <div className="px-6 py-1.5 bg-blue-600/10 border-b border-blue-500/20 flex-shrink-0">
                    <p className="text-xs text-blue-400">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchQuery}"</p>
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
                {displayMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 py-16">
                        <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
                        <p className="font-medium">{searchResults !== null ? 'No messages found' : 'No messages yet'}</p>
                        {searchResults === null && <p className="text-sm mt-1">Be the first to send a message!</p>}
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-3 my-4">
                            <div className="flex-1 h-px bg-slate-700/50" />
                            <span className="text-xs text-slate-500">Group conversation</span>
                            <div className="flex-1 h-px bg-slate-700/50" />
                        </div>
                        {displayMessages.map((msg, idx) => {
                            const isOwn = msg.sender?.id === userId
                            const prevMsg = displayMessages[idx - 1]
                            const isSameAuthor = prevMsg && prevMsg.sender?.id === msg.sender?.id && !msg.isDeleted && !prevMsg.isDeleted
                            const showDate = idx === 0 || new Date(msg.createdAt).toDateString() !== new Date(displayMessages[idx-1]?.createdAt).toDateString()
                            return (
                                <div key={msg.id}>
                                    {showDate && idx > 0 && (
                                        <div className="flex items-center gap-3 my-4">
                                            <div className="flex-1 h-px bg-slate-700/50" />
                                            <span className="text-xs text-slate-500">{new Date(msg.createdAt).toLocaleDateString('en', { weekday:'long', day:'numeric', month:'long' })}</span>
                                            <div className="flex-1 h-px bg-slate-700/50" />
                                        </div>
                                    )}
                                    <GroupMessageBubble msg={msg} isOwn={isOwn} showAvatar={!isSameAuthor || !isOwn}
                                        targetLang={targetLang} showOriginalGlobal={showOriginal}
                                        onDelete={handleDelete} onPin={handlePin} onReact={handleReact} />
                                </div>
                            )
                        })}
                        <div ref={bottomRef} />
                    </>
                )}
            </div>

            {/* Typing indicator */}
            {typingUsers.length > 0 && (
                <div className="px-6 py-1.5 flex items-center gap-2 flex-shrink-0 border-t border-slate-700/30">
                    <div className="flex gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{animationDelay:'0ms'}} />
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{animationDelay:'150ms'}} />
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{animationDelay:'300ms'}} />
                    </div>
                    <span className="text-xs text-slate-500">
                        {typingUsers.length === 1
                            ? `${typingUsers[0].fullName} is typing...`
                            : `${typingUsers.map(u => u.fullName).join(', ')} are typing...`}
                    </span>
                </div>
            )}

            {/* Input */}
            <div className="px-6 py-4 border-t border-slate-700/50 flex-shrink-0">
                {/* @mention dropdown */}
                {showMentions && (
                    <div className="mb-2 bg-slate-800 border border-slate-600/50 rounded-xl overflow-hidden shadow-xl">
                        {mentionResults.map(m => (
                            <button key={m.id} onClick={() => insertMention(m)}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/50 transition-all text-left">
                                <div className="w-7 h-7 rounded-full bg-blue-600/30 flex items-center justify-center flex-shrink-0">
                                    <span className="text-blue-400 text-xs font-bold">{m.fullName?.charAt(0)}</span>
                                </div>
                                <div>
                                    <p className="text-sm text-white font-medium">{m.fullName}</p>
                                    <p className="text-xs text-slate-400">{m.email}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
                {/* Staged files preview */}
                {stagedFiles.length > 0 && (
                    <div className="flex flex-col gap-1 mb-2">
                        {stagedFiles.map((file, idx) => (
                            <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-600/50 rounded-xl">
                                <Paperclip className="w-4 h-4 flex-shrink-0 text-blue-400" />
                                <span className="text-sm flex-1 truncate text-white">{file.name}</span>
                                <span className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB</span>
                                <button onClick={() => setStagedFiles(prev => prev.filter((_, i) => i !== idx))}
                                        className="p-0.5 rounded text-slate-500 hover:text-red-400 transition-colors">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                <div className="flex items-end gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600/30 flex items-center justify-center flex-shrink-0 mb-0.5">
                        {user?.profilePhotoUrl ? (
                            <img src={getAvatarUrl(user)} className="w-8 h-8 rounded-full object-cover" alt="" />
                        ) : (
                            <span className="text-blue-400 text-xs font-bold">{user?.fullName?.charAt(0)?.toUpperCase() || '?'}</span>
                        )}
                    </div>
                    <div className="flex-1 bg-slate-800 border border-slate-600/50 rounded-2xl px-4 py-2.5 focus-within:border-blue-500/50 transition-colors">
                        <textarea ref={inputRef} rows={1} value={input} onChange={handleInputChange} onKeyDown={handleKeyDown} onPaste={handlePaste}
                                  placeholder={`Message ${project.name}... (paste or drop files)`}
                                  className="w-full bg-transparent text-white placeholder-slate-500 text-sm resize-none focus:outline-none"
                                  style={{ maxHeight: '120px' }} />
                    </div>
                    {/* File upload */}
                    <label className="w-10 h-10 rounded-2xl flex items-center justify-center cursor-pointer transition-all flex-shrink-0 mb-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white">
                        <Paperclip className="w-4 h-4" />
                        <input ref={fileRef} type="file" className="hidden" multiple onChange={handleFileSelect}
                               accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.csv" />
                    </label>
                    <button onClick={handleSend} disabled={(!input.trim() && stagedFiles.length === 0) || sending}
                            className="w-10 h-10 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed flex items-center justify-center transition-all flex-shrink-0 shadow-lg shadow-blue-600/20 mb-0.5">
                        {sending ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
                    </button>
                </div>
                <p className="text-xs text-slate-600 mt-2 ml-11">Enter to send · Shift+Enter for new line · @ to mention · Drop files to attach</p>
            </div>
        </div>
    )
}

const QUICK_EMOJIS_G = ['👍','❤️','😂','😮','😢','🔥']

function GroupMessageBubble({ msg, isOwn, showAvatar, targetLang, showOriginalGlobal, onDelete, onPin, onReact }) {
    const [showActions, setShowActions]   = useState(false)
    const [showEmojiPicker, setShowEmojiPicker] = useState(false)
    const [translation, setTranslation]   = useState(null)

    useEffect(() => {
        if (isOwn || !msg.content?.trim() || msg.messageType !== 'TEXT') return
        if (translation) return
        translateText(msg.content, targetLang)
            .then(t => { if (t !== msg.content) setTranslation(t) })
            .catch(() => {})
    }, [msg.id])

    if (msg.isDeleted) return (
        <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} px-1 py-0.5`}>
            <p className="text-xs text-slate-600 italic px-3 py-1.5 bg-slate-800/30 rounded-xl">🗑 Message deleted</p>
        </div>
    )

    const isMedia = msg.messageType === 'IMAGE' || msg.messageType === 'FILE' || msg.fileUrl
    const isImage = msg.mimeType?.includes('image') || msg.messageType === 'IMAGE'

    return (
        <div className={`flex gap-2.5 group ${isOwn ? 'flex-row-reverse' : 'flex-row'} py-0.5`}
             onMouseEnter={() => setShowActions(true)} onMouseLeave={() => { setShowActions(false); setShowEmojiPicker(false) }}>
            {!isOwn ? (
                <div className={`w-7 h-7 rounded-full flex-shrink-0 mt-1 transition-opacity overflow-hidden ${showAvatar ? 'opacity-100' : 'opacity-0'}`}
                     style={{ background: `hsl(${(msg.sender?.id||0)*47%360},60%,40%)` }}>
                    {msg.sender?.profilePhotoUrl ? (
                        <img src={getAvatarUrl(msg.sender)} className="w-full h-full object-cover" alt="" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <span className="text-white text-xs font-bold">{msg.sender?.fullName?.charAt(0)}</span>
                        </div>
                    )}
                </div>
            ) : <div className="w-7 flex-shrink-0" />}

            <div className={`max-w-xs lg:max-w-md xl:max-w-lg flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}>
                {!isOwn && showAvatar && <span className="text-xs text-slate-400 px-1 font-medium">{msg.sender?.fullName}</span>}
                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isOwn ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-slate-700/80 text-slate-100 rounded-tl-sm'}`}>
                    {msg.isPinned && <div className="flex items-center gap-1 text-xs opacity-60 mb-1"><Pin className="w-3 h-3" /> Pinned</div>}
                    {isImage && msg.fileUrl ? (
                        <img src={getMediaUrl(msg.fileUrl)} alt="image" className="max-w-full rounded-xl max-h-48 object-cover cursor-zoom-in"
                             onClick={() => window.dispatchEvent(new CustomEvent('preview-img', { detail: getMediaUrl(msg.fileUrl) }))} />
                    ) : isMedia && msg.fileUrl ? (
                        <a href={getMediaUrl(msg.fileUrl)} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-300 hover:text-blue-200 underline text-xs">
                            <Paperclip className="w-3 h-3" />{msg.fileName || msg.content || 'Download file'}
                        </a>
                    ) : (
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    )}
                </div>

                {/* Auto-translation */}
                {translation && !showOriginalGlobal && (
                    <div className={`px-3 py-2 rounded-xl text-xs max-w-full border ${isOwn ? 'bg-blue-500/20 border-blue-500/30 text-blue-100' : 'bg-slate-800/60 border-slate-600/50 text-slate-200'}`}>
                        <div className="flex items-center gap-1.5 mb-1 opacity-70">
                            <Languages className="w-3 h-3" />
                            <span className="font-semibold uppercase">{LANG_CODE[targetLang]?.toUpperCase() || 'EN'}</span>
                        </div>
                        <p className="leading-relaxed">{translation}</p>
                    </div>
                )}

                {/* Emoji reactions */}
                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className={`flex flex-wrap gap-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        {Object.entries(msg.reactions).map(([emoji, users]) =>
                            users.length > 0 && (
                                <button key={emoji} onClick={() => onReact(msg.id, emoji)}
                                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-slate-600/50 bg-slate-800/60 text-slate-300 transition-all hover:scale-105"
                                        title={users.join(', ')}>
                                    {emoji} <span>{users.length}</span>
                                </button>
                            )
                        )}
                    </div>
                )}

                <span className="text-xs text-slate-600 px-1">{new Date(msg.createdAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</span>
            </div>

            <div className={`flex items-center gap-0.5 self-center opacity-0 group-hover:opacity-100 transition-opacity ${isOwn ? 'order-first' : 'order-last'}`}>
                <div className="relative">
                    <button onClick={() => setShowEmojiPicker(v => !v)}
                            className="p-1.5 rounded-lg bg-slate-700/80 hover:bg-slate-600 text-slate-400 hover:text-amber-400 transition-all" title="React">
                        😊
                    </button>
                    {showEmojiPicker && (
                        <div className={`absolute bottom-8 flex gap-1 p-2 rounded-xl shadow-2xl border border-slate-600/50 bg-slate-800 z-50 ${isOwn ? 'right-0' : 'left-0'}`}>
                            {QUICK_EMOJIS_G.map(emoji => (
                                <button key={emoji} onClick={() => { onReact(msg.id, emoji); setShowEmojiPicker(false) }}
                                        className="text-lg hover:scale-125 transition-transform p-0.5">
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <button onClick={() => onPin(msg.id)}
                        className={`p-1.5 rounded-lg transition-all ${msg.isPinned ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700/80 hover:bg-slate-600 text-slate-400 hover:text-white'}`}
                        title={msg.isPinned ? 'Unpin' : 'Pin'}>
                    <Pin className="w-3 h-3" />
                </button>
                {isOwn && (
                    <button onClick={() => onDelete(msg.id)}
                            className="p-1.5 rounded-lg bg-slate-700/80 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all" title="Delete">
                        <Trash2 className="w-3 h-3" />
                    </button>
                )}
            </div>
        </div>
    )
}


// ─── Project Tasks Tab ────────────────────────────────────────────────────────

const PRIORITY_COLOR = {
    LOW:    'text-slate-400 bg-slate-400/10 border-slate-400/20',
    NORMAL: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    HIGH:   'text-amber-400 bg-amber-400/10 border-amber-400/20',
    URGENT: 'text-red-400 bg-red-400/10 border-red-400/20',
}

const TASK_STATUS_COLS = [
    { key: 'TODO',      label: 'To Do',     color: 'bg-slate-500',   light: 'text-slate-400',   border: 'border-slate-500/30'   },
    { key: 'IN_REVIEW', label: 'In Review', color: 'bg-amber-500',   light: 'text-amber-400',   border: 'border-amber-500/30'   },
    { key: 'DONE',      label: 'Done',      color: 'bg-emerald-500', light: 'text-emerald-400', border: 'border-emerald-500/30' },
    { key: 'UPCOMING',  label: 'Upcoming',  color: 'bg-purple-500',  light: 'text-purple-400',  border: 'border-purple-500/30'  },
]

function ProjectTasksTab({ project, members, isManagerOrAdmin, autoTaskId, autoCreateTask }) {
    const { user } = useAuthStore()
    const userId   = user?.id || user?.userId

    const [tasks, setTasks]         = useState([])
    const [loading, setLoading]     = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [selected, setSelected]   = useState(null)
    const [creating, setCreating]   = useState(false)
    const [filter, setFilter]       = useState('ALL')
    const [depSearch, setDepSearch] = useState('')

    const [form, setForm] = useState({
        title: '', description: '', assigneeId: '', reviewerId: '',
        priority: 'NORMAL', startDate: '', dueDate: '',
        initialStatus: 'TODO', dependsOnTaskIds: []
    })

    const fetchTasks = async () => {
        try {
            const res = await api.get(`/tasks/project/${project.id}`)
            setTasks(res.data.data || [])
        } catch { toast.error('Failed to load tasks') }
        finally { setLoading(false) }
    }

    useEffect(() => { fetchTasks() }, [project.id])

    // Auto-open task from global search deep-link
    useEffect(() => {
        if (!autoTaskId || loading || tasks.length === 0) return
        const t = tasks.find(tk => String(tk.id) === String(autoTaskId))
        if (t) {
            setSelected(t)
            setFilter('ALL')
        }
    }, [autoTaskId, loading, tasks])

    // Auto-open create-task modal (triggered by AI assistant action)
    useEffect(() => {
        if (autoCreateTask && !loading) setShowModal(true)
    }, [autoCreateTask, loading])

    const toggleDep = id => {
        const idStr = String(id)
        setForm(f => ({
            ...f,
            dependsOnTaskIds: f.dependsOnTaskIds.includes(idStr)
                ? f.dependsOnTaskIds.filter(d => d !== idStr)
                : [...f.dependsOnTaskIds, idStr]
        }))
    }

    const handleCreate = async e => {
        e.preventDefault(); setCreating(true)
        try {
            const payload = {
                projectId:        project.id,
                title:            form.title,
                description:      form.description || null,
                priority:         form.priority,
                startDate:        form.startDate || null,
                dueDate:          form.dueDate   || null,
                initialStatus:    form.initialStatus,
                dependsOnTaskIds: form.dependsOnTaskIds.length ? form.dependsOnTaskIds.map(Number) : null,
            }
            if (isManagerOrAdmin) {
                payload.assigneeId = form.assigneeId ? parseInt(form.assigneeId) : null
                payload.reviewerId = form.reviewerId ? parseInt(form.reviewerId) : null
            } else {
                payload.assigneeId = userId
            }
            await api.post('/tasks', payload)
            toast.success('Task created!')
            setShowModal(false)
            setForm({ title:'', description:'', assigneeId:'', reviewerId:'', priority:'NORMAL', startDate:'', dueDate:'', initialStatus:'TODO', dependsOnTaskIds:[] })
            fetchTasks()
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to create task') }
        finally { setCreating(false) }
    }

    const ACTION_STATUS_MAP = { start: 'IN_PROGRESS', submit: 'IN_REVIEW', approve: 'DONE' }

    const updateTaskLocally = (taskId, patch) => {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...patch } : t))
        setSelected(prev => prev && prev.id === taskId ? { ...prev, ...patch } : prev)
    }

    const handleAction = async (taskId, action, body = undefined) => {
        const newStatus = ACTION_STATUS_MAP[action]
        if (newStatus) updateTaskLocally(taskId, { status: newStatus })
        try {
            if (body) await api.patch(`/tasks/${taskId}/${action}`, body)
            else      await api.patch(`/tasks/${taskId}/${action}`)
            toast.success('Done!')
            setSelected(null)
            fetchTasks()
        } catch (err) {
            toast.error(err.response?.data?.message || 'Action failed')
            fetchTasks()
        }
    }

    const [showArchived, setShowArchived] = useState(false)

    const handleArchiveTask = async id => {
        try { await api.patch(`/tasks/${id}/archive`); toast.success('Task archived'); fetchTasks() }
        catch { toast.error('Failed to archive task') }
    }
    const handleUnarchiveTask = async id => {
        try { await api.patch(`/tasks/${id}/unarchive`); toast.success('Task unarchived'); fetchTasks() }
        catch { toast.error('Failed to unarchive task') }
    }
    const handleDeleteTask = async id => {
        if (!window.confirm('Delete this task permanently? All related data will be deleted.')) return
        try { await api.delete(`/tasks/${id}`); toast.success('Task deleted'); fetchTasks() }
        catch { toast.error('Failed to delete task') }
    }

    const handleDuplicateTask = async task => {
        try {
            const res = await api.post('/tasks', {
                projectId:     project.id,
                title:         task.title + ' (copy)',
                description:   task.description || null,
                priority:      task.priority,
                startDate:     task.startDate || null,
                dueDate:       task.dueDate   || null,
                initialStatus: 'TODO',
                assigneeId:    task.assignee?.id || null,
                reviewerId:    task.reviewer?.id || null,
            })
            const newTask = res.data?.data
            toast.success('Task duplicated! Opening editor…')
            await fetchTasks()
            if (newTask?.id) {
                // Re-fetch fresh task data and open the modal
                const taskRes = await api.get(`/tasks/${newTask.id}`).catch(() => null)
                setSelected(taskRes?.data?.data || newTask)
            }
        } catch { toast.error('Failed to duplicate task') }
    }

    const activeTasks  = showArchived ? tasks : tasks.filter(t => !t.isArchived)
    const archivedCount = tasks.filter(t => t.isArchived).length
    const filtered  = filter === 'ALL' ? activeTasks : activeTasks.filter(t => t.status === filter)
    const byStatus  = key => filtered.filter(t => t.status === key)
    const totalDone = activeTasks.filter(t => t.status === 'DONE').length

    if (loading) return <div className="flex items-center justify-center h-full py-16"><Loader2 className="animate-spin w-6 h-6 text-blue-500" /></div>

    return (
        <div className="flex flex-col h-full">

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div>
                        <p className="text-sm text-slate-400">
                            {activeTasks.length} tasks · {totalDone} done
                            {activeTasks.length > 0 && (
                                <span className="ml-2 text-emerald-400 font-medium">
                                    {Math.round(totalDone / activeTasks.length * 100)}%
                                </span>
                            )}
                        </p>
                        {/* Progress bar */}
                        {activeTasks.length > 0 && (
                            <div className="w-48 h-1.5 bg-slate-700 rounded-full mt-1.5 overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full transition-all"
                                     style={{ width: `${Math.round(totalDone / activeTasks.length * 100)}%` }} />
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {archivedCount > 0 && (
                        <button onClick={() => setShowArchived(!showArchived)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${showArchived ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'border-slate-600/50 text-slate-400 hover:text-white'}`}>
                            <Archive className="w-3.5 h-3.5" />
                            {showArchived ? `Hide archived (${archivedCount})` : `Show archived (${archivedCount})`}
                        </button>
                    )}
                    <button onClick={() => setShowModal(true)}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all">
                        <Plus className="w-4 h-4" /> New Task
                    </button>
                </div>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 mb-4 flex-wrap">
                {[{ key: 'ALL', label: `All (${tasks.length})` }, ...TASK_STATUS_COLS.map(c => ({ key: c.key, label: `${c.label} (${tasks.filter(t => t.status === c.key).length})` }))].map(({ key, label }) => (
                    <button key={key} onClick={() => setFilter(key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
                        {label}
                    </button>
                ))}
            </div>

            {/* Kanban */}
            <div className="flex-1 overflow-x-auto">
                <div className="flex gap-4 h-full min-w-max pb-4">
                    {TASK_STATUS_COLS.map(col => (
                        <div key={col.key} className="w-72 flex flex-col flex-shrink-0">
                            {/* Column header */}
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${col.border} bg-slate-800/30 mb-3`}>
                                <div className={`w-2 h-2 rounded-full ${col.color}`} />
                                <span className={`text-xs font-semibold uppercase tracking-wide ${col.light}`}>{col.label}</span>
                                <span className="ml-auto text-xs text-slate-500">{byStatus(col.key).length}</span>
                            </div>

                            {/* Cards */}
                            <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
                                {byStatus(col.key).length === 0 ? (
                                    <div className="flex items-center justify-center py-8 text-slate-700 text-xs border border-dashed border-slate-700/50 rounded-xl">
                                        No tasks
                                    </div>
                                ) : byStatus(col.key).map(task => (
                                    <div key={task.id} className={`relative bg-slate-800/60 border rounded-xl p-3 transition-all group cursor-pointer hover:border-slate-600 ${task.isArchived ? 'border-amber-500/20 opacity-60' : String(task.id) === String(autoTaskId) ? 'border-blue-500 ring-1 ring-blue-500/40' : 'border-slate-700/50'}`}
                                         onClick={() => setSelected(task)}>
                                        {/* Archive badge */}
                                        {task.isArchived && (
                                            <div className="flex items-center gap-1 text-xs text-amber-400 mb-1.5">
                                                <Archive className="w-3 h-3" /> Archived
                                            </div>
                                        )}
                                        {/* Archive/unarchive + duplicate + delete actions */}
                                        {(isManagerOrAdmin || String(task.createdBy?.id) === String(user?.id)) && (
                                            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={e => { e.stopPropagation(); handleDuplicateTask(task) }}
                                                        title="Duplicate task"
                                                        className="p-1 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-400/10 transition-all">
                                                    <Copy className="w-3 h-3" />
                                                </button>
                                                <button onClick={e => { e.stopPropagation(); task.isArchived ? handleUnarchiveTask(task.id) : handleArchiveTask(task.id) }}
                                                        title={task.isArchived ? 'Unarchive' : 'Archive'}
                                                        className="p-1 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-400/10 transition-all">
                                                    {task.isArchived ? <RotateCcw className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                                                </button>
                                                <button onClick={e => { e.stopPropagation(); handleDeleteTask(task.id) }}
                                                        title="Delete permanently"
                                                        className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all">
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                        {/* Priority + title */}
                                        <div className="flex items-start gap-2 mb-2">
                                            <span className={`text-xs px-1.5 py-0.5 rounded border font-medium flex-shrink-0 ${PRIORITY_COLOR[task.priority] || PRIORITY_COLOR.NORMAL}`}>
                                                {task.priority}
                                            </span>
                                        </div>
                                        <p className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors line-clamp-2">{task.title}</p>

                                        {/* Dependency badge */}
                                        {task.dependencies?.length > 0 && (
                                            <div className="flex items-center gap-1 mt-1.5 text-xs text-amber-400/80">
                                                <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 1z"/></svg>
                                                <span>{task.dependencies.length} dependenc{task.dependencies.length > 1 ? 'ies' : 'y'}</span>
                                            </div>
                                        )}

                                        {/* Assignee + due date */}
                                        <div className="flex items-center justify-between mt-2">
                                            {task.assignee ? (
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-5 h-5 rounded-full bg-blue-600/30 flex items-center justify-center flex-shrink-0">
                                                        <span className="text-blue-400 font-bold" style={{ fontSize: '9px' }}>{task.assignee.fullName?.charAt(0)}</span>
                                                    </div>
                                                    <span className="text-xs text-slate-400 truncate max-w-[80px]">{task.assignee.fullName?.split(' ')[0]}</span>
                                                </div>
                                            ) : <div />}
                                            {task.dueDate && (
                                                <div className="flex items-center gap-1 text-xs text-slate-500">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(task.dueDate).toLocaleDateString('en', { day: 'numeric', month: 'short' })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Create modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-slate-700">
                            <h2 className="text-base font-semibold text-white">New Task — {project.name}</h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Title *</label>
                                <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                                       placeholder="Task title..."
                                       className="w-full bg-slate-900/50 border border-slate-600/50 rounded-xl py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
                                <textarea rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                                          placeholder="Optional description..."
                                          className="w-full bg-slate-900/50 border border-slate-600/50 rounded-xl py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none" />
                            </div>

                            {/* Assignee / Reviewer — managers only */}
                            {isManagerOrAdmin && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Assignee</label>
                                        <SearchableSelect
                                            options={members.map(m => ({ value: m.user?.id, label: m.user?.fullName, sublabel: m.user?.email }))}
                                            value={form.assigneeId}
                                            onChange={v => setForm({...form, assigneeId: v || ''})}
                                            placeholder="None"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Reviewer</label>
                                        <SearchableSelect
                                            options={members.map(m => ({ value: m.user?.id, label: m.user?.fullName, sublabel: m.user?.email }))}
                                            value={form.reviewerId}
                                            onChange={v => setForm({...form, reviewerId: v || ''})}
                                            placeholder="None"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Priority</label>
                                    <SearchableSelect
                                        options={['LOW','NORMAL','HIGH','URGENT'].map(p => ({ value: p, label: p }))}
                                        value={form.priority}
                                        onChange={v => setForm({...form, priority: v || 'NORMAL'})}
                                        nullable={false}
                                        placeholder="Priority"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Due Date</label>
                                    <input type="date" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})}
                                           className="w-full bg-slate-900/50 border border-slate-600/50 rounded-xl py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                                </div>
                            </div>

                            {/* Initial Status */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Initial Status</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { key: 'TODO',     label: '✅ To Do',    desc: 'Ready to start immediately'   },
                                        { key: 'UPCOMING', label: '🔜 Upcoming', desc: 'Not yet actionable'            },
                                    ].map(s => (
                                        <button key={s.key} type="button"
                                                onClick={() => setForm({...form, initialStatus: s.key})}
                                                className={`py-2.5 px-3 rounded-xl text-left text-xs font-medium border transition-all ${
                                                    form.initialStatus === s.key
                                                        ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                                                        : 'bg-slate-700/30 border-slate-600/50 text-slate-400 hover:text-white'
                                                }`}>
                                            <div>{s.label}</div>
                                            <div className="text-slate-500 font-normal mt-0.5" style={{fontSize:'10px'}}>{s.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Multi-dependency picker */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                                    Depends on
                                    {form.dependsOnTaskIds.length > 0 && (
                                        <span className="bg-blue-600 text-white text-xs rounded-full px-1.5">{form.dependsOnTaskIds.length}</span>
                                    )}
                                </label>
                                <input type="text" value={depSearch} onChange={e => setDepSearch(e.target.value)}
                                       placeholder="Search tasks..."
                                       className="w-full bg-slate-900/50 border border-slate-600/50 rounded-xl py-2 px-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs mb-1.5" />
                                {depSearch && (
                                    <div className="max-h-28 overflow-y-auto space-y-1 border border-slate-700 rounded-xl p-2 bg-slate-900/50">
                                        {tasks.filter(t => t.title.toLowerCase().includes(depSearch.toLowerCase())).slice(0,6).map(t => (
                                            <div key={t.id} onClick={() => toggleDep(t.id)}
                                                 className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs transition-all ${form.dependsOnTaskIds.includes(String(t.id)) ? 'bg-blue-600/20 text-blue-300' : 'text-slate-400 hover:bg-slate-800'}`}>
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${form.dependsOnTaskIds.includes(String(t.id)) ? 'bg-blue-600 border-blue-600' : 'border-slate-600'}`}>
                                                    {form.dependsOnTaskIds.includes(String(t.id)) && <span className="text-white text-xs">✓</span>}
                                                </div>
                                                <span className="font-medium truncate flex-1">{t.title}</span>
                                                <span className="text-slate-500 text-xs">{t.status.replace('_',' ')}</span>
                                            </div>
                                        ))}
                                        {tasks.filter(t => t.title.toLowerCase().includes(depSearch.toLowerCase())).length === 0 && (
                                            <p className="text-xs text-slate-600 text-center py-2">No tasks found</p>
                                        )}
                                    </div>
                                )}
                                {form.dependsOnTaskIds.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                        {form.dependsOnTaskIds.map(id => {
                                            const t = tasks.find(t => String(t.id) === id)
                                            return t ? (
                                                <span key={id} className="flex items-center gap-1 bg-blue-600/20 text-blue-300 text-xs px-2 py-0.5 rounded-full">
                                                    {t.title.slice(0,22)}{t.title.length > 22 ? '…' : ''}
                                                    <button type="button" onClick={() => toggleDep(t.id)} className="hover:text-red-400">×</button>
                                                </span>
                                            ) : null
                                        })}
                                    </div>
                                )}
                                {form.dependsOnTaskIds.length > 0 && (
                                    <p className="text-xs text-amber-400 mt-1.5">⚠️ Task will stay Upcoming until all dependencies are Done</p>
                                )}
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)}
                                        className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:text-white text-sm font-medium transition-all">
                                    Cancel
                                </button>
                                <button type="submit" disabled={creating}
                                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium text-sm transition-all flex items-center justify-center gap-2">
                                    {creating ? <><Loader2 className="w-4 h-4 animate-spin" />Creating...</> : 'Create Task'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Task detail modal */}
            {selected && (
                <ProjectTaskModal
                    task={selected}
                    members={members}
                    allTasks={tasks}
                    userId={userId}
                    onClose={() => setSelected(null)}
                    onAction={handleAction}
                    onRefresh={fetchTasks}
                />
            )}
        </div>
    )
}

// ─── Project Task Modal ───────────────────────────────────────────────────────

function ProjectTaskModal({ task, members, allTasks = [], userId, onClose, onAction, onRefresh }) {
    const [tab, setTab]                     = useState('details')
    const [subtasks, setSubtasks]           = useState([])
    const [comments, setComments]           = useState([])
    const [attachments, setAttachments]     = useState([])
    const [comment, setComment]             = useState('')
    const [newSubtask, setNewSubtask]       = useState('')
    const [sendingComment, setSendingComment] = useState(false)
    const [uploadingFile, setUploadingFile] = useState(false)
    const [rejectReason, setRejectReason]   = useState('')
    const [rejecting, setRejecting]         = useState(false)
    const [showReject, setShowReject]       = useState(false)

    // Edit form
    const [editForm, setEditForm] = useState({
        title:            task.title        || '',
        description:      task.description  || '',
        assigneeId:       task.assignee?.id || '',
        reviewerId:       task.reviewer?.id || '',
        priority:         task.priority     || 'NORMAL',
        startDate:        task.startDate    || '',
        dueDate:          task.dueDate      || '',
        dependsOnTaskIds: task.dependencies?.map(d => String(d.id)) || [],
    })
    const [saving, setSaving] = useState(false)

    const isAssignee = String(task.assignee?.id) === String(userId)
    const isReviewer = String(task.reviewer?.id) === String(userId)
    const isCreator  = String(task.createdBy?.id) === String(userId)
    const canEdit    = isReviewer || isCreator
    const canAct     = isAssignee || isReviewer || isCreator

    const ACTION = {
        TODO:      isAssignee ? { label: 'Submit for Review', action: 'submit',  color: 'bg-amber-600 hover:bg-amber-500' } : null,
        IN_REVIEW: isReviewer ? { label: 'Approve Task',      action: 'approve', color: 'bg-emerald-600 hover:bg-emerald-500' } : null,
    }
    const currentAction = ACTION[task.status]

    useEffect(() => {
        api.get(`/tasks/${task.id}/subtasks`).then(r => setSubtasks(r.data.data || [])).catch(() => {})
        api.get(`/tasks/${task.id}/comments`).then(r => setComments(r.data.data || [])).catch(() => {})
        api.get(`/tasks/${task.id}/attachments`).then(r => setAttachments(r.data.data || [])).catch(() => {})
    }, [task.id])

    const handleUploadAttachment = async file => {
        if (!file) return
        if (file.size > 50 * 1024 * 1024) { toast.error('Max 50MB'); return }
        setUploadingFile(true)
        const fd = new FormData(); fd.append('file', file)
        try {
            await api.post(`/tasks/${task.id}/attachments`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
            toast.success('File attached!')
            const r = await api.get(`/tasks/${task.id}/attachments`)
            setAttachments(r.data.data || [])
        } catch (err) { toast.error(err.response?.data?.message || 'Upload failed') }
        finally { setUploadingFile(false) }
    }

    const handleDeleteAttachment = async attId => {
        try {
            await api.delete(`/tasks/attachments/${attId}`)
            setAttachments(prev => prev.filter(a => a.id !== attId))
        } catch { toast.error('Failed') }
    }

    const handleDownloadAttachment = async (att) => {
        try {
            const res = await api.get(`/tasks/attachments/${att.id}/download`, { responseType: 'blob' })
            const url = URL.createObjectURL(res.data)
            const a = document.createElement('a')
            a.href = url
            a.download = att.originalName || 'file'
            document.body.appendChild(a)
            a.click()
            setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a) }, 200)
        } catch { toast.error('Download failed') }
    }


    const handleSaveEdit = async e => {
        e.preventDefault(); setSaving(true)
        try {
            await api.patch(`/tasks/${task.id}`, {
                title:            editForm.title        || null,
                description:      editForm.description  || null,
                assigneeId:       editForm.assigneeId   ? parseInt(editForm.assigneeId)   : null,
                reviewerId:       editForm.reviewerId   ? parseInt(editForm.reviewerId)   : null,
                priority:         editForm.priority     || null,
                startDate:        editForm.startDate    || null,
                dueDate:          editForm.dueDate      || null,
                dependsOnTaskIds: editForm.dependsOnTaskIds.length
                    ? editForm.dependsOnTaskIds.map(Number)
                    : [],   // empty array = clear all deps
            })
            toast.success('Task updated!')
            onRefresh(); onClose()
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to update') }
        finally { setSaving(false) }
    }

    const handleComment = async e => {
        e.preventDefault(); if (!comment.trim()) return
        setSendingComment(true)
        try {
            await api.post(`/tasks/${task.id}/comments`, { content: comment })
            setComment('')
            const r = await api.get(`/tasks/${task.id}/comments`)
            setComments(r.data.data || [])
        } catch { toast.error('Failed') }
        finally { setSendingComment(false) }
    }

    const handleAddSubtask = async e => {
        e.preventDefault(); if (!newSubtask.trim()) return
        try {
            await api.post(`/tasks/${task.id}/subtasks`, { title: newSubtask })
            setNewSubtask('')
            const r = await api.get(`/tasks/${task.id}/subtasks`)
            setSubtasks(r.data.data || [])
        } catch {}
    }

    const handleToggleSubtask = async (subtaskId, currentDone) => {
        try {
            await api.patch(`/tasks/subtasks/${subtaskId}`, { completed: !currentDone })
            const r = await api.get(`/tasks/${task.id}/subtasks`)
            setSubtasks(r.data.data || [])
        } catch (err) { toast.error('Failed to update subtask') }
    }

    const handleDeleteSubtask = async (subtaskId) => {
        try {
            await api.delete(`/tasks/subtasks/${subtaskId}`)
            setSubtasks(prev => prev.filter(s => s.id !== subtaskId))
        } catch (err) { toast.error('Failed to delete subtask') }
    }

    const handleReject = async e => {
        e.preventDefault(); if (!rejectReason.trim()) return
        setRejecting(true)
        try {
            await api.patch(`/tasks/${task.id}/reject`, { reason: rejectReason })
            toast.success('Task rejected')
            onRefresh()
            onClose()
        } catch (err) { toast.error(err.response?.data?.message || 'Failed') }
        finally { setRejecting(false) }
    }

    const completedSubtasks = subtasks.filter(s => s.isCompleted === true || s.completed === true).length
    const statusBadge = {
        TODO:      'bg-slate-500/20 text-slate-300 border-slate-500/30',
        IN_REVIEW: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        DONE:      'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        UPCOMING:  'bg-purple-500/20 text-purple-300 border-purple-500/30',
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">

                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-slate-700 flex-shrink-0">
                    <div className="flex-1 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusBadge[task.status] || statusBadge.TODO}`}>
                                {task.status?.replace('_', ' ')}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded border font-medium ${PRIORITY_COLOR[task.priority] || PRIORITY_COLOR.NORMAL}`}>
                                {task.priority}
                            </span>
                        </div>
                        <h2 className="text-lg font-semibold text-white">{task.title}</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white flex-shrink-0"><X className="w-5 h-5" /></button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 px-6 pt-4">
                    {['details', 'subtasks', 'comments', 'attachments'].map(t => (
                        <button key={t} onClick={() => setTab(t)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${tab === t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                            {t}{t === 'subtasks' && subtasks.length > 0 && ` (${completedSubtasks}/${subtasks.length})`}
                            {t === 'comments' && comments.length > 0 && ` (${comments.length})`}
                            {t === 'attachments' && attachments.length > 0 && ` (${attachments.length})`}
                        </button>
                    ))}
                    {/* Edit tab — visible uniquement pour reviewer / créateur */}
                    {canEdit && (
                        <button onClick={() => setTab('edit')}
                                className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    tab === 'edit'
                                        ? 'bg-amber-500 text-white'
                                        : 'text-amber-400 border border-amber-500/30 hover:bg-amber-500/10'
                                }`}>
                            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-.5zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z"/>
                            </svg>
                            Edit Task
                        </button>
                    )}
                </div>

                <div className="p-6">

                    {/* Details tab */}
                    {tab === 'details' && (
                        <div className="space-y-4">
                            {task.rejectionReason && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                                    <p className="text-xs text-red-400 font-medium mb-1 flex items-center gap-1">⚠️ Rejection Reason</p>
                                    <p className="text-sm text-red-300">{task.rejectionReason}</p>
                                </div>
                            )}
                            {task.description && (
                                <div>
                                    <p className="text-xs text-slate-500 mb-1">Description</p>
                                    <p className="text-sm text-slate-300">{task.description}</p>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-700/30 rounded-xl p-3">
                                    <p className="text-xs text-slate-500 mb-1">Assignee</p>
                                    <p className="text-sm text-white">{task.assignee?.fullName || '—'}</p>
                                </div>
                                <div className="bg-slate-700/30 rounded-xl p-3">
                                    <p className="text-xs text-slate-500 mb-1">Reviewer</p>
                                    <p className="text-sm text-white">{task.reviewer?.fullName || '—'}</p>
                                </div>
                                {task.dueDate && (
                                    <div className="bg-slate-700/30 rounded-xl p-3">
                                        <p className="text-xs text-slate-500 mb-1">Due Date</p>
                                        <p className="text-sm text-white">{new Date(task.dueDate).toLocaleDateString()}</p>
                                    </div>
                                )}
                                <div className="bg-slate-700/30 rounded-xl p-3">
                                    <p className="text-xs text-slate-500 mb-1">Created by</p>
                                    <p className="text-sm text-white">{task.createdBy?.fullName || '—'}</p>
                                </div>
                            </div>
                            {/* Dependencies */}
                            {task.dependencies?.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs text-slate-400 font-medium">Depends on ({task.dependencies.length})</p>
                                    {task.dependencies.map(dep => (
                                        <div key={dep.id} className={`flex items-center gap-3 p-3 rounded-xl border ${
                                            dep.status === 'DONE'
                                                ? 'bg-emerald-500/10 border-emerald-500/20'
                                                : 'bg-amber-500/10 border-amber-500/20'
                                        }`}>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-white truncate">{dep.title}</p>
                                                <p className={`text-xs font-medium mt-0.5 ${dep.status === 'DONE' ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                    {dep.status === 'DONE'
                                                        ? '✅ Completed — dependency met'
                                                        : `⏳ ${dep.status.replace(/_/g, ' ')} — blocking this task`
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    {task.status === 'UPCOMING' && (
                                        <p className="text-xs text-slate-500 text-center">All dependencies must be Done before this task unlocks.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Subtasks tab */}
                    {tab === 'subtasks' && (
                        <div className="space-y-3">
                            {subtasks.length > 0 && (
                                <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden mb-4">
                                    <div className="h-full bg-emerald-500 rounded-full transition-all"
                                         style={{ width: `${Math.round(completedSubtasks / subtasks.length * 100)}%` }} />
                                </div>
                            )}
                            {subtasks.map(s => {
                                const done = s.isCompleted === true || s.completed === true
                                return (
                                    <div key={s.id} className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-xl group">
                                        <button onClick={() => handleToggleSubtask(s.id, done)}
                                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${done ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500 hover:border-blue-400'}`}>
                                            {done && <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="currentColor"><path d="M10 3L5 8.5 2 5.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
                                        </button>
                                        <span className={`text-sm flex-1 ${done ? 'line-through text-slate-500' : 'text-slate-200'}`}>{s.title}</span>
                                        <button onClick={() => handleDeleteSubtask(s.id)}
                                                className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all flex-shrink-0">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )
                            })}
                            {subtasks.length === 0 && <p className="text-sm text-slate-500 text-center py-4">No subtasks yet</p>}
                            <form onSubmit={handleAddSubtask} className="flex gap-2 mt-2">
                                <input value={newSubtask} onChange={e => setNewSubtask(e.target.value)} placeholder="Add a subtask..."
                                       className="flex-1 bg-slate-900/50 border border-slate-600/50 rounded-xl py-2 px-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <button type="submit" className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-white text-sm font-medium transition-all">Add</button>
                            </form>
                        </div>
                    )}

                    {/* Comments tab */}
                    {tab === 'comments' && (
                        <div className="space-y-4">
                            <div className="space-y-3 max-h-64 overflow-y-auto">
                                {comments.length === 0 ? (
                                    <p className="text-sm text-slate-500 text-center py-4">No comments yet</p>
                                ) : comments.map(c => (
                                    <div key={c.id} className="flex gap-3">
                                        <div className="w-7 h-7 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                                            <span className="text-blue-400 text-xs font-bold">{c.author?.fullName?.charAt(0) || c.user?.fullName?.charAt(0)}</span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-xs font-medium text-white">{c.author?.fullName || c.user?.firstName || c.user?.fullName}</span>
                                                <span className="text-xs text-slate-500">{new Date(c.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-sm text-slate-300">{c.content}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <form onSubmit={handleComment} className="flex gap-2">
                                <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Write a comment..."
                                       className="flex-1 bg-slate-900/50 border border-slate-600/50 rounded-xl py-2 px-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <button type="submit" disabled={sendingComment || !comment.trim()}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-white text-sm font-medium transition-all disabled:opacity-50">
                                    {sendingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* Attachments tab */}
                    {tab === 'attachments' && (
                        <div className="space-y-4">
                            {/* Upload zone — assignee ou reviewer seulement */}
                            {(isAssignee || isReviewer) && (
                                <label className={`flex items-center justify-center gap-3 w-full py-4 rounded-xl border-2 border-dashed text-sm cursor-pointer transition-all ${
                                    uploadingFile
                                        ? 'border-slate-600 text-slate-500 cursor-not-allowed'
                                        : 'border-slate-600 hover:border-blue-500 text-slate-400 hover:text-blue-400'
                                }`}>
                                    {uploadingFile ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                                    ) : (
                                        <><Upload className="w-4 h-4" /> Click or drag a file to attach <span className="text-slate-600 text-xs">(max 50MB)</span></>
                                    )}
                                    <input type="file" className="hidden" disabled={uploadingFile}
                                           onChange={e => handleUploadAttachment(e.target.files[0])} />
                                </label>
                            )}

                            {/* Files list */}
                            {attachments.length === 0 ? (
                                <p className="text-sm text-slate-500 text-center py-6">No attachments yet</p>
                            ) : (
                                <div className="space-y-2">
                                    {attachments.map(att => (
                                        <div key={att.id} className="flex items-center gap-3 p-3 bg-slate-800/60 border border-slate-700/50 rounded-xl">
                                            <div className="text-xl flex-shrink-0">
                                                {att.mimeType?.includes('image') ? '🖼️'
                                                    : att.mimeType?.includes('pdf') ? '📕'
                                                        : att.mimeType?.includes('word') ? '📝'
                                                            : att.mimeType?.includes('sheet') ? '📊'
                                                                : '📄'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-white truncate">{att.originalName}</p>
                                                <p className="text-xs text-slate-400">
                                                    {att.fileSize ? (att.fileSize / 1024).toFixed(1) + ' KB' : ''} · by {att.uploadedBy?.fullName} · {new Date(att.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => handleDownloadAttachment(att)}
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all" title="Download">
                                                    <Download className="w-4 h-4" />
                                                </button>
                                                {String(att.uploadedBy?.id) === String(userId) && (
                                                    <button onClick={() => handleDeleteAttachment(att.id)}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all" title="Delete">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Edit tab */}
                    {tab === 'edit' && canEdit && (
                        <form onSubmit={handleSaveEdit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Title *</label>
                                <input required value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})}
                                       className="w-full bg-slate-900/50 border border-slate-600/50 rounded-xl py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
                                <textarea rows={3} value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})}
                                          className="w-full bg-slate-900/50 border border-slate-600/50 rounded-xl py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Assignee</label>
                                    <SearchableSelect
                                        options={members.map(m => ({ value: m.user?.id, label: m.user?.fullName, sublabel: m.user?.email }))}
                                        value={editForm.assigneeId}
                                        onChange={v => setEditForm({...editForm, assigneeId: v || ''})}
                                        placeholder="None"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Reviewer</label>
                                    <SearchableSelect
                                        options={members.map(m => ({ value: m.user?.id, label: m.user?.fullName, sublabel: m.user?.email }))}
                                        value={editForm.reviewerId}
                                        onChange={v => setEditForm({...editForm, reviewerId: v || ''})}
                                        placeholder="None"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Priority</label>
                                    <SearchableSelect
                                        options={['LOW','NORMAL','HIGH','URGENT'].map(p => ({ value: p, label: p }))}
                                        value={editForm.priority}
                                        onChange={v => setEditForm({...editForm, priority: v || 'NORMAL'})}
                                        nullable={false}
                                        placeholder="Priority"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Start Date</label>
                                    <input type="date" value={editForm.startDate} onChange={e => setEditForm({...editForm, startDate: e.target.value})}
                                           className="w-full bg-slate-900/50 border border-slate-600/50 rounded-xl py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Due Date</label>
                                <input type="date" value={editForm.dueDate} onChange={e => setEditForm({...editForm, dueDate: e.target.value})}
                                       className="w-full bg-slate-900/50 border border-slate-600/50 rounded-xl py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                                    Depends on
                                    {editForm.dependsOnTaskIds.length > 0 && (
                                        <span className="bg-blue-600 text-white text-xs rounded-full px-1.5">{editForm.dependsOnTaskIds.length}</span>
                                    )}
                                </label>
                                <div className="max-h-32 overflow-y-auto space-y-1 border border-slate-700/50 rounded-xl p-2 bg-slate-900/30">
                                    {allTasks.filter(t => t.id !== task.id).map(t => {
                                        const sel = editForm.dependsOnTaskIds.includes(String(t.id))
                                        return (
                                            <div key={t.id} onClick={() => setEditForm(f => ({
                                                ...f,
                                                dependsOnTaskIds: sel
                                                    ? f.dependsOnTaskIds.filter(id => id !== String(t.id))
                                                    : [...f.dependsOnTaskIds, String(t.id)]
                                            }))}
                                                 className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs transition-all ${sel ? 'bg-blue-600/20 text-blue-300' : 'text-slate-400 hover:bg-slate-800'}`}>
                                                <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${sel ? 'bg-blue-600 border-blue-600' : 'border-slate-600'}`}>
                                                    {sel && <span className="text-white text-xs">✓</span>}
                                                </div>
                                                <span className="flex-1 truncate font-medium">{t.title}</span>
                                                <span className="text-slate-500">{t.status.replace('_',' ')}</span>
                                            </div>
                                        )
                                    })}
                                    {allTasks.filter(t => t.id !== task.id).length === 0 && (
                                        <p className="text-xs text-slate-600 text-center py-2">No other tasks</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setTab('details')}
                                        className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:text-white text-sm font-medium transition-all">
                                    Cancel
                                </button>
                                <button type="submit" disabled={saving}
                                        className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 text-white font-medium text-sm transition-all flex items-center justify-center gap-2">
                                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Action buttons */}
                    {canAct && task.status !== 'DONE' && task.status !== 'UPCOMING' && (
                        <div className="mt-6 pt-4 border-t border-slate-700 space-y-3">
                            {currentAction && (
                                <button onClick={() => onAction(task.id, currentAction.action)}
                                        className={`w-full py-2.5 rounded-xl text-white font-medium text-sm transition-all ${currentAction.color}`}>
                                    {currentAction.label}
                                </button>
                            )}
                            {task.status === 'IN_REVIEW' && isReviewer && (
                                <>
                                    {!showReject ? (
                                        <button onClick={() => setShowReject(true)}
                                                className="w-full py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 font-medium text-sm transition-all">
                                            Reject Task
                                        </button>
                                    ) : (
                                        <form onSubmit={handleReject} className="space-y-2">
                                            <textarea rows={2} required value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                                                      placeholder="Reason for rejection..."
                                                      className="w-full bg-slate-900/50 border border-red-500/30 rounded-xl py-2 px-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
                                            <div className="flex gap-2">
                                                <button type="button" onClick={() => setShowReject(false)}
                                                        className="flex-1 py-2 rounded-xl border border-slate-600 text-slate-400 text-sm transition-all">Cancel</button>
                                                <button type="submit" disabled={rejecting}
                                                        className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-all">
                                                    {rejecting ? 'Rejecting...' : 'Confirm Reject'}
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
// This file is temporary — content gets appended to ProjectsPage.jsx

// ─── Inherited Tab ────────────────────────────────────────────────────────────

function InheritedTab({ projectId, linkedProjectId }) {
    const { user } = useAuthStore()
    const [info, setInfo]           = useState(null)
    const [tasks, setTasks]         = useState([])
    const [decisions, setDecisions] = useState([])
    const [members, setMembers]     = useState([])
    const [files, setFiles]         = useState([])
    const [convId, setConvId]       = useState(null)
    const [loading, setLoading]     = useState(true)
    const [tab, setTab]             = useState('info')
    const [expandedTask, setExpandedTask] = useState(null)
    const [taskFiles, setTaskFiles] = useState({})
    const [previewFile, setPreviewFile] = useState(null)

    // Chat state
    const [chatMessages, setChatMessages] = useState([])
    const [chatInput, setChatInput]       = useState('')
    const [chatLoading, setChatLoading]   = useState(false)
    const [chatSending, setChatSending]   = useState(false)
    const chatEndRef = useRef(null)

    useEffect(() => {
        if (!linkedProjectId) { setLoading(false); return }
        const load = async () => {
            try {
                const [infoRes, tasksRes, decisionsRes, membersRes, convRes] = await Promise.all([
                    api.get(`/projects/${projectId}/inherited/info`),
                    api.get(`/projects/${projectId}/inherited/tasks`),
                    api.get(`/projects/${projectId}/inherited/decisions`),
                    api.get(`/projects/${projectId}/inherited/members`),
                    api.get(`/projects/${projectId}/inherited/conversation`).catch(() => ({ data: { data: null } })),
                ])
                setInfo(infoRes.data.data)
                setTasks(tasksRes.data.data || [])
                setDecisions(decisionsRes.data.data || [])
                setMembers(membersRes.data.data || [])
                setConvId(convRes.data.data)

                // Load files for the linked project
                const linkedId = infoRes.data.data?.id
                if (linkedId) {
                    api.get(`/files/project/${linkedId}`).then(r => setFiles(r.data.data || [])).catch(() => {})
                }
            } catch { toast.error('Failed to load inherited data') }
            finally { setLoading(false) }
        }
        load()
    }, [projectId, linkedProjectId])

    // Load chat messages when tab switches to 'chat'
    useEffect(() => {
        if (tab !== 'chat' || !convId) return
        setChatLoading(true)
        api.get(`/chat/conversations/${convId}/messages?page=0&size=50`)
            .then(r => { setChatMessages((r.data.data || []).reverse()) })
            .catch(() => {})
            .finally(() => { setChatLoading(false) })
    }, [tab, convId])

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [chatMessages])

    const sendChatMessage = async e => {
        e.preventDefault()
        if (!chatInput.trim() || !convId) return
        setChatSending(true)
        try {
            const res = await api.post(`/chat/conversations/${convId}/messages`, { content: chatInput, messageType: 'TEXT' })
            setChatMessages(prev => [...prev, res.data.data])
            setChatInput('')
        } catch { toast.error('Failed to send') }
        finally { setChatSending(false) }
    }

    const loadTaskFiles = async (taskId) => {
        if (taskFiles[taskId]) return
        try {
            const res = await api.get(`/tasks/${taskId}/attachments`).catch(() => null)
            setTaskFiles(prev => ({ ...prev, [taskId]: res?.data?.data || [] }))
        } catch { setTaskFiles(prev => ({ ...prev, [taskId]: [] })) }
    }

    if (!linkedProjectId) return (
        <div className="flex flex-col items-center justify-center py-24 text-slate-500">
            <GitBranch className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-lg font-medium">No linked project</p>
            <p className="text-sm mt-1">Link to a previous project when creating a new one</p>
        </div>
    )

    if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin w-6 h-6 text-blue-500" /></div>

    const subTabs = [
        { key: 'info',      label: 'Info' },
        { key: 'tasks',     label: `Tasks (${tasks.length})` },
        { key: 'files',     label: `Files (${files.length})` },
        { key: 'decisions', label: `Decisions (${decisions.length})` },
        { key: 'members',   label: `Members (${members.length})` },
        ...(convId ? [{ key: 'chat', label: 'Chat' }] : []),
    ]

    return (
        <div className="space-y-4">
            {info && (
                <div className="flex items-center gap-3 p-4 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center flex-shrink-0">
                        <GitBranch className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-white">Inherited from <span className="text-indigo-300">{info.name}</span></p>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {info.status}
                            {info.startDate && ` · Started ${new Date(info.startDate).toLocaleDateString()}`}
                        </p>
                    </div>
                    <span className={`ml-auto text-xs px-2.5 py-1 rounded-full border font-medium ${
                        info.status === 'ARCHIVED' ? 'bg-slate-500/20 text-slate-400 border-slate-500/30' :
                            info.status === 'COMPLETED' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                                'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    }`}>{info.status}</span>
                </div>
            )}

            {/* Sub-tabs */}
            <div className="flex flex-wrap gap-1">
                {subTabs.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === t.key ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Info tab */}
            {tab === 'info' && info && (
                <div className="space-y-3">
                    {info.description && (
                        <div className="p-4 bg-slate-800/60 border border-slate-700/50 rounded-xl">
                            <p className="text-xs text-slate-500 mb-1">Description</p>
                            <p className="text-sm text-slate-300">{info.description}</p>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        {info.startDate && <div className="p-3 bg-slate-800/60 border border-slate-700/50 rounded-xl"><p className="text-xs text-slate-500 mb-1">Start Date</p><p className="text-sm text-white">{new Date(info.startDate).toLocaleDateString()}</p></div>}
                        {info.endDate && <div className="p-3 bg-slate-800/60 border border-slate-700/50 rounded-xl"><p className="text-xs text-slate-500 mb-1">End Date</p><p className="text-sm text-white">{new Date(info.endDate).toLocaleDateString()}</p></div>}
                    </div>
                </div>
            )}

            {/* Tasks tab */}
            {tab === 'tasks' && (
                <div className="space-y-2">
                    {tasks.length === 0
                        ? <p className="text-slate-500 text-sm text-center py-8">No tasks in inherited project</p>
                        : tasks.map(t => (
                            <div key={t.id} className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden">
                                <button
                                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-700/30 transition-all"
                                    onClick={() => {
                                        setExpandedTask(expandedTask === t.id ? null : t.id)
                                        if (expandedTask !== t.id) loadTaskFiles(t.id)
                                    }}
                                >
                                    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium flex-shrink-0 ${PRIORITY_COLOR[t.priority] || PRIORITY_COLOR.NORMAL}`}>{t.priority}</span>
                                    <span className="text-sm text-white flex-1 truncate">{t.title}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === 'DONE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-600/50 text-slate-400'}`}>{t.status?.replace('_',' ')}</span>
                                    <ChevronRight className={`w-3.5 h-3.5 text-slate-500 transition-transform ${expandedTask === t.id ? 'rotate-90' : ''}`} />
                                </button>
                                {expandedTask === t.id && (
                                    <div className="px-3 pb-3 border-t border-slate-700/40 pt-3 space-y-2">
                                        {t.description && <p className="text-xs text-slate-400">{t.description}</p>}
                                        <div className="flex gap-3 text-xs text-slate-500">
                                            {t.assignee && <span>Assignee: <span className="text-slate-300">{t.assignee.fullName}</span></span>}
                                            {t.dueDate && <span>Due: <span className="text-slate-300">{new Date(t.dueDate).toLocaleDateString()}</span></span>}
                                        </div>
                                        {/* Task files */}
                                        <div>
                                            <p className="text-xs text-slate-500 mb-1.5">Files</p>
                                            {!taskFiles[t.id] ? (
                                                <p className="text-xs text-slate-600">Loading…</p>
                                            ) : taskFiles[t.id].length === 0 ? (
                                                <p className="text-xs text-slate-600">No files</p>
                                            ) : (
                                                <div className="space-y-1">
                                                    {taskFiles[t.id].map(f => (
                                                        <div key={f.id} className="flex items-center gap-2 p-1.5 bg-slate-700/30 rounded-lg">
                                                            <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                                            <span className="text-xs text-slate-300 flex-1 truncate">{f.originalName || f.fileName}</span>
                                                            {f.downloadUrl && (
                                                                <a href={f.downloadUrl} target="_blank" rel="noopener noreferrer"
                                                                   className="p-1 text-slate-400 hover:text-blue-400 transition-all" title="Open">
                                                                    <Eye className="w-3 h-3" />
                                                                </a>
                                                            )}
                                                            {f.downloadUrl && (
                                                                <a href={f.downloadUrl} download={f.originalName}
                                                                   className="p-1 text-slate-400 hover:text-white transition-all" title="Download">
                                                                    <Download className="w-3 h-3" />
                                                                </a>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    }
                </div>
            )}

            {/* Files tab */}
            {tab === 'files' && (
                <div className="space-y-2">
                    {files.length === 0
                        ? <p className="text-slate-500 text-sm text-center py-8">No files in inherited project</p>
                        : files.map(f => (
                            <div key={f.id} className="flex items-center gap-3 p-3 bg-slate-800/60 border border-slate-700/50 rounded-xl">
                                <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-white truncate">{f.originalName}</p>
                                    <p className="text-xs text-slate-500">{f.mimeType} · v{f.version || 1}</p>
                                </div>
                                <button onClick={() => setPreviewFile(f)} className="p-1.5 text-slate-400 hover:text-blue-400 transition-all" title="Preview"><Eye className="w-4 h-4" /></button>
                                <button onClick={async () => {
                                    try {
                                        const res = await api.get(`/files/${f.id}/download`, { responseType: 'blob' })
                                        const url = URL.createObjectURL(res.data)
                                        const a = document.createElement('a'); a.href = url; a.download = f.originalName || 'file'; a.click()
                                        URL.revokeObjectURL(url)
                                    } catch { toast.error('Download failed') }
                                }} className="p-1.5 text-slate-400 hover:text-white transition-all" title="Download"><Download className="w-4 h-4" /></button>
                            </div>
                        ))
                    }
                </div>
            )}

            {/* Decisions tab */}
            {tab === 'decisions' && (
                <div className="space-y-2">
                    {decisions.length === 0 ? <p className="text-slate-500 text-sm text-center py-8">No decisions in inherited project</p>
                        : decisions.map(d => (
                            <div key={d.id} className="p-3 bg-slate-800/60 border border-slate-700/50 rounded-xl">
                                <p className="text-sm font-medium text-white mb-1">{d.title}</p>
                                <p className="text-xs text-slate-400 line-clamp-2">{d.decision}</p>
                                {d.madeBy && <p className="text-xs text-slate-600 mt-1">{d.madeBy.fullName} · {new Date(d.createdAt).toLocaleDateString()}</p>}
                            </div>
                        ))
                    }
                </div>
            )}

            {/* Members tab */}
            {tab === 'members' && (
                <div className="space-y-2">
                    {members.length === 0 ? <p className="text-slate-500 text-sm text-center py-8">No members</p>
                        : members.map(m => {
                            const u = m.user || m
                            return (
                                <div key={u.id || u.userId} className="flex items-center gap-3 p-3 bg-slate-800/60 border border-slate-700/50 rounded-xl">
                                    <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                                        <span className="text-blue-400 text-sm font-bold">{(u.fullName || u.email || '?').charAt(0).toUpperCase()}</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-white">{u.fullName}</p>
                                        <p className="text-xs text-slate-400">{u.email}</p>
                                    </div>
                                    {m.role && <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-1 rounded-lg">{m.role}</span>}
                                </div>
                            )
                        })
                    }
                </div>
            )}

            {/* Chat tab */}
            {tab === 'chat' && convId && (
                <div className="flex flex-col bg-slate-800/40 rounded-xl border border-slate-700/50 overflow-hidden" style={{ height: 420 }}>
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {chatLoading ? (
                            <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin w-5 h-5 text-slate-400" /></div>
                        ) : chatMessages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
                                <p className="text-sm">No messages yet in this conversation</p>
                            </div>
                        ) : chatMessages.map(msg => {
                            const isOwn = msg.sender?.id === user?.id
                            return (
                                <div key={msg.id} className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                                    <div className="w-6 h-6 rounded-full bg-blue-600/30 flex items-center justify-center flex-shrink-0 self-end text-xs text-blue-400 font-bold">
                                        {msg.sender?.fullName?.charAt(0) || '?'}
                                    </div>
                                    <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${isOwn ? 'bg-indigo-600/30 text-white rounded-br-sm' : 'bg-slate-700/60 text-white rounded-bl-sm'}`}>
                                        {!isOwn && <p className="text-xs text-indigo-400 font-medium mb-0.5">{msg.sender?.fullName}</p>}
                                        <p className="text-sm leading-relaxed">{msg.content}</p>
                                        <p className="text-xs text-slate-500 mt-0.5 text-right">{msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                                    </div>
                                </div>
                            )
                        })}
                        <div ref={chatEndRef} />
                    </div>
                    {/* Input */}
                    <form onSubmit={sendChatMessage} className="flex gap-2 p-3 border-t border-slate-700/50">
                        <input
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            placeholder="Message this conversation…"
                            className="flex-1 bg-slate-900/50 border border-slate-600/50 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button type="submit" disabled={!chatInput.trim() || chatSending}
                                className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white transition-all">
                            <Send className="w-4 h-4" />
                        </button>
                    </form>
                </div>
            )}

            {previewFile && <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
        </div>
    )
}
