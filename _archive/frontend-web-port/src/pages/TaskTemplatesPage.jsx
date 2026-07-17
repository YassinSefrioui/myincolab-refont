import { useEffect, useState, useRef } from 'react'
import { Layers, Plus, X, Loader2, Trash2, Play, CheckSquare, Eye, Pencil, Share2, Users, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../api/axios'
import useAuthStore from '../store/authStore'
import toast from 'react-hot-toast'
import gsap from 'gsap'

const PRIORITY_COLORS = {
    LOW:    'bg-green-500/20 text-green-400 border-green-500/30',
    NORMAL: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    HIGH:   'bg-orange-500/20 text-orange-400 border-orange-500/30',
    URGENT: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export default function TaskTemplatesPage() {
    const { t } = useTranslation()
    const { user } = useAuthStore()
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

    const pageRef = useRef(null)
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

    const [templates, setTemplates]   = useState([])
    const [projects, setProjects]     = useState([])
    const [allGroups, setAllGroups]   = useState([])
    const [allUsers, setAllUsers]     = useState([])
    const [loading, setLoading]       = useState(true)

    // Modals
    const [showCreate, setShowCreate]   = useState(false)
    const [showApply, setShowApply]     = useState(false)
    const [showView, setShowView]       = useState(false)
    const [showEdit, setShowEdit]       = useState(false)
    const [showShare, setShowShare]     = useState(false)

    const [selected, setSelected]       = useState(null)
    const [selectedProject, setSelectedProject] = useState('')
    const [creating, setCreating]       = useState(false)
    const [applying, setApplying]       = useState(false)
    const [saving, setSaving]           = useState(false)

    // Share state
    const [shareGroupIds, setShareGroupIds]   = useState([])
    const [shareUserIds, setShareUserIds]     = useState([])
    const [sharing, setSharing]               = useState(false)

    const [form, setForm] = useState({
        name: '',
        description: '',
        items: [{ title: '', description: '', priority: 'NORMAL', orderIndex: 0 }]
    })

    const fetchTemplates = async () => {
        try {
            const res = await api.get('/tasks/templates')
            setTemplates(res.data.data || [])
        } catch { toast.error('Failed to load templates') }
        finally { setLoading(false) }
    }

    useEffect(() => {
        fetchTemplates()
        api.get('/projects').then(r => setProjects(r.data.data || [])).catch(() => {})
        api.get('/groups').then(r => setAllGroups(r.data.data || [])).catch(() => {})
        api.get('/users').then(r => setAllUsers(r.data.data || [])).catch(() => {})
    }, [])

    const resetForm = () => setForm({ name: '', description: '', items: [{ title: '', description: '', priority: 'NORMAL', orderIndex: 0 }] })

    const addTaskItem = () => setForm(prev => ({
        ...prev,
        items: [...prev.items, { title: '', description: '', priority: 'NORMAL', orderIndex: prev.items.length }]
    }))

    const removeTaskItem = (i) => {
        if (form.items.length === 1) return
        setForm(prev => ({ ...prev, items: prev.items.filter((_, idx) => idx !== i).map((item, idx) => ({ ...item, orderIndex: idx })) }))
    }

    const updateTaskItem = (i, field, val) => setForm(prev => ({
        ...prev,
        items: prev.items.map((item, idx) => idx === i ? { ...item, [field]: val } : item)
    }))

    const handleCreate = async (e) => {
        e.preventDefault(); setCreating(true)
        try {
            await api.post('/tasks/templates', form)
            toast.success('Template created!')
            setShowCreate(false); resetForm(); fetchTemplates()
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to create') }
        finally { setCreating(false) }
    }

    const handleDelete = async (templateId) => {
        if (!confirm('Delete this template?')) return
        try {
            await api.delete(`/tasks/templates/${templateId}`)
            toast.success('Template deleted')
            fetchTemplates()
        } catch { toast.error('Failed to delete') }
    }

    const handleApply = async () => {
        if (!selectedProject) { toast.error('Select a project'); return }
        setApplying(true)
        try {
            await api.post(`/tasks/templates/${selected.id}/apply/${selectedProject}`)
            toast.success('Template applied!')
            setShowApply(false); setSelected(null); setSelectedProject('')
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to apply') }
        finally { setApplying(false) }
    }

    const openEdit = (tpl) => {
        setSelected(tpl)
        setForm({
            name: tpl.name,
            description: tpl.description || '',
            items: (tpl.items || []).map((item, i) => ({
                title: item.title,
                description: item.description || '',
                priority: item.priority || 'NORMAL',
                orderIndex: i
            }))
        })
        setShowEdit(true)
    }

    const handleSaveEdit = async (e) => {
        e.preventDefault(); setSaving(true)
        try {
            await api.put(`/tasks/templates/${selected.id}`, form)
            toast.success('Template updated!')
            setShowEdit(false); setSelected(null); resetForm(); fetchTemplates()
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to save') }
        finally { setSaving(false) }
    }

    const openShare = (tpl) => {
        setSelected(tpl)
        setShareGroupIds(tpl.sharedGroupIds || [])
        setShareUserIds(tpl.sharedUserIds || [])
        setShowShare(true)
    }

    const handleShare = async () => {
        setSharing(true)
        try {
            await api.patch(`/tasks/templates/${selected.id}/share`, {
                groupIds: shareGroupIds,
                userIds:  shareUserIds,
            })
            toast.success('Template shared!')
            setShowShare(false); setSelected(null); fetchTemplates()
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to share') }
        finally { setSharing(false) }
    }

    const canEdit = (tpl) => isAdmin || String(tpl.createdBy?.id) === String(user?.id)

    if (loading) return (
        <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
        </div>
    )

    return (
        <div ref={pageRef} className="p-6 space-y-6 w-full min-h-full">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Layers className="w-6 h-6 text-blue-400" /> {t('templates.title')}
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">{templates.length} {t('templates.templatesAvailable')}</p>
                </div>
                <button onClick={() => { resetForm(); setShowCreate(true) }}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-600/20">
                    <Plus className="w-4 h-4" /> {t('templates.newTemplate')}
                </button>
            </div>

            {/* Grid */}
            {templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                    <Layers className="w-16 h-16 mb-4 opacity-20" />
                    <p className="text-lg font-medium">{t('templates.noTemplatesFound')}</p>
                    <button onClick={() => setShowCreate(true)}
                            className="mt-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all">
                        <Plus className="w-4 h-4" /> {t('templates.createFirstTemplate')}
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {templates.map(tpl => (
                        <div key={tpl.id}
                             className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 hover:border-blue-500/40 hover:bg-slate-800/80 transition-all group flex flex-col">

                            <div className="flex items-start justify-between mb-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center">
                                    <Layers className="w-5 h-5 text-blue-400" />
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {/* View */}
                                    <button onClick={() => { setSelected(tpl); setShowView(true) }}
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 transition-all" title={t('templates.view')}>
                                        <Eye className="w-4 h-4" />
                                    </button>
                                    {/* Edit — creator or admin */}
                                    {canEdit(tpl) && (
                                        <button onClick={() => openEdit(tpl)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 transition-all" title="Edit">
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                    )}
                                    {/* Share */}
                                    {canEdit(tpl) && (
                                        <button onClick={() => openShare(tpl)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-purple-400 hover:bg-purple-400/10 transition-all" title="Share">
                                            <Share2 className="w-4 h-4" />
                                        </button>
                                    )}
                                    {/* Delete */}
                                    {canEdit(tpl) && (
                                        <button onClick={() => handleDelete(tpl.id)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all" title="Delete">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <h3 className="font-semibold text-white mb-1 group-hover:text-blue-300 transition-colors">{tpl.name}</h3>
                            <p className="text-xs text-slate-400 line-clamp-2 mb-3">{tpl.description || t('templates.noDescription')}</p>

                            <div className="flex items-center justify-between mb-4 mt-auto">
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <CheckSquare className="w-3 h-3" /> {tpl.taskCount || tpl.items?.length || 0} {t('templates.tasks')}
                                </div>
                                <span className="text-xs text-slate-500">{new Date(tpl.createdAt).toLocaleDateString()}</span>
                            </div>

                            {/* Shared with badge */}
                            {(tpl.sharedGroupIds?.length > 0 || tpl.sharedUserIds?.length > 0) && (
                                <div className="flex items-center gap-1.5 mb-3 text-xs text-purple-400">
                                    <Share2 className="w-3 h-3" />
                                    Shared with {(tpl.sharedGroupIds?.length || 0) + (tpl.sharedUserIds?.length || 0)} recipient(s)
                                </div>
                            )}

                            <button onClick={() => { setSelected(tpl); setShowApply(true) }}
                                    className="w-full flex items-center justify-center gap-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 px-3 py-2 rounded-xl text-sm font-medium transition-all">
                                <Play className="w-4 h-4" /> {t('templates.applyToProject')}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* ── View Modal ──────────────────────────────────────────── */}
            {showView && selected && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-slate-700">
                            <div>
                                <h2 className="text-xl font-bold text-white">{selected.name}</h2>
                                {selected.description && <p className="text-sm text-slate-400 mt-0.5">{selected.description}</p>}
                            </div>
                            <button onClick={() => { setShowView(false); setSelected(null) }}
                                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-3">
                            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-4">
                                {selected.items?.length || 0} Tasks
                            </p>
                            {(selected.items || []).map((item, i) => (
                                <div key={i} className="p-4 bg-slate-700/30 border border-slate-600/50 rounded-xl">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-white">{item.title}</p>
                                            {item.description && <p className="text-xs text-slate-400 mt-1">{item.description}</p>}
                                        </div>
                                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.NORMAL}`}>
                                            {item.priority}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-6 border-t border-slate-700 flex gap-3">
                            {canEdit(selected) && (
                                <button onClick={() => { setShowView(false); openEdit(selected) }}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/30 text-sm font-medium hover:bg-amber-600/30 transition-all">
                                    <Pencil className="w-4 h-4" /> {t('templates.edit')}
                                </button>
                            )}
                            <button onClick={() => { setShowView(false); setShowApply(true) }}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600/20 text-green-400 border border-green-500/30 text-sm font-medium hover:bg-green-600/30 transition-all">
                                <Play className="w-4 h-4" /> {t('templates.applyToProject')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Edit Modal ──────────────────────────────────────────── */}
            {showEdit && selected && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-slate-700">
                            <h2 className="text-xl font-bold text-white">{t('templates.editTemplate')}</h2>
                            <button onClick={() => { setShowEdit(false); setSelected(null); resetForm() }}
                                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveEdit} className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">{t('templates.templateName')}</label>
                                    <input type="text" required value={form.name}
                                           onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                                           className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                                           placeholder="Template name" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                                    <textarea value={form.description} rows={2}
                                              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                                              className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none resize-none"
                                              placeholder="Description" />
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <label className="block text-sm font-medium text-slate-300">{t('templates.taskItems')}</label>
                                    <button type="button" onClick={addTaskItem}
                                            className="flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-lg text-sm transition-all">
                                        <Plus className="w-4 h-4" /> {t('templates.addTask')}
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {form.items.map((item, i) => (
                                        <div key={i} className="bg-slate-700/30 border border-slate-600/50 rounded-xl p-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-sm font-medium text-slate-300">Task {i + 1}</span>
                                                {form.items.length > 1 && (
                                                    <button type="button" onClick={() => removeTaskItem(i)}
                                                            className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 mb-3">
                                                <div>
                                                    <label className="block text-xs text-slate-400 mb-1">Title</label>
                                                    <input type="text" required value={item.title}
                                                           onChange={e => updateTaskItem(i, 'title', e.target.value)}
                                                           className="w-full bg-slate-600/50 border border-slate-500 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
                                                           placeholder="Task title" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-slate-400 mb-1">Priority</label>
                                                    <select value={item.priority} onChange={e => updateTaskItem(i, 'priority', e.target.value)}
                                                            className="w-full bg-slate-600/50 border border-slate-500 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none">
                                                        <option value="LOW">Low</option>
                                                        <option value="NORMAL">Normal</option>
                                                        <option value="HIGH">High</option>
                                                        <option value="URGENT">Urgent</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <textarea value={item.description} rows={2}
                                                      onChange={e => updateTaskItem(i, 'description', e.target.value)}
                                                      className="w-full bg-slate-600/50 border border-slate-500 rounded-lg px-3 py-2 text-white text-sm resize-none focus:border-blue-500 focus:outline-none"
                                                      placeholder="Description" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-3 pt-4 border-t border-slate-700">
                                <button type="button" onClick={() => { setShowEdit(false); setSelected(null); resetForm() }}
                                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-3 rounded-xl font-medium transition-all">
                                    Cancel
                                </button>
                                <button type="submit" disabled={saving}
                                        className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2">
                                    {saving ? <><Loader2 className="animate-spin w-4 h-4" /> Saving...</> : t('templates.saveChanges')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Share Modal ─────────────────────────────────────────── */}
            {showShare && selected && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-slate-700">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Share2 className="w-5 h-5 text-purple-400" /> {t('templates.shareTemplate')}
                            </h2>
                            <button onClick={() => { setShowShare(false); setSelected(null) }}
                                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <p className="text-sm text-slate-400">Share <strong className="text-white">"{selected.name}"</strong> with groups or specific users.</p>

                            {/* Groups */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                                    <Users className="w-4 h-4 text-blue-400" /> {t('templates.groups')}
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {allGroups.map(g => (
                                        <button key={g.id} type="button"
                                                onClick={() => setShareGroupIds(prev =>
                                                    prev.includes(g.id) ? prev.filter(id => id !== g.id) : [...prev, g.id]
                                                )}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                                                    shareGroupIds.includes(g.id)
                                                        ? 'bg-blue-600 border-blue-500 text-white'
                                                        : 'border-slate-600 text-slate-400 hover:border-blue-500/50'
                                                }`}>
                                            {g.name}
                                        </button>
                                    ))}
                                    {allGroups.length === 0 && <p className="text-xs text-slate-500">{t('templates.noGroupsAvailable')}</p>}
                                </div>
                            </div>

                            {/* Users */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                                    <User className="w-4 h-4 text-purple-400" /> {t('templates.individualUsers')}
                                </label>
                                <div className="space-y-1 max-h-48 overflow-y-auto">
                                    {allUsers.filter(u => String(u.id) !== String(user?.id)).map(u => (
                                        <label key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700/50 cursor-pointer transition-all">
                                            <input type="checkbox" checked={shareUserIds.includes(u.id)}
                                                   onChange={() => setShareUserIds(prev =>
                                                       prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                                                   )}
                                                   className="rounded" />
                                            <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                                                {u.fullName?.charAt(0)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm text-white truncate">{u.fullName}</p>
                                                <p className="text-xs text-slate-500 truncate">{u.role}</p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2 border-t border-slate-700">
                                <button onClick={() => { setShowShare(false); setSelected(null) }}
                                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-3 rounded-xl font-medium transition-all">
                                    Cancel
                                </button>
                                <button onClick={handleShare} disabled={sharing}
                                        className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2">
                                    {sharing ? <><Loader2 className="animate-spin w-4 h-4" /> {t('templates.sharing')}</> : <><Share2 className="w-4 h-4" /> {t('templates.share')}</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Create Modal ─────────────────────────────────────────── */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-slate-700">
                            <h2 className="text-xl font-bold text-white">{t('templates.createNewTemplate')}</h2>
                            <button onClick={() => { setShowCreate(false); resetForm() }}
                                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">{t('templates.templateName')}</label>
                                    <input type="text" required value={form.name}
                                           onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                                           className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                                           placeholder="Template name" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                                    <textarea value={form.description} rows={3}
                                              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                                              className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none resize-none"
                                              placeholder="Description" />
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <label className="block text-sm font-medium text-slate-300">{t('templates.taskItems')}</label>
                                    <button type="button" onClick={addTaskItem}
                                            className="flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-lg text-sm transition-all">
                                        <Plus className="w-4 h-4" /> {t('templates.addTask')}
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {form.items.map((item, i) => (
                                        <div key={i} className="bg-slate-700/30 border border-slate-600/50 rounded-xl p-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-sm font-medium text-slate-300">Task {i + 1}</span>
                                                {form.items.length > 1 && (
                                                    <button type="button" onClick={() => removeTaskItem(i)}
                                                            className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 mb-3">
                                                <div>
                                                    <label className="block text-xs text-slate-400 mb-1">Title</label>
                                                    <input type="text" required value={item.title}
                                                           onChange={e => updateTaskItem(i, 'title', e.target.value)}
                                                           className="w-full bg-slate-600/50 border border-slate-500 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
                                                           placeholder="Task title" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-slate-400 mb-1">Priority</label>
                                                    <select value={item.priority} onChange={e => updateTaskItem(i, 'priority', e.target.value)}
                                                            className="w-full bg-slate-600/50 border border-slate-500 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none">
                                                        <option value="LOW">Low</option>
                                                        <option value="NORMAL">Normal</option>
                                                        <option value="HIGH">High</option>
                                                        <option value="URGENT">Urgent</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <textarea value={item.description} rows={2}
                                                      onChange={e => updateTaskItem(i, 'description', e.target.value)}
                                                      className="w-full bg-slate-600/50 border border-slate-500 rounded-lg px-3 py-2 text-white text-sm resize-none focus:border-blue-500 focus:outline-none"
                                                      placeholder="Description" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-3 pt-4 border-t border-slate-700">
                                <button type="button" onClick={() => { setShowCreate(false); resetForm() }}
                                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-3 rounded-xl font-medium transition-all">
                                    Cancel
                                </button>
                                <button type="submit" disabled={creating}
                                        className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2">
                                    {creating ? <><Loader2 className="animate-spin w-4 h-4" /> {t('templates.creating')}</> : <><Plus className="w-4 h-4" /> {t('templates.createNewTemplate')}</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Apply Modal ─────────────────────────────────────────── */}
            {showApply && selected && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md">
                        <div className="flex items-center justify-between p-6 border-b border-slate-700">
                            <h2 className="text-xl font-bold text-white">{t('templates.applyTemplate')}</h2>
                            <button onClick={() => { setShowApply(false); setSelected(null); setSelectedProject('') }}
                                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-slate-300">Apply <strong className="text-white">"{selected.name}"</strong> to:</p>
                            <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
                                    className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none">
                                <option value="">{t('templates.selectProject')}</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <div className="flex gap-3">
                                <button onClick={() => { setShowApply(false); setSelected(null); setSelectedProject('') }}
                                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-3 rounded-xl font-medium transition-all">
                                    Cancel
                                </button>
                                <button onClick={handleApply} disabled={applying || !selectedProject}
                                        className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2">
                                    {applying ? <><Loader2 className="animate-spin w-4 h-4" /> {t('templates.applying')}</> : <><Play className="w-4 h-4" /> {t('templates.applyTemplate')}</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
