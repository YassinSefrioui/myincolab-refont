import { useEffect, useState, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Users, Plus, X, Trash2, UserPlus, UserMinus, Loader2, Shield,
    ChevronRight, ChevronDown, GitBranch, ChevronLeft, Archive, RotateCcw, Lock } from 'lucide-react'
import SearchableSelect from '../components/SearchableSelect'
import gsap from 'gsap'
import api from '../api/axios'
import useAuthStore from '../store/authStore'
import useVoiceStore from '../store/voiceStore'
import toast from 'react-hot-toast'
import UserProfileModal from '../components/UserProfileModal.jsx'

export default function GroupsPage() {
    const { t } = useTranslation()
    const { user } = useAuthStore()
    const location = useLocation()
    const navigate = useNavigate()
    const { joinChannel: joinVoiceChannel } = useVoiceStore()
    const isAdmin        = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
    const userId         = user?.id || user?.userId
    const canManageGroup = (g) => isAdmin || String(g?.createdBy?.id) === String(userId)

    const [groups, setGroups]           = useState([])
    const [allGroups, setAllGroups]     = useState([])
    const [allUsers, setAllUsers]       = useState([])
    const [loading, setLoading]         = useState(true)
    const [selected, setSelected]       = useState(null)
    const [subGroups, setSubGroups]     = useState([])
    const [expanded, setExpanded]       = useState({})
    const [showCreate, setShowCreate]   = useState(false)
    const [showCreateSub, setShowCreateSub] = useState(false)
    const [form, setForm]               = useState({ name: '', description: '', parentGroupId: null })
    const [creating, setCreating]       = useState(false)
    const [addMemberValue, setAddMemberValue] = useState(null)
    const [isMobile, setIsMobile]       = useState(window.innerWidth < 768)
    const [showArchived, setShowArchived] = useState(false)
    const [profileUser,  setProfileUser]  = useState(null)
    // Users eligible for subgroup (restricted to parent group members)
    const [eligibleUsers, setEligibleUsers] = useState([])

    const containerRef = useRef(null)

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.fromTo('.groups-header',
                { opacity: 0, y: -24, scale: 0.97 },
                { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'power3.out', clearProps: 'transform' }
            )
            gsap.fromTo('.group-card',
                { opacity: 0, y: 22, scale: 0.93, rotateX: 6 },
                { opacity: 1, y: 0, scale: 1, rotateX: 0, duration: 0.45, stagger: 0.07, delay: 0.12, ease: 'back.out(1.3)', clearProps: 'transform' }
            )
            // Members list stagger
            gsap.fromTo('.group-member-row',
                { opacity: 0, x: -12 },
                { opacity: 1, x: 0, duration: 0.25, stagger: 0.03, delay: 0.25, ease: 'power2.out', clearProps: 'transform' }
            )
        }, containerRef)
        return () => ctx.revert()
    }, [])

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [])

    const fetchGroups = async () => {
        try {
            const [rootRes, allRes] = await Promise.all([
                api.get('/groups/root'),
                api.get('/groups'),
            ])
            setGroups(rootRes.data.data || [])
            setAllGroups(allRes.data.data || [])
        } catch { toast.error('Failed to load groups') }
        finally { setLoading(false) }
    }

    useEffect(() => {
        fetchGroups()
        api.get('/users').then(r => setAllUsers(r.data.data || [])).catch(() => {})
    }, [])

    // Deep-link from global search
    useEffect(() => {
        if (loading || !location.state?.openGroupId) return
        const targetId = String(location.state.openGroupId)
        const found = allGroups.find(g => String(g.id) === targetId)
        if (found) { selectGroup(found); window.history.replaceState({}, '', location.pathname) }
    }, [loading, allGroups, location.state])

    useEffect(() => {
        if (!selected) return
        api.get(`/groups/${selected.id}/subgroups`)
            .then(r => setSubGroups(r.data.data || []))
            .catch(() => setSubGroups([]))
        // When viewing a subgroup, fetch eligible members from the parent group
        if (selected.parentGroupId) {
            api.get(`/groups/${selected.parentGroupId}/eligible-members`)
                .then(r => setEligibleUsers(r.data.data || []))
                .catch(() => setEligibleUsers([]))
        } else {
            setEligibleUsers([])
        }
    }, [selected?.id])

    // When opening the "create subgroup" form, fetch eligible members (parent group members)
    const openCreateSubgroup = async (parentGroupId) => {
        setForm({ name: '', description: '', parentGroupId })
        setShowCreateSub(true)
        try {
            const res = await api.get(`/groups/${parentGroupId}/eligible-members`)
            setEligibleUsers(res.data.data || [])
        } catch { setEligibleUsers([]) }
    }

    const handleCreate = async e => {
        e.preventDefault(); setCreating(true)
        try {
            if (form.parentGroupId) {
                await api.post(`/groups/${form.parentGroupId}/subgroups`, {
                    name: form.name, description: form.description
                })
                toast.success('Subgroup created!')
            } else {
                await api.post('/groups', { name: form.name, description: form.description })
                toast.success('Group created!')
            }
            setShowCreate(false); setShowCreateSub(false)
            setForm({ name: '', description: '', parentGroupId: null })
            fetchGroups()
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create')
        } finally { setCreating(false) }
    }

    const selectGroup = g => { setSelected(g); if (isMobile) {} }

    const handleAddMember = async (groupId, userId) => {
        if (!userId) return
        try {
            await api.post(`/groups/${groupId}/members/${userId}`)
            toast.success('Member added')
            fetchGroups()
            if (selected?.id === groupId) {
                const res = await api.get(`/groups/${groupId}`)
                setSelected(res.data.data)
            }
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to add member') }
        setAddMemberValue(null)
    }

    const handleRemoveMember = async (groupId, userId) => {
        try {
            await api.delete(`/groups/${groupId}/members/${userId}`)
            toast.success('Member removed')
            fetchGroups()
            if (selected?.id === groupId) {
                const res = await api.get(`/groups/${groupId}`)
                setSelected(res.data.data)
            }
        } catch { toast.error('Failed to remove member') }
    }

    const handleDeleteGroup = async (groupId) => {
        if (!confirm('Delete this group permanently?')) return
        try {
            await api.delete(`/groups/${groupId}`)
            toast.success('Group deleted')
            if (selected?.id === groupId) setSelected(null)
            fetchGroups()
        } catch { toast.error('Failed to delete') }
    }

    const handleArchive = async (groupId, archive) => {
        try {
            await api.patch(`/groups/${groupId}/${archive ? 'archive' : 'unarchive'}`)
            toast.success(archive ? 'Group archived' : 'Group restored')
            fetchGroups()
            if (selected?.id === groupId) setSelected(null)
        } catch { toast.error('Failed') }
    }

    const activeGroups   = groups.filter(g => !g.isArchived)
    const archivedGroups = groups.filter(g => g.isArchived)

    if (loading) return (
        <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
        </div>
    )

    return (
        <div ref={containerRef} className="flex h-full overflow-hidden">
            {/* ── Groups List ──────────────────────────────────────────── */}
            <div className={`flex flex-col border-r overflow-hidden ${isMobile && selected ? 'hidden' : ''}`}
                 style={{ width: isMobile ? '100%' : '320px', background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', flexShrink: 0 }}>

                <div className="groups-header flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-400" />
                        <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{t('groups.title')}</h1>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-medium">{activeGroups.length}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        {/* Only ADMIN can create groups */}
                        {isAdmin ? (
                            <button onClick={() => { setForm({ name:'', description:'', parentGroupId: null }); setShowCreate(true) }}
                                    className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all" title="New Group">
                                <Plus className="w-4 h-4" />
                            </button>
                        ) : (
                            <div className="p-2 rounded-lg" style={{ color: 'var(--text-muted)' }} title="Only ADMIN can create groups">
                                <Lock className="w-4 h-4" />
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                    {activeGroups.length === 0 ? (
                        <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
                            <Users className="w-8 h-8 mx-auto mb-2 opacity-20" />
                            <p className="text-sm">{t('groups.noGroupsYet')}</p>
                            {isAdmin && (
                                <button onClick={() => setShowCreate(true)} className="mt-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
                                    {t('groups.createOne')}
                                </button>
                            )}
                        </div>
                    ) : activeGroups.map(g => (
                        <button key={g.id}
                                onClick={() => selectGroup(g)}
                                className={`group-card w-full text-left px-3 py-3 rounded-xl transition-all ${selected?.id === g.id ? 'bg-blue-600/20 border border-blue-500/40' : 'hover:bg-slate-700/40 border border-transparent'}`}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                                    <Users className="w-4 h-4 text-blue-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{g.name}</p>
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{g.members?.length || 0} {t('groups.members')}</p>
                                </div>
                                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                            </div>
                        </button>
                    ))}

                    {/* Archived toggle */}
                    {archivedGroups.length > 0 && (
                        <div className="pt-2">
                            <button onClick={() => setShowArchived(v => !v)}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all"
                                    style={{ color: 'var(--text-muted)' }}>
                                {showArchived ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                <Archive className="w-3.5 h-3.5" />
                                {archivedGroups.length} archived
                            </button>
                            {showArchived && archivedGroups.map(g => (
                                <div key={g.id} className="flex items-center gap-2 px-3 py-2 rounded-xl opacity-50">
                                    <Users className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                    <span className="text-sm flex-1 truncate" style={{ color: 'var(--text-muted)' }}>{g.name}</span>
                                    {isAdmin && (
                                        <button onClick={() => handleArchive(g.id, false)}
                                                className="p-1 rounded hover:bg-slate-700 transition-all" title={t('groups.restore')}>
                                            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Group Detail ─────────────────────────────────────────── */}
            {selected ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                    {isMobile && (
                        <button onClick={() => setSelected(null)} className="flex items-center gap-2 p-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            <ChevronLeft className="w-4 h-4" /> {t('groups.back')}
                        </button>
                    )}
                    <div className="flex items-center justify-between p-6" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                        <div>
                            <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                <Users className="w-5 h-5 text-blue-400" /> {selected.name}
                            </h2>
                            {selected.description && (
                                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{selected.description}</p>
                            )}
                        </div>
                        {(isAdmin || canManageGroup(selected)) && (
                            <div className="flex items-center gap-2">
                                {isAdmin && (
                                    <button onClick={() => openCreateSubgroup(selected.id)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 transition-all border border-purple-500/20">
                                        <GitBranch className="w-3.5 h-3.5" /> {t('groups.addSubgroup')}
                                    </button>
                                )}
                                <button onClick={() => handleArchive(selected.id, !selected.isArchived)}
                                        className="p-2 rounded-lg hover:bg-slate-700/50 transition-all" style={{ color: 'var(--text-muted)' }}
                                        title={selected.isArchived ? t('groups.restore') : 'Archive'}>
                                    {selected.isArchived ? <RotateCcw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                                </button>
                                <button onClick={() => handleDeleteGroup(selected.id)}
                                        className="p-2 rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-all" style={{ color: 'var(--text-muted)' }}
                                        title={t('groups.deleteGroup')}>
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Members */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                    Members ({selected.members?.length || 0})
                                </h3>
                            </div>

                            {/* Add member — admin only; subgroups restricted to parent members */}
                            {isAdmin && (
                                <div className="mb-3">
                                    <SearchableSelect
                                        options={(selected.parentGroupId ? eligibleUsers : allUsers)
                                            .filter(u => !selected.members?.some(m => m.id === u.id))
                                            .map(u => ({ value: u.id, label: u.fullName, sublabel: u.email }))}
                                        value={addMemberValue}
                                        onChange={uid => handleAddMember(selected.id, uid)}
                                        placeholder="Add a member..."
                                    />
                                    {selected.parentGroupId && eligibleUsers.length === 0 && (
                                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                            All parent group members are already in this subgroup.
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="space-y-2">
                                {(selected.members || []).map(m => (
                                    <div key={m.id} className="group-member-row flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:border-blue-500/30 transition-all"
                                         style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}
                                         onClick={() => setProfileUser(m)}>
                                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                                            <span className="text-xs font-bold text-white">{m.fullName?.charAt(0)}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{m.fullName}</p>
                                            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{m.role}</p>
                                        </div>
                                        {isAdmin && (
                                            <button onClick={e => { e.stopPropagation(); handleRemoveMember(selected.id, m.id) }}
                                                    className="p-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-all flex-shrink-0"
                                                    style={{ color: 'var(--text-muted)' }}>
                                                <UserMinus className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Subgroups */}
                        {subGroups.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                    <GitBranch className="w-4 h-4 text-purple-400" /> {t('groups.subgroups')} ({subGroups.length})
                                </h3>
                                <div className="space-y-2">
                                    {subGroups.map(sg => (
                                        <div key={sg.id} className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:border-purple-500/30 transition-all"
                                             style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}
                                             onClick={() => selectGroup(sg)}>
                                            <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                                <GitBranch className="w-4 h-4 text-purple-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{sg.name}</p>
                                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{sg.members?.length || 0} members</p>
                                            </div>
                                            <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
                    <div className="text-center">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">{t('groups.selectGroupToViewDetails')}</p>
                    </div>
                </div>
            )}

            {/* ── User Profile Modal ────────────────────────────────── */}
            {profileUser && (
                <UserProfileModal
                    user={profileUser}
                    onClose={() => setProfileUser(null)}
                    onMessage={async (u) => {
                        setProfileUser(null)
                        navigate('/chat', { state: { openDmUserId: u.id } })
                    }}
                    onVoiceCall={async (u) => {
                        setProfileUser(null)
                        try {
                            const res = await api.post(`/chat/conversations/direct/${u.id}`)
                            const conv = res.data.data
                            if (conv) joinVoiceChannel('CONVERSATION', null, conv.id, `Call with ${u.fullName}`, 'audio')
                        } catch { toast.error('Could not start call') }
                    }}
                    onVideoCall={async (u) => {
                        setProfileUser(null)
                        try {
                            const res = await api.post(`/chat/conversations/direct/${u.id}`)
                            const conv = res.data.data
                            if (conv) joinVoiceChannel('CONVERSATION', null, conv.id, `Call with ${u.fullName}`, 'video')
                        } catch { toast.error('Could not start video call') }
                    }}
                />
            )}

            {/* ── Create Group Modal ─────────────────────────────────── */}
            {(showCreate || showCreateSub) && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="rounded-2xl w-full max-w-md shadow-2xl border"
                         style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                        <div className="flex items-center justify-between p-6" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                                {form.parentGroupId ? (
                                    <span className="flex items-center gap-2"><GitBranch className="w-5 h-5 text-purple-400" /> {t('groups.newSubgroup')}</span>
                                ) : (
                                    <span className="flex items-center gap-2"><Users className="w-5 h-5 text-blue-400" /> {t('groups.newGroup')}</span>
                                )}
                            </h2>
                            <button onClick={() => { setShowCreate(false); setShowCreateSub(false) }} style={{ color: 'var(--text-secondary)' }}>
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {form.parentGroupId && eligibleUsers.length > 0 && (
                            <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                                <p className="text-xs text-purple-300 flex items-center gap-1.5">
                                    <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                                    Only the {eligibleUsers.length} members of the parent group can be added to this subgroup.
                                </p>
                            </div>
                        )}

                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('groups.name')}</label>
                                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                       placeholder={form.parentGroupId ? t('groups.subgroupName') : t('groups.groupName')}
                                       className="w-full rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                       style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('groups.description')}</label>
                                <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                                          placeholder={t('groups.optionalDescription')}
                                          className="w-full rounded-xl py-2.5 px-4 text-sm focus:outline-none resize-none"
                                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }} />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => { setShowCreate(false); setShowCreateSub(false) }}
                                        className="flex-1 py-2.5 rounded-xl text-sm transition-all border"
                                        style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={creating}
                                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 text-white font-medium text-sm transition-all flex items-center justify-center gap-2">
                                    {creating ? <><Loader2 className="w-4 h-4 animate-spin" />Creating...</> : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
