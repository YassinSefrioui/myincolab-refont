import SearchableSelect from '../components/SearchableSelect'
import { useEffect, useState, useRef } from 'react'
import { Users, Plus, X, Loader2, Shield, Check, Ban, Trash2, Key, ClipboardList, Copy, Search, Pencil, ShieldAlert, Unlock, Clock, RefreshCw, Globe, BarChart3, TrendingUp, Activity, FolderOpen, CheckSquare, AlertTriangle, Award, Zap, Target, MessageSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import useAuthStore from '../store/authStore'
import useVoiceStore from '../store/voiceStore'
import toast from 'react-hot-toast'
import { getAvatarUrl } from '../utils/avatarUrl'
import gsap from 'gsap'
import { COMMON_TIMEZONES } from '../components/TimezoneWidget'
import UserProfileModal from '../components/UserProfileModal.jsx'

const ROLE_COLOR = {
    SUPER_ADMIN: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
    ADMIN:       'text-red-400 bg-red-400/10 border-red-400/20',
    MANAGER:     'text-amber-400 bg-amber-400/10 border-amber-400/20',
    EMPLOYEE:    'text-blue-400 bg-blue-400/10 border-blue-400/20',
    GUEST:       'text-slate-400 bg-slate-400/10 border-slate-400/20',
}
const STATUS_COLOR = {
    ACTIVE:    'text-emerald-400 bg-emerald-400/10',
    SUSPENDED: 'text-red-400 bg-red-400/10',
    INACTIVE:  'text-slate-400 bg-slate-400/10',
}

export default function AdminPage() {
    const { t }      = useTranslation()
    const [tab, setTab] = useState('users')
    const containerRef  = useRef(null)

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.fromTo('.admin-header',
                { opacity: 0, y: -24, scale: 0.97 },
                { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'power3.out', clearProps: 'transform' }
            )
            gsap.fromTo('.admin-tabs-bar',
                { opacity: 0, y: 16 },
                { opacity: 1, y: 0, duration: 0.45, delay: 0.12, ease: 'back.out(1.2)' }
            )
            gsap.fromTo('.admin-stat',
                { opacity: 0, y: 20, scale: 0.9 },
                { opacity: 1, y: 0, scale: 1, duration: 0.45, stagger: 0.08, delay: 0.15, ease: 'back.out(1.4)', clearProps: 'transform' }
            )
        }, containerRef)
        return () => ctx.revert()
    }, [])

    useEffect(() => {
        gsap.fromTo('.admin-content',
            { opacity: 0, x: 16, scale: 0.99 },
            { opacity: 1, x: 0, scale: 1, duration: 0.35, ease: 'power2.out', clearProps: 'transform' }
        )
        // Animate table rows on tab switch
        setTimeout(() => {
            const rows = document.querySelectorAll('.admin-content tr, .admin-content .admin-row')
            if (rows.length) {
                gsap.fromTo(rows,
                    { opacity: 0, x: -10 },
                    { opacity: 1, x: 0, duration: 0.25, stagger: 0.03, ease: 'power2.out', clearProps: 'transform' }
                )
            }
        }, 50)
    }, [tab])

    return (
        <div ref={containerRef} className="p-6 space-y-6 w-full min-h-full" style={{ color: 'var(--text-primary)' }}>
            <div className="admin-header">
                <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Shield className="w-6 h-6 text-red-400" />
                    {t('admin.title')}
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{t('admin.description')}</p>
            </div>
            <div className="admin-tabs-bar flex gap-1 rounded-xl p-1 border w-fit"
                 style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                {[
                    { key: 'users',           label: t('admin.users'),          icon: Users        },
                    { key: 'guest-codes',     label: t('admin.guestCodes'),     icon: Key          },
                    { key: 'audit-logs',      label: t('admin.auditLogs'),      icon: ClipboardList },
                    { key: 'locked-accounts', label: t('admin.lockedAccounts'), icon: ShieldAlert  },
                    { key: 'timezones',       label: 'Timezones',               icon: Globe        },
                    { key: 'analytics',       label: 'Analytics',               icon: BarChart3    },
                ].map(({ key, label, icon: Icon }) => (
                    <button key={key} onClick={() => setTab(key)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                tab === key ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:text-white'
                            }`}>
                        <Icon className="w-4 h-4" />{label}
                    </button>
                ))}
            </div>
            <div className="admin-content">
                {tab === 'users'           && <UsersTab />}
                {tab === 'guest-codes'     && <GuestCodesTab />}
                {tab === 'audit-logs'      && <AuditLogsTab />}
                {tab === 'locked-accounts' && <LockedAccountsTab />}
                {tab === 'timezones'       && <TimezonesTab />}
                {tab === 'analytics'       && <AnalyticsTab />}
            </div>
        </div>
    )
}

// ── Users Tab ─────────────────────────────────────────────────────────────────

function UsersTab() {
    const { t }           = useTranslation()
    const navigate        = useNavigate()
    const { joinChannel: joinVoiceChannel } = useVoiceStore()
    const { user: currentUser } = useAuthStore()
    const [profileUser, setProfileUser] = useState(null)
    const [users, setUsers]         = useState([])
    const [loading, setLoading]     = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editTarget, setEditTarget] = useState(null)
    const [creating, setCreating]   = useState(false)
    const [saving, setSaving]       = useState(false)
    const [search, setSearch]       = useState('')
    const [filterRole, setFilterRole] = useState('ALL')
    const [form, setForm]     = useState({ fullName: '', email: '', password: '', role: 'EMPLOYEE' })
    const [editForm, setEditForm] = useState({ fullName: '', email: '', password: '', role: '' })
    const [allGroups, setAllGroups] = useState([])
    const [newUserGroupId, setNewUserGroupId] = useState('')
    const listRef = useRef(null)

    const fetchUsers = async () => {
        try { const res = await api.get('/users'); setUsers(res.data.data || []) }
        catch { toast.error(t('errors.failedToLoadUsers')) }
        finally { setLoading(false) }
    }
    useEffect(() => {
        fetchUsers()
        api.get('/groups/root').then(r => setAllGroups(r.data.data || [])).catch(() => {})
    }, [])

    useEffect(() => {
        if (!loading && users.length > 0) {
            gsap.fromTo('.user-row',
                { opacity: 0, x: -20 },
                { opacity: 1, x: 0, duration: 0.4, stagger: 0.04, ease: 'power2.out' }
            )
        }
    }, [loading])

    const handleCreate = async e => {
        e.preventDefault(); setCreating(true)
        try {
            const res = await api.post('/users/create', form)
            const newUserId = res.data?.data?.id
            if (newUserGroupId && newUserId) {
                await api.post(`/groups/${newUserGroupId}/members`, { userId: newUserId }).catch(() => {})
            }
            toast.success(t('admin.userCreatedWithEmail'))
            setShowModal(false)
            setForm({ fullName: '', email: '', password: '', role: 'EMPLOYEE' })
            setNewUserGroupId('')
            fetchUsers()
        } catch (err) { toast.error(err.response?.data?.message || t('errors.failedToCreateUser')) }
        finally { setCreating(false) }
    }

    const openEdit = u => {
        setEditTarget(u)
        setEditForm({ fullName: u.fullName, email: u.email, password: '', role: u.role })
    }

    const handleEdit = async e => {
        e.preventDefault(); setSaving(true)
        const payload = { fullName: editForm.fullName, email: editForm.email, role: editForm.role }
        if (editForm.password.trim()) payload.password = editForm.password
        try {
            await api.patch(`/users/${editTarget.id}`, payload)
            toast.success(t('admin.userUpdated'))
            setEditTarget(null)
            fetchUsers()
        } catch (err) { toast.error(err.response?.data?.message || t('errors.failedToUpdateUser')) }
        finally { setSaving(false) }
    }

    const handleSuspend    = async id => { try { await api.patch(`/users/${id}/suspend`);  toast.success(t('admin.userSuspended')); fetchUsers() } catch (err) { toast.error(err.response?.data?.message || t('errors.actionFailed')) } }
    const handleActivate   = async id => { try { await api.patch(`/users/${id}/activate`); toast.success(t('admin.userActivated')); fetchUsers() } catch (err) { toast.error(err.response?.data?.message || t('errors.actionFailed')) } }
    const handleDelete     = async id => { if (!confirm(t('admin.confirmDeleteUser'))) return; try { await api.delete(`/users/${id}`); toast.success(t('admin.userDeleted')); fetchUsers() } catch (err) { toast.error(err.response?.data?.message || t('errors.actionFailed')) } }
    const handleInvalidate = async id => { try { await api.delete(`/admin/sessions/${id}`); toast.success(t('admin.sessionsInvalidated')) } catch { toast.error(t('errors.actionFailed')) } }

    const canManage = u => {
        if (!currentUser) return false
        if (currentUser.role === 'SUPER_ADMIN') return true
        return u.role !== 'SUPER_ADMIN'
    }

    const editableRoles = currentUser?.role === 'SUPER_ADMIN'
        ? ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE', 'GUEST']
        : ['ADMIN', 'MANAGER', 'EMPLOYEE', 'GUEST']

    const filtered = users
        .filter(u => filterRole === 'ALL' || u.role === filterRole)
        .filter(u => u.fullName?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()))

    const inputClass = `w-full rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all
        bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]`

    if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin w-8 h-8 text-blue-500" /></div>

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
                {['ADMIN', 'MANAGER', 'EMPLOYEE', 'GUEST'].map((role, i) => (
                    <div key={role} className="rounded-xl p-4 border transition-all"
                         style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}
                         data-stat={i}>
                        <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{users.filter(u => u.role === role).length}</p>
                        <p className={`text-xs font-medium mt-1 ${ROLE_COLOR[role].split(' ')[0]}`}>{role}</p>
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <input type="text" placeholder={t('admin.searchUsers')} value={search}
                           onChange={e => setSearch(e.target.value)}
                           className={`${inputClass} pl-9`} />
                </div>
                <div className="flex gap-1">
                    {['ALL', 'ADMIN', 'MANAGER', 'EMPLOYEE', 'GUEST'].map(r => (
                        <button key={r} onClick={() => setFilterRole(r)}
                                className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                                    filterRole === r ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                                }`}
                                style={{ background: filterRole === r ? undefined : 'var(--bg-card)' }}>
                            {r}
                        </button>
                    ))}
                </div>
                <button onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-600/20 ml-auto">
                    <Plus className="w-4 h-4" /> {t('admin.newUser')}
                </button>
            </div>

            <div className="rounded-2xl overflow-hidden border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                <div className="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-medium uppercase tracking-wider"
                     style={{ borderBottom: '1px solid var(--border-primary)', color: 'var(--text-muted)' }}>
                    <div className="col-span-4">{t('admin.tableHeaders.user')}</div>
                    <div className="col-span-2">{t('admin.tableHeaders.role')}</div>
                    <div className="col-span-2">{t('admin.tableHeaders.status')}</div>
                    <div className="col-span-2">{t('admin.tableHeaders.language')}</div>
                    <div className="col-span-2 text-right">{t('admin.tableHeaders.actions')}</div>
                </div>
                {filtered.length === 0 ? (
                    <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">{t('admin.noUsersFound')}</p>
                    </div>
                ) : filtered.map(u => (
                    <div key={u.id} className="user-row grid grid-cols-12 gap-4 px-5 py-4 items-center transition-all hover:bg-slate-700/10 cursor-default"
                         style={{ borderBottom: '1px solid var(--border-primary)' }}>
                        <div className="col-span-4 flex items-center gap-3 cursor-pointer group/profile" onClick={() => setProfileUser(u)}>
                            {u.profilePhotoUrl ? (
                                <img src={getAvatarUrl(u)} alt={u.fullName}
                                     className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                            ) : (
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                    {u.fullName?.charAt(0)?.toUpperCase()}
                                </div>
                            )}
                            <div className="min-w-0">
                                <p className="text-sm font-medium truncate group-hover/profile:text-blue-400 transition-colors" style={{ color: 'var(--text-primary)' }}>{u.fullName}</p>
                                <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{u.email}</p>
                            </div>
                        </div>
                        <div className="col-span-2">
                            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${ROLE_COLOR[u.role] || ROLE_COLOR.GUEST}`}>{u.role}</span>
                        </div>
                        <div className="col-span-2">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLOR[u.status] || STATUS_COLOR.INACTIVE}`}>{u.status}</span>
                        </div>
                        <div className="col-span-2">
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{u.preferredLanguage || 'EN'}</span>
                        </div>
                        <div className="col-span-2 flex items-center justify-end gap-1">
                            {canManage(u) && <>
                                <button onClick={() => openEdit(u)} title={t('admin.editUser')}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 transition-all">
                                    <Pencil className="w-4 h-4" />
                                </button>
                                {u.status === 'ACTIVE'
                                    ? <button onClick={() => handleSuspend(u.id)} title={t('admin.suspendUser')} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 transition-all"><Ban className="w-4 h-4" /></button>
                                    : <button onClick={() => handleActivate(u.id)} title={t('admin.activateUser')} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10 transition-all"><Check className="w-4 h-4" /></button>
                                }
                                <button onClick={() => handleInvalidate(u.id)} title={t('admin.invalidateSessions')} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 transition-all"><Key className="w-4 h-4" /></button>
                                <button onClick={() => handleDelete(u.id)} title={t('admin.deleteUser')} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all"><Trash2 className="w-4 h-4" /></button>
                            </>}
                        </div>
                    </div>
                ))}
            </div>

            {profileUser && (
                <UserProfileModal
                    user={profileUser}
                    onClose={() => setProfileUser(null)}
                    onMessage={u => { setProfileUser(null); navigate('/chat', { state: { openDmUserId: u.id } }) }}
                    onVoiceCall={async u => {
                        setProfileUser(null)
                        try {
                            const res = await api.post(`/chat/conversations/direct/${u.id}`)
                            const conv = res.data.data
                            if (conv) joinVoiceChannel('CONVERSATION', null, conv.id, `Call with ${u.fullName}`, 'audio')
                        } catch { toast.error('Could not start call') }
                    }}
                    onVideoCall={async u => {
                        setProfileUser(null)
                        try {
                            const res = await api.post(`/chat/conversations/direct/${u.id}`)
                            const conv = res.data.data
                            if (conv) joinVoiceChannel('CONVERSATION', null, conv.id, `Call with ${u.fullName}`, 'video')
                        } catch { toast.error('Could not start video call') }
                    }}
                />
            )}

            {editTarget && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="rounded-2xl w-full max-w-sm shadow-2xl border"
                         style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                        <div className="flex items-center justify-between p-6"
                             style={{ borderBottom: '1px solid var(--border-primary)' }}>
                            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{t('admin.editUser')}</h2>
                            <button onClick={() => setEditTarget(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleEdit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('profile.fullName')}</label>
                                <input type="text" value={editForm.fullName}
                                       onChange={e => setEditForm({ ...editForm, fullName: e.target.value })}
                                       className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('profile.email')}</label>
                                <input type="email" value={editForm.email}
                                       onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                       className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                    {t('admin.newPassword')} <span className="text-slate-500 font-normal">({t('admin.leaveEmptyToKeep')})</span>
                                </label>
                                <input type="password" value={editForm.password}
                                       placeholder={t('admin.minCharacters')}
                                       onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                                       className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('admin.role')}</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {editableRoles.map(role => (
                                        <button key={role} type="button" onClick={() => setEditForm({ ...editForm, role })}
                                                className={`py-2 rounded-xl text-xs font-medium border transition-all ${
                                                    editForm.role === role
                                                        ? (ROLE_COLOR[role] || ROLE_COLOR.GUEST) + ' border-current'
                                                        : 'bg-slate-700/50 text-slate-400 border-transparent hover:text-white'
                                                }`}>{role}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setEditTarget(null)}
                                        className="flex-1 py-2.5 rounded-xl border text-sm transition-all"
                                        style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
                                    {t('common.cancel')}
                                </button>
                                <button type="submit" disabled={saving}
                                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-medium text-sm flex items-center justify-center gap-2">
                                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" />{t('admin.saving')}</> : t('admin.saveChanges')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="rounded-2xl w-full max-w-md shadow-2xl border"
                         style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                        <div className="flex items-center justify-between p-6"
                             style={{ borderBottom: '1px solid var(--border-primary)' }}>
                            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{t('admin.createUser')}</h2>
                            <button onClick={() => { setShowModal(false); setNewUserGroupId('') }} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            {[
                                { f: 'fullName', l: t('admin.fullNameRequired'),  ty: 'text',     p: t('admin.fullNamePlaceholder')  },
                                { f: 'email',    l: t('admin.emailRequired'),      ty: 'email',    p: t('admin.emailPlaceholder')     },
                                { f: 'password', l: t('admin.passwordRequired'),   ty: 'password', p: t('admin.minCharacters')        },
                            ].map(({ f, l, ty, p }) => (
                                <div key={f}>
                                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{l}</label>
                                    <input type={ty} required value={form[f]}
                                           onChange={e => setForm({ ...form, [f]: e.target.value })} placeholder={p}
                                           className={inputClass} />
                                </div>
                            ))}
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('admin.roleRequired')}</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {['ADMIN', 'MANAGER', 'EMPLOYEE', 'GUEST'].map(role => (
                                        <button key={role} type="button" onClick={() => setForm({ ...form, role })}
                                                className={`py-2 rounded-xl text-xs font-medium border transition-all ${
                                                    form.role === role ? ROLE_COLOR[role] + ' border-current' : 'bg-slate-700/50 text-slate-400 border-transparent hover:text-white'
                                                }`}>{role}</button>
                                    ))}
                                </div>
                            </div>
                            {allGroups.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                        Add to Group <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
                                    </label>
                                    <select value={newUserGroupId} onChange={e => setNewUserGroupId(e.target.value)}
                                            className={inputClass}>
                                        <option value="">— No group —</option>
                                        {allGroups.map(g => (
                                            <option key={g.id} value={g.id}>{g.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>📧 {t('admin.welcomeEmailNote')}</p>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => { setShowModal(false); setNewUserGroupId('') }}
                                        className="flex-1 py-2.5 rounded-xl border text-sm transition-all"
                                        style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
                                    {t('common.cancel')}
                                </button>
                                <button type="submit" disabled={creating}
                                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium text-sm transition-all flex items-center justify-center gap-2">
                                    {creating ? <><Loader2 className="w-4 h-4 animate-spin" />{t('admin.creating')}</> : t('admin.createUser')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Guest Codes Tab ───────────────────────────────────────────────────────────

const RESOURCE_TYPES = [
    { key: 'projects',   label: 'Projects',   hasIds: true },
    { key: 'documents',  label: 'Documents',  hasIds: false },
    { key: 'folders',    label: 'Folders',    hasIds: false },
    { key: 'groups',     label: 'Groups',     hasIds: true },
    { key: 'chat',       label: 'Chat',       hasIds: false },
    { key: 'templates',  label: 'Templates',  hasIds: false },
]

const defaultPermissions = () => ({
    projects:  { level: 'none', ids: [] },
    documents: { level: 'none' },
    folders:   { level: 'none' },
    groups:    { level: 'none', ids: [] },
    chat:      { level: 'none' },
    templates: { level: 'none' },
})

function buildPermissionsPayload(permissions) {
    const result = {}
    for (const { key } of RESOURCE_TYPES) {
        const p = permissions[key]
        if (!p || p.level === 'none') { result[key] = null; continue }
        result[key] = {
            ids: p.ids && p.ids.length > 0 ? p.ids : null,
            canSee: true,
            canExecute: p.level === 'execute',
        }
    }
    return result
}

function GuestCodesTab() {
    const { t } = useTranslation()
    const [codes, setCodes]         = useState([])
    const [loading, setLoading]     = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [creating, setCreating]   = useState(false)
    const [projects, setProjects]   = useState([])
    const [groups, setGroups]       = useState([])
    const [copied, setCopied]       = useState(null)
    const [form, setForm] = useState({
        validityType: 'TIME_BASED', duration: 7, projectId: '', guestFullName: '', guestEmail: '',
        permissions: defaultPermissions(),
    })

    const fetchCodes = async () => {
        try { const res = await api.get('/admin/guest-codes'); setCodes(res.data.data || []) }
        catch { toast.error('Failed to load guest codes') }
        finally { setLoading(false) }
    }
    useEffect(() => {
        fetchCodes()
        api.get('/projects').then(r => setProjects(r.data.data || [])).catch(() => {})
        api.get('/groups').then(r => setGroups(r.data.data || [])).catch(() => {})
    }, [])

    useEffect(() => {
        if (!loading && codes.length > 0) {
            gsap.fromTo('.guest-code-item',
                { opacity: 0, y: 15 },
                { opacity: 1, y: 0, stagger: 0.06, duration: 0.4, ease: 'power2.out' }
            )
        }
    }, [loading])

    const handleCreate = async e => {
        e.preventDefault(); setCreating(true)
        try {
            await api.post('/admin/guest-codes', {
                validityType: form.validityType,
                duration: form.validityType === 'TIME_BASED' ? parseInt(form.duration) : null,
                projectId: form.projectId ? parseInt(form.projectId) : null,
                guestFullName: form.guestFullName,
                guestEmail: form.guestEmail || null,
                permissions: buildPermissionsPayload(form.permissions),
            })
            toast.success('Guest code generated!'); setShowModal(false)
            setForm({ validityType: 'TIME_BASED', duration: 7, projectId: '', guestFullName: '', guestEmail: '', permissions: defaultPermissions() })
            fetchCodes()
        } catch (err) { toast.error(err.response?.data?.message || 'Failed') }
        finally { setCreating(false) }
    }
    const handleDeactivate = async id => {
        try { await api.delete(`/admin/guest-codes/${id}`); toast.success('Code deactivated'); fetchCodes() } catch { toast.error('Failed') }
    }
    const handleCopy = code => {
        navigator.clipboard.writeText(code); setCopied(code); toast.success('Copied!')
        setTimeout(() => setCopied(null), 2000)
    }

    const inputClass = `w-full rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
        bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]`

    if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin w-8 h-8 text-blue-500" /></div>

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{codes.length} active codes</p>
                <button onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-600/20">
                    <Plus className="w-4 h-4" /> {t('admin.generateCode')}
                </button>
            </div>
            {codes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20" style={{ color: 'var(--text-muted)' }}>
                    <Key className="w-12 h-12 mb-4 opacity-20" />
                    <p className="font-medium">{t('admin.noActiveCodes')}</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {codes.map(code => (
                        <div key={code.id} className="guest-code-item rounded-xl p-4 flex items-center gap-4 border transition-all"
                             style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                            <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center flex-shrink-0"><Key className="w-5 h-5 text-blue-400" /></div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-1">
                                    <code className="text-sm font-mono font-bold tracking-widest" style={{ color: 'var(--text-primary)' }}>{code.code}</code>
                                    <button onClick={() => handleCopy(code.code)} className="p-1 rounded transition-colors text-slate-400 hover:text-blue-400">
                                        {copied === code.code ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                    </button>
                                </div>
                                {code.guestUser && (
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
                                            <span className="text-slate-300 text-xs font-bold">{code.guestUser?.fullName?.charAt(0)}</span>
                                        </div>
                                        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{code.guestUser?.fullName}</span>
                                        {code.guestUser?.email && !code.guestUser.email.includes('@incolab.guest') && (
                                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· {code.guestUser.email}</span>
                                        )}
                                    </div>
                                )}
                                <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                                    <span className="bg-slate-700/50 px-2 py-0.5 rounded">{code.validityType?.replace('_', ' ')}</span>
                                    {code.expiresAt && <span>Expires {new Date(code.expiresAt).toLocaleDateString()}</span>}
                                    {code.projectId && <span>Project #{code.projectId}</span>}
                                    <span className={code.isUsed ? 'text-slate-600' : 'text-emerald-500'}>{code.isUsed ? 'Used' : 'Available'}</span>
                                </div>
                                {code.permissionsJson && (() => {
                                    try {
                                        const perms = JSON.parse(code.permissionsJson)
                                        const active = RESOURCE_TYPES.filter(({ key }) => perms[key] != null)
                                        if (active.length === 0) return null
                                        return (
                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                {active.map(({ key, label }) => (
                                                    <span key={key} className={`px-2 py-0.5 rounded text-xs border ${
                                                        perms[key].canExecute
                                                            ? 'bg-blue-600/15 border-blue-500/30 text-blue-400'
                                                            : 'bg-emerald-600/10 border-emerald-500/20 text-emerald-500'
                                                    }`}>
                                                        {label} · {perms[key].canExecute ? 'Execute' : 'See'}
                                                    </span>
                                                ))}
                                            </div>
                                        )
                                    } catch { return null }
                                })()}
                            </div>
                            <button onClick={() => handleDeactivate(code.id)} className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="rounded-2xl w-full max-w-lg shadow-2xl border flex flex-col max-h-[90vh]"
                         style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                        <div className="flex items-center justify-between p-6 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{t('admin.generateGuestCode')}</h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('admin.guestFullName')}</label>
                                <input type="text" required value={form.guestFullName}
                                       onChange={e => setForm({ ...form, guestFullName: e.target.value })}
                                       placeholder="e.g. John Smith" className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                    {t('admin.guestEmail')} <span className="text-slate-500 font-normal">(optional)</span>
                                </label>
                                <input type="email" value={form.guestEmail}
                                       onChange={e => setForm({ ...form, guestEmail: e.target.value })}
                                       placeholder="guest@company.com" className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Validity Type *</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[{ v: 'TIME_BASED', l: 'Time-based' }, { v: 'PROJECT_BASED', l: 'Project-based' }, { v: 'GROUP_BASED', l: 'Group-based' }].map(({ v, l }) => (
                                        <button key={v} type="button" onClick={() => setForm({ ...form, validityType: v })}
                                                className={`py-2.5 rounded-xl text-xs font-medium border transition-all ${
                                                    form.validityType === v ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' : 'bg-slate-700/30 border-slate-600/50 text-slate-400 hover:text-white'
                                                }`}>{l}</button>
                                    ))}
                                </div>
                            </div>
                            {form.validityType === 'TIME_BASED' && (
                                <div>
                                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Duration</label>
                                    <div className="grid grid-cols-6 gap-2">
                                        {[1, 2, 3, 7, 14, 30].map(d => (
                                            <button key={d} type="button" onClick={() => setForm({ ...form, duration: d })}
                                                    className={`py-2 rounded-xl text-xs font-medium transition-all ${form.duration === d ? 'bg-blue-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:text-white'}`}>
                                                {d}d
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {form.validityType !== 'GROUP_BASED' && (
                                <div>
                                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                        Project {form.validityType === 'PROJECT_BASED' ? '*' : '(optional)'}
                                    </label>
                                    <SearchableSelect
                                        options={projects.map(p => ({ value: p.id, label: p.name }))}
                                        value={form.projectId}
                                        onChange={v => setForm({ ...form, projectId: v || '' })}
                                        placeholder="No specific project"
                                        nullLabel="No specific project"
                                    />
                                </div>
                            )}

                            {/* ── Access Permissions ── */}
                            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-primary)' }}>
                                <div className="px-4 py-3" style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-primary)' }}>
                                    <p className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                        <Shield className="w-4 h-4 text-blue-400" /> Access Permissions
                                    </p>
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Define what this guest can see or interact with</p>
                                </div>
                                <div className="divide-y" style={{ divideColor: 'var(--border-primary)' }}>
                                    {RESOURCE_TYPES.map(({ key, label, hasIds }) => {
                                        const perm = form.permissions[key]
                                        const setLevel = level => setForm(f => ({ ...f, permissions: { ...f.permissions, [key]: { ...f.permissions[key], level } } }))
                                        const toggleId = (id) => setForm(f => {
                                            const cur = f.permissions[key].ids || []
                                            const ids = cur.includes(id) ? cur.filter(i => i !== id) : [...cur, id]
                                            return { ...f, permissions: { ...f.permissions, [key]: { ...f.permissions[key], ids } } }
                                        })
                                        const idOptions = key === 'projects' ? projects : groups
                                        return (
                                            <div key={key} className="px-4 py-3 space-y-2" style={{ background: 'var(--bg-card)' }}>
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                                                    <div className="flex gap-1">
                                                        {[
                                                            { v: 'none',    l: 'None' },
                                                            { v: 'see',     l: 'See' },
                                                            { v: 'execute', l: 'Execute' },
                                                        ].map(({ v, l }) => (
                                                            <button key={v} type="button" onClick={() => setLevel(v)}
                                                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                                                                        perm.level === v
                                                                            ? v === 'none'    ? 'bg-slate-600/40 border-slate-500/50 text-slate-300'
                                                                            : v === 'see'     ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400'
                                                                                               : 'bg-blue-600/20 border-blue-500/40 text-blue-400'
                                                                            : 'bg-transparent border-slate-700/50 text-slate-500 hover:text-slate-300'
                                                                    }`}>
                                                                {l}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                {hasIds && perm.level !== 'none' && idOptions.length > 0 && (
                                                    <div>
                                                        <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
                                                            Specific {label.toLowerCase()} <span className="text-slate-500">(leave empty = all)</span>
                                                        </p>
                                                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                                                            {idOptions.map(item => {
                                                                const selected = (perm.ids || []).includes(item.id)
                                                                return (
                                                                    <button key={item.id} type="button" onClick={() => toggleId(item.id)}
                                                                            className={`px-2.5 py-1 rounded-lg text-xs transition-all border ${
                                                                                selected
                                                                                    ? 'bg-blue-600/25 border-blue-500/50 text-blue-300'
                                                                                    : 'bg-slate-700/30 border-slate-600/40 text-slate-400 hover:text-slate-200'
                                                                            }`}>
                                                                        {item.name}
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)}
                                        className="flex-1 py-2.5 rounded-xl border text-sm transition-all"
                                        style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={creating || !form.guestFullName.trim()}
                                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium text-sm transition-all flex items-center justify-center gap-2">
                                    {creating ? <><Loader2 className="w-4 h-4 animate-spin" />Generating...</> : <><Key className="w-4 h-4" />Generate</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Audit Logs Tab ────────────────────────────────────────────────────────────

function AuditLogsTab() {
    const { t }         = useTranslation()
    const [logs, setLogs]       = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch]   = useState('')

    useEffect(() => {
        api.get('/admin/audit-logs').then(r => setLogs(r.data.data || []))
            .catch(() => toast.error('Failed to load audit logs'))
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => {
        if (!loading && logs.length > 0) {
            gsap.fromTo('.log-row', { opacity: 0, x: -12 }, { opacity: 1, x: 0, stagger: 0.02, duration: 0.35, ease: 'power2.out' })
        }
    }, [loading])

    const filtered = logs.filter(l =>
        l.action?.toLowerCase().includes(search.toLowerCase()) ||
        l.entityType?.toLowerCase().includes(search.toLowerCase()) ||
        l.userFullName?.toLowerCase().includes(search.toLowerCase())
    )

    const actionColor = action => {
        if (!action) return 'text-slate-400'
        const a = action.toUpperCase()
        if (a.includes('DELETE') || a.includes('SUSPEND')) return 'text-red-400'
        if (a.includes('CREATE') || a.includes('ADD') || a.includes('REGISTER')) return 'text-emerald-400'
        if (a.includes('UPDATE') || a.includes('CHANGE')) return 'text-amber-400'
        if (a.includes('LOGIN') || a.includes('LOGOUT')) return 'text-blue-400'
        return 'text-slate-300'
    }

    const inputClass = `w-full rounded-xl py-2.5 px-4 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
        bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]`

    if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin w-8 h-8 text-blue-500" /></div>

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <input type="text" placeholder={t('admin.searchLogs')} value={search}
                           onChange={e => setSearch(e.target.value)} className={inputClass} />
                </div>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{filtered.length} entries</span>
            </div>
            {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20" style={{ color: 'var(--text-muted)' }}>
                    <ClipboardList className="w-12 h-12 mb-4 opacity-20" />
                    <p>{t('admin.noLogsFound')}</p>
                </div>
            ) : (
                <div className="rounded-2xl overflow-hidden border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                    <div className="grid grid-cols-12 gap-3 px-5 py-3 text-xs font-medium uppercase tracking-wider"
                         style={{ borderBottom: '1px solid var(--border-primary)', color: 'var(--text-muted)' }}>
                        <div className="col-span-2">Time</div>
                        <div className="col-span-3">User</div>
                        <div className="col-span-3">Action</div>
                        <div className="col-span-2">Entity</div>
                        <div className="col-span-2">IP</div>
                    </div>
                    <div className="max-h-[500px] overflow-y-auto">
                        {filtered.map(log => (
                            <div key={log.id} className="log-row grid grid-cols-12 gap-3 px-5 py-3 items-center transition-all hover:bg-slate-700/10"
                                 style={{ borderBottom: '1px solid var(--border-primary)' }}>
                                <div className="col-span-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                                    {log.createdAt ? new Date(log.createdAt).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                </div>
                                <div className="col-span-3 flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                                        <span className="text-blue-400 text-xs font-bold">{log.userFullName?.charAt(0) || '?'}</span>
                                    </div>
                                    <span className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>{log.userFullName || 'System'}</span>
                                </div>
                                <div className="col-span-3"><span className={`text-xs font-mono font-medium ${actionColor(log.action)}`}>{log.action}</span></div>
                                <div className="col-span-2 text-xs truncate" style={{ color: 'var(--text-secondary)' }} title={log.entityName || (log.entityType && log.entityId ? `${log.entityType} #${log.entityId}` : undefined)}>
                                    {log.entityName || (log.entityType ? log.entityType : '—')}
                                </div>
                                <div className="col-span-2 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{log.ipAddress || '—'}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Locked Accounts Tab ─────────────────────────────────────────────────────

function LockedAccountsTab() {
    const [accounts, setAccounts] = useState([])
    const [loading,  setLoading]  = useState(true)
    const [unlocking, setUnlocking] = useState(null)
    const [countdown, setCountdown] = useState({})

    const fetchLocked = async () => {
        setLoading(true)
        try {
            const res = await api.get('/admin/locked-accounts')
            const list = res.data.data || []
            setAccounts(list)
            const initial = {}
            list.forEach(a => { initial[a.email] = a.secondsUntilUnlock })
            setCountdown(initial)
        } catch {}
        finally { setLoading(false) }
    }

    useEffect(() => {
        fetchLocked()
        const poll = setInterval(fetchLocked, 30000)
        return () => clearInterval(poll)
    }, [])

    useEffect(() => {
        const tick = setInterval(() => {
            setCountdown(prev => {
                const next = { ...prev }
                let changed = false
                Object.keys(next).forEach(email => {
                    if (next[email] > 0) { next[email]--; changed = true }
                })
                return changed ? next : prev
            })
        }, 1000)
        return () => clearInterval(tick)
    }, [])

    const handleUnlock = async (email) => {
        setUnlocking(email)
        try {
            await api.post(`/admin/locked-accounts/${encodeURIComponent(email)}/unlock`)
            toast.success(`Account unlocked: ${email}`)
            fetchLocked()
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to unlock')
        } finally { setUnlocking(null) }
    }

    const formatTime = (s) => {
        const m = Math.floor(s / 60)
        const sec = s % 60
        return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-red-400" />
                        Locked Accounts
                        {accounts.length > 0 && (
                            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">{accounts.length}</span>
                        )}
                    </h2>
                    <p className="text-sm text-slate-400 mt-0.5">Accounts locked after too many failed login attempts</p>
                </div>
                <button onClick={fetchLocked} disabled={loading}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-white border border-slate-600 hover:border-slate-500 rounded-lg transition-all">
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="animate-spin w-6 h-6 text-blue-400" />
                </div>
            ) : accounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <ShieldAlert className="w-7 h-7 text-emerald-400" />
                    </div>
                    <p className="text-slate-400 font-medium">No locked accounts</p>
                    <p className="text-slate-500 text-sm">All accounts are currently accessible</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {accounts.map(account => (
                        <div key={account.email}
                             className="flex items-center gap-4 p-4 bg-red-500/5 border border-red-500/20 rounded-xl hover:border-red-500/30 transition-all">
                            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                                <ShieldAlert className="w-5 h-5 text-red-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white truncate">{account.email}</p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {account.failedAttempts} failed attempt{account.failedAttempts !== 1 ? 's' : ''}
                                </p>
                            </div>
                            <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-lg flex-shrink-0">
                                <Clock className="w-3.5 h-3.5 text-red-400" />
                                <span className="font-mono text-sm text-red-300 font-bold">
                                    {formatTime(countdown[account.email] ?? account.secondsUntilUnlock)}
                                </span>
                            </div>
                            <button onClick={() => handleUnlock(account.email)}
                                    disabled={unlocking === account.email}
                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 hover:border-emerald-500/50 text-emerald-400 text-sm font-medium rounded-lg transition-all flex-shrink-0 disabled:opacity-50">
                                {unlocking === account.email
                                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Unlocking...</>
                                    : <><Unlock className="w-3.5 h-3.5" />Unlock</>
                                }
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl">
                <p className="text-xs text-slate-400 leading-relaxed">
                    <strong className="text-slate-300">How it works:</strong> Accounts are automatically locked after{' '}
                    <strong className="text-amber-400">5 failed login attempts</strong> for{' '}
                    <strong className="text-amber-400">15 minutes</strong>. You can unlock any account manually using the button above.
                    The lock resets automatically after the timeout expires.
                </p>
            </div>
        </div>
    )
}

// ── Timezones Tab ─────────────────────────────────────────────────────────────

function TimezonesTab() {
    const [selected, setSelected] = useState([])
    const [saved, setSaved]       = useState(false)
    const [saving, setSaving]     = useState(false)
    const [tick, setTick]         = useState(0)

    useEffect(() => {
        api.get('/company/settings/timezones')
            .then(r => {
                const zones = r.data.data || []
                setSelected(zones.length > 0 ? zones : ['UTC'])
            })
            .catch(() => setSelected(['UTC']))
    }, [])

    // Live clock tick for preview
    useEffect(() => {
        const id = setInterval(() => setTick(t => t + 1), 1000)
        return () => clearInterval(id)
    }, [])

    const toggle = (tz) => {
        if (selected.includes(tz)) {
            if (selected.length <= 1) return
            setSelected(prev => prev.filter(t => t !== tz))
        } else {
            if (selected.length >= 5) { toast.error('Maximum 5 timezones'); return }
            setSelected(prev => [...prev, tz])
        }
        setSaved(false)
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            await api.put('/company/settings/timezones', selected)
            setSaved(true)
            window.dispatchEvent(new CustomEvent('company-tz-updated'))
            toast.success('Timezone settings saved — visible to all users!')
            setTimeout(() => setSaved(false), 2500)
        } catch {
            toast.error('Failed to save timezone settings')
        } finally {
            setSaving(false)
        }
    }

    const getTime = (tz) => {
        try {
            return new Date().toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
        } catch { return '--:--' }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Globe className="w-5 h-5 text-blue-400" />
                        World Clock Widget
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">
                        Select up to 5 timezones to show in the sidebar for all users.
                        <span className="ml-1 text-blue-400 font-medium">{selected.length}/5 selected</span>
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 ${
                        saved
                            ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                    }`}
                >
                    {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Settings'}
                </button>
            </div>

            {/* Live Preview */}
            {selected.length > 0 && (
                <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
                    <p className="text-xs text-blue-400 font-semibold mb-3 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                        Live Preview
                    </p>
                    <div className="space-y-2">
                        {selected.map(tz => {
                            const found = COMMON_TIMEZONES.find(t => t.value === tz)
                            return (
                                <div key={tz} className="flex items-center justify-between">
                                    <span className="text-sm text-white">{found?.label || tz}</span>
                                    <span className="font-mono text-blue-400 font-bold text-base">{getTime(tz)}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Timezone grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {COMMON_TIMEZONES.map(tz => {
                    const isSelected = selected.includes(tz.value)
                    const disabled   = !isSelected && selected.length >= 5
                    return (
                        <button
                            key={tz.value}
                            onClick={() => toggle(tz.value)}
                            disabled={disabled}
                            className={`flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all ${
                                isSelected
                                    ? 'bg-blue-600/20 border-blue-500/50 text-white'
                                    : disabled
                                        ? 'border-slate-700/50 text-slate-600 cursor-not-allowed opacity-40'
                                        : 'border-slate-700/50 text-slate-300 hover:border-blue-500/30 hover:bg-slate-700/30'
                            }`}
                        >
                            <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{tz.label}</p>
                                <p className="text-xs text-slate-500 truncate">{tz.value}</p>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                                <span className={`font-mono text-sm font-bold ${isSelected ? 'text-blue-400' : 'text-slate-500'}`}>
                                    {getTime(tz.value).slice(0, 5)}
                                </span>
                                {isSelected && (
                                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                                        <Check className="w-3 h-3 text-white" />
                                    </div>
                                )}
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

// ── Analytics Tab ─────────────────────────────────────────────────────────────

function AnalyticsTab() {
    const { t }                     = useTranslation()
    const [data, setData]           = useState(null)
    const [loading, setLoading]     = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [lastRefresh, setLastRefresh] = useState(null)

    const load = async (silent = false) => {
        if (silent) setRefreshing(true); else setLoading(true)
        try {
            const [usersRes, projectsRes, tasksRes, logsRes, lockedRes] = await Promise.all([
                api.get('/users').catch(() => ({ data: { data: [] } })),
                api.get('/projects').catch(() => ({ data: { data: [] } })),
                api.get('/tasks/hub').catch(() => ({ data: { data: [] } })),
                api.get('/admin/audit-logs').catch(() => ({ data: { data: [] } })),
                api.get('/admin/locked-accounts').catch(() => ({ data: { data: [] } })),
            ])
            setData({
                users:    usersRes.data.data    || [],
                projects: projectsRes.data.data || [],
                tasks:    tasksRes.data.data    || [],
                logs:     logsRes.data.data     || [],
                locked:   lockedRes.data.data   || [],
            })
            setLastRefresh(new Date())
        } catch { if (!silent) toast.error('Failed to load analytics') }
        finally { setLoading(false); setRefreshing(false) }
    }

    useEffect(() => { load() }, [])
    useEffect(() => {
        const id = setInterval(() => load(true), 60000)
        return () => clearInterval(id)
    }, [])
    useEffect(() => {
        if (!loading && data) {
            gsap.fromTo('.a-card',
                { opacity: 0, y: 18, scale: 0.96 },
                { opacity: 1, y: 0, scale: 1, duration: 0.4, stagger: 0.055, ease: 'back.out(1.3)', clearProps: 'transform' }
            )
        }
    }, [loading, data])

    if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin w-8 h-8 text-blue-500" /></div>
    if (!data)   return null

    const { users, projects, tasks, logs, locked } = data

    // ── Core metrics ───────────────────────────────────────────────────────────
    const today = new Date(); today.setHours(0, 0, 0, 0)

    const activeUsers     = users.filter(u => u.status === 'ACTIVE').length
    const suspendedUsers  = users.filter(u => u.status === 'SUSPENDED')
    const activeProjects  = projects.filter(p => p.status === 'ACTIVE')
    const completedProj   = projects.filter(p => p.status === 'COMPLETED').length
    const doneTasks       = tasks.filter(t => t.status === 'DONE').length
    const completionRate  = tasks.length ? Math.round((doneTasks / tasks.length) * 100) : 0
    const overdueTasks    = tasks
        .filter(t => t.dueDate && new Date(t.dueDate) < today && t.status !== 'DONE' && t.status !== 'UPCOMING')
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS').length
    const inReviewTasks   = tasks.filter(t => t.status === 'IN_REVIEW').length
    const daysOverdue     = d => Math.floor((today - new Date(d)) / 86400000)

    // ── Task breakdowns ────────────────────────────────────────────────────────
    const taskStatuses = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'UPCOMING']
    const taskCounts   = taskStatuses.map(s => ({ s, count: tasks.filter(t => t.status === s).length }))
    const maxTask      = Math.max(...taskCounts.map(x => x.count), 1)

    const priorities   = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
    const priCounts    = priorities.map(p => ({
        p, count: tasks.filter(t => t.priority === p).length,
        done:  tasks.filter(t => t.priority === p && t.status === 'DONE').length,
    }))
    const maxPri = Math.max(...priCounts.map(x => x.count), 1)

    // ── User breakdowns ────────────────────────────────────────────────────────
    const roleGroups = ['ADMIN', 'MANAGER', 'EMPLOYEE', 'GUEST']
    const roleCounts = roleGroups.map(r => ({ r, count: users.filter(u => u.role === r).length }))
    const maxRole    = Math.max(...roleCounts.map(x => x.count), 1)

    // ── 30-day activity ────────────────────────────────────────────────────────
    const last30 = Array.from({ length: 30 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (29 - i))
        return {
            shortLabel: i === 0 || i === 29 || i % 9 === 0
                ? d.toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '',
            count: logs.filter(l => l.createdAt && new Date(l.createdAt).toDateString() === d.toDateString()).length,
            isToday: i === 29,
        }
    })
    const maxAct = Math.max(...last30.map(d => d.count), 1)
    const last30Total = last30.reduce((s, d) => s + d.count, 0)

    // ── Top performers (completed tasks) ──────────────────────────────────────
    const perfMap = {}
    tasks.filter(t => t.status === 'DONE').forEach(t => {
        const name = t.assignee?.fullName; if (!name) return
        perfMap[name] = (perfMap[name] || 0) + 1
    })
    const topPerformers = Object.entries(perfMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([name, count]) => ({ name, count }))
    const maxPerf = topPerformers[0]?.count || 1

    // ── Most active users (audit log frequency) ───────────────────────────────
    const actMap = {}
    logs.forEach(l => { const n = l.userFullName; if (n) actMap[n] = (actMap[n] || 0) + 1 })
    const mostActive = Object.entries(actMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([name, count]) => ({ name, count }))
    const maxAct2 = mostActive[0]?.count || 1

    // ── Security events ────────────────────────────────────────────────────────
    const secEvents = logs.filter(l => {
        const a = (l.action || '').toUpperCase()
        return a.includes('SUSPEND') || a.includes('DELETE') || a.includes('LOCK') || a.includes('FAILED') || a.includes('BLOCK') || a.includes('UNAUTHORIZED')
    }).slice(0, 8)

    // ── Stalled projects (active, nothing in progress) ────────────────────────
    const stalledProjects = activeProjects.filter(p => {
        const pt = tasks.filter(t => t.projectId === p.id || t.project?.id === p.id)
        return pt.length === 0 || pt.every(t => ['TODO', 'DONE', 'UPCOMING'].includes(t.status))
    })

    // ── Alerts bar ────────────────────────────────────────────────────────────
    const alerts = [
        ...(overdueTasks.length  ? [{ type: 'error', msg: `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}` }]  : []),
        ...(locked.length        ? [{ type: 'error', msg: `${locked.length} locked account${locked.length > 1 ? 's' : ''}` }]            : []),
        ...(suspendedUsers.length ? [{ type: 'warn', msg: `${suspendedUsers.length} suspended user${suspendedUsers.length > 1 ? 's' : ''}` }] : []),
        ...(stalledProjects.length ? [{ type: 'warn', msg: `${stalledProjects.length} stalled project${stalledProjects.length > 1 ? 's' : ''}` }] : []),
    ]

    // ── Colors ────────────────────────────────────────────────────────────────
    const taskColor = { TODO: 'bg-slate-500', IN_PROGRESS: 'bg-blue-500', IN_REVIEW: 'bg-amber-500', DONE: 'bg-emerald-500', UPCOMING: 'bg-purple-500' }
    const roleColor = { ADMIN: 'bg-red-500', MANAGER: 'bg-amber-500', EMPLOYEE: 'bg-blue-500', GUEST: 'bg-slate-500' }
    const priColor  = { CRITICAL: 'bg-red-500',    HIGH: 'bg-orange-500',   MEDIUM: 'bg-amber-500',   LOW: 'bg-slate-500'  }
    const priText   = { CRITICAL: 'text-red-400',  HIGH: 'text-orange-400', MEDIUM: 'text-amber-400', LOW: 'text-slate-400' }

    return (
        <div className="space-y-5">

            {/* ── Header ──────────────────────────────────────────────────────── */}
            <div className="a-card flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <BarChart3 className="w-5 h-5 text-blue-400" /> {t('admin.analyticsTitle')}
                    </h2>
                    {lastRefresh && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            &nbsp;·&nbsp;{t('admin.autoRefresh')}
                        </p>
                    )}
                </div>
                <button onClick={() => load(true)} disabled={refreshing}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm transition-all disabled:opacity-50"
                        style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
                    {refreshing ? t('admin.refreshing') : t('admin.refresh')}
                </button>
            </div>

            {/* ── Alert Strip ─────────────────────────────────────────────────── */}
            <div className="a-card flex flex-wrap gap-2">
                {alerts.length === 0 ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                        <Check className="w-3.5 h-3.5" /> {t('admin.allHealthy')}
                    </div>
                ) : alerts.map((al, i) => (
                    <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border ${
                        al.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    }`}>
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {al.msg}
                    </div>
                ))}
            </div>

            {/* ── KPI Grid (8 cards) ───────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { icon: Users,         label: t('admin.kpi.totalUsers'),       value: users.length,          sub: `${activeUsers} ${t('admin.kpi.active')}`,            cls: 'text-blue-400 bg-blue-400/10',     border: '' },
                    { icon: FolderOpen,    label: t('admin.kpi.activeProjects'),   value: activeProjects.length,  sub: `${completedProj} ${t('admin.kpi.completed')}`,        cls: 'text-violet-400 bg-violet-400/10', border: '' },
                    { icon: Target,        label: t('admin.kpi.completionRate'),   value: `${completionRate}%`,   sub: `${doneTasks} / ${tasks.length} ${t('admin.kpi.done')}`, cls: completionRate >= 70 ? 'text-emerald-400 bg-emerald-400/10' : 'text-amber-400 bg-amber-400/10', border: '' },
                    { icon: AlertTriangle, label: t('admin.kpi.overdueTasks'),     value: overdueTasks.length,    sub: overdueTasks.length ? t('admin.needsAttention') : t('admin.allOnTrack'), cls: overdueTasks.length ? 'text-red-400 bg-red-400/10' : 'text-emerald-400 bg-emerald-400/10', border: overdueTasks.length ? 'border-red-500/30' : '' },
                    { icon: Zap,           label: t('admin.kpi.inProgress'),       value: inProgressTasks,        sub: `${inReviewTasks} ${t('admin.kpi.inReview')}`,        cls: 'text-cyan-400 bg-cyan-400/10',     border: '' },
                    { icon: ShieldAlert,   label: t('admin.kpi.lockedAccounts'),   value: locked.length,          sub: locked.length ? t('admin.unlockNeeded') : t('admin.noIssues'), cls: locked.length ? 'text-red-400 bg-red-400/10' : 'text-slate-400 bg-slate-400/10', border: locked.length ? 'border-red-500/30' : '' },
                    { icon: Ban,           label: t('admin.kpi.suspendedUsers'),   value: suspendedUsers.length,  sub: suspendedUsers.length ? t('admin.restricted') : t('admin.noneSuspended'), cls: suspendedUsers.length ? 'text-amber-400 bg-amber-400/10' : 'text-slate-400 bg-slate-400/10', border: '' },
                    { icon: Activity,      label: t('admin.kpi.events30d'),        value: last30Total,            sub: `${logs.length} ${t('admin.totalInLog')}`,      cls: 'text-amber-400 bg-amber-400/10',   border: '' },
                ].map(({ icon: Icon, label, value, sub, cls, border }) => (
                    <div key={label} className={`a-card rounded-2xl p-4 border ${border}`}
                         style={{ background: 'var(--bg-card)', borderColor: border ? undefined : 'var(--border-primary)' }}>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-3 ${cls}`}>
                            <Icon className="w-4 h-4" />
                        </div>
                        <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
                        <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>
                    </div>
                ))}
            </div>

            {/* ── 30-day Activity Chart ────────────────────────────────────────── */}
            <div className="a-card rounded-2xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <TrendingUp className="w-4 h-4 text-blue-400" /> {t('admin.panels.activity30d')}
                    </h3>
                    <div className="flex items-center gap-2">
                        <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 font-semibold">{last30Total} events</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{Math.round(last30Total / 30 * 10) / 10}/day avg</span>
                    </div>
                </div>
                <div className="flex items-end gap-0.5" style={{ height: '100px' }}>
                    {last30.map(({ shortLabel, count, isToday }, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center group relative" style={{ height: '100px' }}>
                            {count > 0 && (
                                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-600 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                                    {count}
                                </div>
                            )}
                            <div className="w-full flex-1 flex items-end">
                                <div className={`w-full rounded-sm transition-all ${isToday ? 'bg-blue-400' : 'bg-blue-600/50 group-hover:bg-blue-500/75'}`}
                                     style={{ height: `${Math.max(maxAct > 0 ? (count / maxAct) * 85 : 0, count > 0 ? 3 : 0)}px` }} />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-between mt-1.5">
                    {last30.filter(d => d.shortLabel).map(({ shortLabel }, i) => (
                        <span key={i} className="text-xs" style={{ color: 'var(--text-muted)', fontSize: '9px' }}>{shortLabel}</span>
                    ))}
                </div>
            </div>

            {/* ── Breakdown Row ───────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Tasks by status */}
                <div className="a-card rounded-2xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <CheckSquare className="w-4 h-4 text-emerald-400" /> {t('admin.panels.tasksByStatus')}
                    </h3>
                    <div className="space-y-3">
                        {taskCounts.map(({ s, count }) => (
                            <div key={s}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{s.replace(/_/g, ' ')}</span>
                                    <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                                        {count}&nbsp;<span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({tasks.length ? Math.round((count / tasks.length) * 100) : 0}%)</span>
                                    </span>
                                </div>
                                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
                                    <div className={`h-full rounded-full ${taskColor[s]}`} style={{ width: `${maxTask ? (count / maxTask) * 100 : 0}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-primary)' }}>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('admin.totalTasks')}</span>
                        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{tasks.length}</span>
                    </div>
                </div>

                {/* Team composition */}
                <div className="a-card rounded-2xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <Users className="w-4 h-4 text-blue-400" /> {t('admin.panels.teamComposition')}
                    </h3>
                    <div className="space-y-3">
                        {roleCounts.map(({ r, count }) => (
                            <div key={r}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{r}</span>
                                    <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{count}</span>
                                </div>
                                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
                                    <div className={`h-full rounded-full ${roleColor[r]}`} style={{ width: `${maxRole ? (count / maxRole) * 100 : 0}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 pt-4 grid grid-cols-3 gap-2 text-center" style={{ borderTop: '1px solid var(--border-primary)' }}>
                        <div>
                            <p className="text-base font-bold text-emerald-400">{activeUsers}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Active</p>
                        </div>
                        <div>
                            <p className={`text-base font-bold ${suspendedUsers.length ? 'text-red-400' : 'text-slate-500'}`}>{suspendedUsers.length}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Suspended</p>
                        </div>
                        <div>
                            <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{users.filter(u => u.status === 'INACTIVE').length}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Inactive</p>
                        </div>
                    </div>
                </div>

                {/* Task priority + completion */}
                <div className="a-card rounded-2xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <Zap className="w-4 h-4 text-amber-400" /> {t('admin.panels.priorityHeatmap')}
                    </h3>
                    <div className="space-y-3">
                        {priCounts.map(({ p, count, done }) => (
                            <div key={p}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className={`text-xs font-medium ${priText[p]}`}>{p}</span>
                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{done}/{count} done</span>
                                </div>
                                <div className="h-2.5 rounded-full overflow-hidden relative" style={{ background: 'var(--bg-secondary)' }}>
                                    {/* total width */}
                                    <div className={`h-full rounded-full absolute inset-0 opacity-25 ${priColor[p]}`}
                                         style={{ width: `${maxPri ? (count / maxPri) * 100 : 0}%` }} />
                                    {/* done fill */}
                                    <div className={`h-full rounded-full ${priColor[p]}`}
                                         style={{ width: `${count ? (done / count) * 100 : 0}%` }} />
                                </div>
                            </div>
                        ))}
                        {priCounts.every(x => x.count === 0) && (
                            <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>{t('admin.noPriorityTasks')}</p>
                        )}
                    </div>
                    <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-primary)' }}>
                        <div className="flex items-center justify-between">
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('admin.overallCompletion')}</span>
                            <span className={`text-sm font-bold ${completionRate >= 70 ? 'text-emerald-400' : completionRate >= 40 ? 'text-amber-400' : 'text-red-400'}`}>{completionRate}%</span>
                        </div>
                        <div className="mt-1.5 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
                            <div className={`h-full rounded-full transition-all ${completionRate >= 70 ? 'bg-emerald-500' : completionRate >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                                 style={{ width: `${completionRate}%` }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Intelligence Row ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Top performers */}
                <div className="a-card rounded-2xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <Award className="w-4 h-4 text-amber-400" /> {t('admin.panels.topPerformers')}
                        <span className="text-xs font-normal ml-1" style={{ color: 'var(--text-muted)' }}>{t('admin.tasksCompleted')}</span>
                    </h3>
                    {topPerformers.length === 0 ? (
                        <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>{t('admin.noCompletedTasks')}</p>
                    ) : topPerformers.map(({ name, count }, i) => (
                        <div key={name} className="flex items-center gap-3 mb-3 last:mb-0">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                i === 0 ? 'bg-amber-400/20 text-amber-400' : i === 1 ? 'bg-slate-400/20 text-slate-300' : i === 2 ? 'bg-orange-700/20 text-orange-400' : 'bg-slate-700 text-slate-500'
                            }`}>{i + 1}</span>
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                {name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{name}</span>
                                    <span className="text-xs font-bold text-emerald-400 flex-shrink-0 ml-2">{count} ✓</span>
                                </div>
                                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
                                    <div className="h-full rounded-full bg-emerald-500"
                                         style={{ width: `${(count / maxPerf) * 100}%` }} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Most active users */}
                <div className="a-card rounded-2xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <Activity className="w-4 h-4 text-blue-400" /> {t('admin.panels.mostActive')}
                        <span className="text-xs font-normal ml-1" style={{ color: 'var(--text-muted)' }}>{t('admin.auditEvents')}</span>
                    </h3>
                    {mostActive.length === 0 ? (
                        <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>{t('admin.noActivityRecorded')}</p>
                    ) : mostActive.map(({ name, count }, i) => (
                        <div key={name} className="flex items-center gap-3 mb-3 last:mb-0">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                {name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{name}</span>
                                    <span className="text-xs font-bold text-blue-400 flex-shrink-0 ml-2">{count}</span>
                                </div>
                                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
                                    <div className="h-full rounded-full bg-blue-500"
                                         style={{ width: `${(count / maxAct2) * 100}%` }} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Overdue Tasks ────────────────────────────────────────────────── */}
            {overdueTasks.length > 0 && (
                <div className="a-card rounded-2xl border border-red-500/25 overflow-hidden" style={{ background: 'var(--bg-card)' }}>
                    <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(239,68,68,0.15)', background: 'rgba(239,68,68,0.04)' }}>
                        <h3 className="text-sm font-semibold flex items-center gap-2 text-red-400">
                            <AlertTriangle className="w-4 h-4" /> {t('admin.panels.overdueTasks')}
                        </h3>
                        <span className="text-xs bg-red-500/15 border border-red-500/25 text-red-400 px-2 py-0.5 rounded-full font-medium">{overdueTasks.length}</span>
                    </div>
                    <div className="divide-y" style={{ '--tw-divide-opacity': 1, borderColor: 'var(--border-primary)' }}>
                        {overdueTasks.slice(0, 8).map(task => (
                            <div key={task.id} className="flex items-center gap-3 px-5 py-3 hover:bg-red-500/5 transition-all">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{task.title}</p>
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                        {task.assignee ? `→ ${task.assignee.fullName}` : 'Unassigned'}
                                        {task.project?.name ? ` · ${task.project.name}` : ''}
                                    </p>
                                </div>
                                <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-lg flex-shrink-0">
                                    {daysOverdue(task.dueDate)}d late
                                </span>
                            </div>
                        ))}
                    </div>
                    {overdueTasks.length > 8 && (
                        <p className="text-xs text-center py-2" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border-primary)' }}>
                            +{overdueTasks.length - 8} more overdue tasks
                        </p>
                    )}
                </div>
            )}

            {/* ── Stalled Projects ─────────────────────────────────────────────── */}
            {stalledProjects.length > 0 && (
                <div className="a-card rounded-2xl border border-amber-500/20 p-5" style={{ background: 'var(--bg-card)' }}>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-amber-400">
                        <FolderOpen className="w-4 h-4" /> {t('admin.panels.stalledProjects')}
                        <span className="text-xs bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">{stalledProjects.length}</span>
                    </h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {stalledProjects.slice(0, 10).map(p => (
                            <span key={p.id} className="text-xs px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300">{p.name}</span>
                        ))}
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {t('admin.reviewRoadmap')}
                    </p>
                </div>
            )}

            {/* ── Security Events ──────────────────────────────────────────────── */}
            {secEvents.length > 0 && (
                <div className="a-card rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                    <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                        <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            <ShieldAlert className="w-4 h-4 text-red-400" /> {t('admin.panels.securityEvents')}
                        </h3>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('admin.sensitiveActions')}</span>
                    </div>
                    {secEvents.map((log, i) => (
                        <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-700/10 transition-all"
                             style={{ borderBottom: '1px solid var(--border-primary)' }}>
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                            <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-red-400 text-xs font-bold">{log.userFullName?.charAt(0) || '?'}</span>
                            </div>
                            <span className="text-xs font-medium flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>{log.userFullName || 'System'}</span>
                            <span className="text-xs font-mono flex-1 truncate text-red-400">{log.action}</span>
                            <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                                {log.createdAt ? new Date(log.createdAt).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Live Activity Feed ───────────────────────────────────────────── */}
            <div className="a-card rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                    <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <Activity className="w-4 h-4 text-emerald-400" /> {t('admin.panels.liveActivity')}
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </h3>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Latest {Math.min(logs.length, 15)} actions</span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                    {logs.slice(0, 15).map((log, i) => {
                        const a = (log.action || '').toUpperCase()
                        const dot = a.includes('DELETE') || a.includes('SUSPEND') ? 'bg-red-500'
                            : a.includes('CREATE') || a.includes('ADD')  ? 'bg-emerald-500'
                            : a.includes('UPDATE') || a.includes('EDIT') ? 'bg-amber-500'
                            : a.includes('LOGIN')                        ? 'bg-blue-500'
                            : 'bg-slate-500'
                        return (
                            <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-700/10 transition-all"
                                 style={{ borderBottom: '1px solid var(--border-primary)' }}>
                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                                <div className="w-6 h-6 rounded-full bg-blue-600/15 flex items-center justify-center flex-shrink-0">
                                    <span className="text-blue-400 text-xs font-bold">{log.userFullName?.charAt(0) || '?'}</span>
                                </div>
                                <span className="text-xs font-medium w-28 flex-shrink-0 truncate" style={{ color: 'var(--text-secondary)' }}>{log.userFullName || 'System'}</span>
                                <span className="text-xs font-mono flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{log.action}</span>
                                {(log.entityName || log.entityType) && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700/60 flex-shrink-0 max-w-[120px] truncate" style={{ color: 'var(--text-muted)' }}
                                          title={log.entityName || log.entityType}>
                                        {log.entityName || log.entityType}
                                    </span>
                                )}
                                <span className="text-xs flex-shrink-0 ml-1" style={{ color: 'var(--text-muted)' }}>
                                    {log.createdAt ? new Date(log.createdAt).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                                </span>
                            </div>
                        )
                    })}
                    {logs.length === 0 && (
                        <div className="flex items-center justify-center py-12" style={{ color: 'var(--text-muted)' }}>
                            <p className="text-sm">{t('admin.noActivityYet')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
