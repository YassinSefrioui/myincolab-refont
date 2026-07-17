import { useState, useEffect, useCallback, useRef } from 'react'
import { Archive, FolderOpen, CheckSquare, Users, MessageSquare, FileText, RotateCcw, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../api/axios'
import toast from 'react-hot-toast'
import gsap from 'gsap'
import useAuthStore from '../store/authStore'

const TABS = [
    { key: 'projects',       label: 'Projects',       icon: FolderOpen  },
    { key: 'tasks',          label: 'Tasks',           icon: CheckSquare },
    { key: 'groups',         label: 'Groups',          icon: Users       },
    { key: 'conversations',  label: 'Conversations',   icon: MessageSquare },
    { key: 'folders',        label: 'Folders',         icon: Archive     },
    { key: 'files',          label: 'Files',           icon: FileText    },
]

export default function ArchivedPage() {
    const { t } = useTranslation()
    const { user } = useAuthStore()
    const isAdmin  = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
    const userId   = user?.id || user?.userId
    const pageRef  = useRef(null)
    const [activeTab, setActiveTab] = useState('projects')
    const [data, setData] = useState({
        projects: [], tasks: [], groups: [], conversations: [], folders: [], files: []
    })
    const [loading, setLoading] = useState(false)

    const fetchAll = useCallback(async () => {
        setLoading(true)
        try {
            // Fetch all archived folders (root + sub) via a dedicated endpoint or
            // fall back to fetching all accessible folders and filtering archived ones
            const [projects, tasks, groups, conversations, foldersRaw, filesRaw] = await Promise.allSettled([
                api.get('/projects').then(r => (r.data.data || []).filter(p => p.status === 'ARCHIVED')),
                api.get('/tasks/hub').then(r => (r.data.data || []).filter(t => t.isArchived)),
                api.get('/groups').then(r => (r.data.data || []).filter(g => g.isArchived)),
                api.get('/chat/conversations').then(r => (r.data.data || []).filter(c => c.isArchived)),
                api.get('/folders/archived').then(r => r.data.data || []),
                api.get('/files/my-documents').then(r => (r.data.data || []).filter(f => f.isArchived)),
            ])
            setData({
                projects:      projects.status      === 'fulfilled' ? projects.value      : [],
                tasks:         tasks.status         === 'fulfilled' ? tasks.value         : [],
                groups:        groups.status        === 'fulfilled' ? groups.value        : [],
                conversations: conversations.status === 'fulfilled' ? conversations.value : [],
                folders:       foldersRaw.status    === 'fulfilled' ? foldersRaw.value    : [],
                files:         filesRaw.status      === 'fulfilled' ? filesRaw.value      : [],
            })
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchAll() }, [fetchAll])

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

    useEffect(() => {
        const items = pageRef.current?.querySelectorAll('.archived-item')
        if (!items?.length) return
        gsap.fromTo(items, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.25, stagger: 0.04, ease: 'power2.out' })
    }, [activeTab, data])

    const unarchive = async (type, id) => {
        const endpoints = {
            projects:      `/projects/${id}/unarchive`,
            tasks:         `/tasks/${id}/unarchive`,
            groups:        `/groups/${id}/unarchive`,
            conversations: `/chat/conversations/${id}/unarchive`,
            folders:       `/folders/${id}/unarchive`,
            files:         `/files/${id}/unarchive`,
        }
        try {
            await api.patch(endpoints[type])
            toast.success('Restored successfully')
            fetchAll()
        } catch {
            toast.error('Failed to restore')
        }
    }

    const deleteItem = async (type, id, item) => {
        // Permission check: admin can delete anything; others only their own items
        if (!isAdmin) {
            const creatorId = item?.createdBy?.id || item?.creator?.id || item?.userId
            if (String(creatorId) !== String(userId)) {
                toast.error('Only the creator or an admin can delete this item')
                return
            }
        }
        const endpoints = {
            projects:      `/projects/${id}`,
            tasks:         `/tasks/${id}`,
            groups:        `/groups/${id}`,
            conversations: `/chat/conversations/${id}`,
            folders:       `/folders/${id}`,
            files:         `/files/${id}`,
        }
        if (!window.confirm('Delete permanently? This cannot be undone.')) return
        try {
            await api.delete(endpoints[type])
            toast.success('Deleted permanently')
            fetchAll()
        } catch {
            toast.error('Failed to delete')
        }
    }

    const items        = data[activeTab] || []
    const totalArchived = Object.values(data).reduce((s, arr) => s + arr.length, 0)

    return (
        <div ref={pageRef} className="p-6 max-w-5xl mx-auto min-h-full">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <Archive className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-white">{t('archived.title')}</h1>
                    <p className="text-sm text-slate-400">{totalArchived} {t('archived.archivedItem')}</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-slate-800/50 p-1 rounded-xl overflow-x-auto">
                {TABS.map(({ key, label, icon: Icon }) => {
                    const count = data[key]?.length || 0
                    return (
                        <button
                            key={key}
                            onClick={() => setActiveTab(key)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                                activeTab === key
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            {label}
                            {count > 0 && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                                    activeTab === key ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300'
                                }`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                    <Archive className="w-12 h-12 mb-3 opacity-30" />
                    <p className="text-sm">{t('archived.noArchivedFound', { type: activeTab })}</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {items.map(item => (
                        <ArchivedItem
                            key={item.id}
                            type={activeTab}
                            item={item}
                            isAdmin={isAdmin}
                            userId={userId}
                            onUnarchive={() => unarchive(activeTab, item.id)}
                            onDelete={() => deleteItem(activeTab, item.id, item)}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function ArchivedItem({ type, item, isAdmin, userId, onUnarchive, onDelete }) {
    const { t } = useTranslation()
    const getName = () => {
        if (type === 'tasks')         return item.title
        if (type === 'conversations') return item.name || item.projectName || `Conversation #${item.id}`
        if (type === 'files')         return item.originalName || item.fileName
        return item.name
    }

    const getSub = () => {
        if (type === 'projects') return `${item.status} · ${item.members?.length || 0} members`
        if (type === 'tasks')    return `${item.status} · ${item.priority}`
        if (type === 'groups')   return `${item.members?.length || 0} members`
        if (type === 'files')    return item.mimeType || ''
        return item.description || ''
    }

    const getIcon = () => {
        const icons = {
            projects: '📁', tasks: '✅', groups: '👥',
            conversations: '💬', folders: '🗂️', files: '📄'
        }
        return icons[type] || '📦'
    }

    // admin can delete anything; others only their own items
    const creatorId = item?.createdBy?.id || item?.creator?.id || item?.userId
    const isCreator = String(creatorId) === String(userId)
    const canDelete = isAdmin || isCreator

    return (
        <div className="archived-item flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-slate-600/50 transition-all group">
            <div className="w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center text-lg flex-shrink-0">
                {getIcon()}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{getName()}</p>
                {getSub() && <p className="text-xs text-slate-500 mt-0.5 truncate">{getSub()}</p>}
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button
                    onClick={onUnarchive}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all"
                    title="Restore"
                >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {t('archived.restore')}
                </button>
                {canDelete && (
                    <button
                        onClick={onDelete}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                        title="Delete permanently"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t('archived.delete')}
                    </button>
                )}
            </div>
        </div>
    )
}
