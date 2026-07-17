import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { Home, MessageSquare, FolderOpen, Layers, User,
    Shield, ShieldCheck, Bell, FileText, Users, Menu, X,
    Phone, Video, Search, Calendar, Megaphone, Loader2, Archive, Sparkles,
    GraduationCap, Globe, Sun, Moon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import React, { useState, useEffect, useRef } from 'react'
import useAuthStore from '../store/authStore'
import { getAvatarUrl } from '../utils/avatarUrl'
import useThemeStore from '../store/themeStore'
import useSocketStore from '../store/socketStore'
import api from '../api/axios'
import toast from 'react-hot-toast'
import NotificationsPanel from './NotificationsPanel'
import MeetingModal from './Meetingmodal'
import VoiceChannelSession from './VoiceChannelSession'
import VoiceChannelIncomingPopup from './VoiceChannelIncomingPopup'
import AIAssistantPanel from './AIAssistantPanel'
import TimezoneWidget from './TimezoneWidget'
import BackgroundCanvas from './BackgroundCanvas'
import useVoiceStore from '../store/voiceStore'

function UserBadge({ user }) {
    return user?.profilePhotoUrl
        ? <img src={getAvatarUrl(user)} alt="" className="rail-avatar" style={{ objectFit: 'cover' }} />
        : <span className="rail-avatar">{user?.fullName?.charAt(0)?.toUpperCase()}</span>
}

export default function Layout() {
    const { t } = useTranslation()
    const { user, updateUser } = useAuthStore()
    const { theme, toggleTheme } = useThemeStore()
    const navigate  = useNavigate()
    const location  = useLocation()

    const { connect, disconnect, incomingCall, activeCall, acceptCall, rejectCall, endCall } = useSocketStore()
    const { activeChannel: voiceChannel } = useVoiceStore()

    const [unreadCount,  setUnreadCount]  = useState(0)
    const [showSearch,   setShowSearch]   = useState(false)
    const [isNotificationsPanelOpen, setIsNotificationsPanelOpen] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [isMobile, setIsMobile]             = useState(window.innerWidth < 768)
    const [showAI, setShowAI]                 = useState(false)
    const [showTz, setShowTz]                 = useState(false)

    const isSuperAdmin = user?.role === 'SUPER_ADMIN'

    // ── Init global WebSocket once user is known ──────────────────────────────
    useEffect(() => {
        if (!user) return
        const token     = localStorage.getItem('token') ||
            JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.token
        const userId    = user?.id || user?.userId
        const companyId = user?.companyId

        if (!token || !userId) return

        connect(
            token,
            userId,
            companyId,
            null,  // conversation messages handled in ChatPage
            (update) => {
                // Presence updates — broadcast to ChatPage via custom event
                window.dispatchEvent(new CustomEvent('presence-update', { detail: update }))
            }
        )

        // Notify backend that we are now ONLINE
        api.patch('/presence', { status: 'ONLINE' }).catch(() => {})

        // Listen for photo updates
        const onPhoto = (e) => {
            const data = e.detail
            if (data.userId === userId) {
                updateUser({ ...user, profilePhotoUrl: data.photoUrl })
            }
        }
        window.addEventListener('user-photo-updated', onPhoto)

        // Mark OFFLINE on tab close / refresh (best-effort, navigator.sendBeacon)
        const onUnload = () => {
            const t = localStorage.getItem('token') ||
                JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.token
            if (t) {
                navigator.sendBeacon(
                    '/api/presence',
                    new Blob([JSON.stringify({ status: 'OFFLINE' })], { type: 'application/json' })
                )
            }
        }
        window.addEventListener('beforeunload', onUnload)

        return () => {
            window.removeEventListener('user-photo-updated', onPhoto)
            window.removeEventListener('beforeunload', onUnload)
            api.patch('/presence', { status: 'OFFLINE' }).catch(() => {})
            disconnect()
        }
    }, [user?.id])

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    useEffect(() => {
        const handler = e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault()
                setShowSearch(v => !v)
            }
            if (e.key === 'Escape') setShowSearch(false)
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    // Fermer le popover fuseaux horaires au clic extérieur
    useEffect(() => {
        if (!showTz) return
        const onDown = e => {
            const pop = document.getElementById('tz-popover')
            if (pop && !pop.contains(e.target) && !e.target.closest('#tz-btn')) setShowTz(false)
        }
        document.addEventListener('mousedown', onDown)
        return () => document.removeEventListener('mousedown', onDown)
    }, [showTz])

    // ── Nav items ─────────────────────────────────────────────────────────────
    const allNavItems = isSuperAdmin ? [
        { to: '/',           icon: Home,        label: t('nav.home')  },
        { to: '/superadmin', icon: ShieldCheck, label: t('nav.superAdmin') },
    ] : [
        { to: '/',              icon: Home,          label: t('nav.home')     },
        { to: '/chat',          icon: MessageSquare, label: t('nav.chat')     },
        { to: '/projects',      icon: FolderOpen,    label: t('nav.projects') },
        { to: '/documents',     icon: FileText,      label: t('nav.documents')     },
        { to: '/groups',        icon: Users,         label: t('nav.groups')        },
        { to: '/calendar',      icon: Calendar,      label: t('nav.calendar')      },
        { to: '/announcements', icon: Megaphone,     label: t('nav.announcements') },
        { to: '/archived',      icon: Archive,       label: t('nav.archived')  },
        { to: '/tutorial',      icon: GraduationCap, label: 'Tutorial'         },
    ]

    const railItems = [
        ...allNavItems,
        ...(!isSuperAdmin && user?.role === 'ADMIN'
            ? [{ to: '/admin', icon: Shield, label: t('nav.admin') }] : []),
        ...(!isSuperAdmin && (user?.role === 'MANAGER' || user?.role === 'ADMIN')
            ? [{ to: '/templates', icon: Layers, label: t('nav.templates') }] : []),
    ]

    const bottomNavItems = isSuperAdmin ? [
        { to: '/',           icon: Home,        label: t('nav.home')  },
        { to: '/superadmin', icon: ShieldCheck, label: t('nav.superAdmin') },
        { to: '/profile',    icon: User,         label: t('nav.profile')     },
    ] : [
        { to: '/',          icon: Home,          label: t('nav.home')     },
        { to: '/chat',      icon: MessageSquare, label: t('nav.chat')     },
        { to: '/projects',  icon: FolderOpen,    label: t('nav.projects') },
        { to: '/calendar',  icon: Calendar,      label: t('nav.calendar')        },
        { to: '/profile',   icon: User,          label: t('nav.profile')  },
    ]

    // ── Notifications unread count ────────────────────────────────────────────
    useEffect(() => {
        const fetch = async () => {
            try {
                const res = await api.get('/notifications/unread-count')
                setUnreadCount(res.data.data || 0)
            } catch {}
        }
        fetch()
        const i = setInterval(fetch, 30000)
        return () => clearInterval(i)
    }, [])

    useEffect(() => { setMobileMenuOpen(false) }, [location.pathname])

    const railClass = ({ isActive }) => `nav-item${isActive ? ' active' : ''}`
    const drawerClass = ({ isActive }) => `drawer-item${isActive ? ' active' : ''}`

    return (
        <>
            <BackgroundCanvas />
            <div className="app-shell">

                {/* ── Rail de navigation gauche (DA Compass) ─────────────── */}
                {!isMobile && (
                    <nav className="left-nav" aria-label="Navigation principale">
                        <img className="nav-logo" src="/logo.jpeg" alt="INCO LAB" onClick={() => navigate('/')} />
                        {railItems.map(({ to, icon: Icon, label }) => (
                            <NavLink key={to} to={to} end={to === '/'} className={railClass} title={label}>
                                <Icon />
                                <span className="nav-label">{label}</span>
                            </NavLink>
                        ))}
                        <NavLink to="/profile" className="nav-user" title={t('nav.profile')}>
                            <UserBadge user={user} />
                            <span className="presence" />
                        </NavLink>
                    </nav>
                )}

                <div className="app-main">
                    {/* ── Header 64px (DA Compass) ───────────────────────── */}
                    <header className="app-header">
                        {isMobile ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <button className="icon-btn" onClick={() => setMobileMenuOpen(true)} aria-label="Menu">
                                    <Menu />
                                </button>
                                <img src="/logo.jpeg" alt="" style={{ width: 26, height: 26, borderRadius: 8, objectFit: 'cover' }} />
                                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>INCO LAB</span>
                            </div>
                        ) : (
                            <button className="header-search" onClick={() => setShowSearch(true)} title={t('layout.searchTitle')}>
                                <Search />
                                <span className="search-hint">{t('layout.searchTitle')}</span>
                                <kbd>⌘K</kbd>
                            </button>
                        )}

                        <div className="header-right">
                            {isMobile && (
                                <button className="icon-btn" onClick={() => setShowSearch(true)} title={t('layout.searchTitle')}>
                                    <Search />
                                </button>
                            )}
                            {!isSuperAdmin && (
                                <button className="icon-btn" onClick={() => setShowAI(true)} title="AI Assistant" style={{ color: '#a78bfa' }}>
                                    <Sparkles />
                                </button>
                            )}
                            {!isSuperAdmin && (
                                <button id="tz-btn" className="icon-btn" onClick={() => setShowTz(v => !v)} title="Timezones">
                                    <Globe />
                                </button>
                            )}
                            <button className="icon-btn" onClick={toggleTheme} title="Theme">
                                {theme === 'light' ? <Moon /> : <Sun />}
                            </button>
                            <button className="icon-btn" onClick={() => setIsNotificationsPanelOpen(true)} title={t('nav.notifications', 'Notifications')}>
                                <Bell />
                                {unreadCount > 0 && (
                                    <span className="count-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                                )}
                            </button>
                            <span style={{ cursor: 'pointer', position: 'relative', display: 'inline-flex' }}
                                  onClick={() => navigate('/profile')} title={t('nav.profile')}>
                                <UserBadge user={user} />
                            </span>
                        </div>
                    </header>

                    {/* ── Popover fuseaux horaires ───────────────────────── */}
                    {showTz && (
                        <div id="tz-popover" className="header-popover">
                            <TimezoneWidget />
                        </div>
                    )}

                    <main className="content"
                          style={{ paddingBottom: isMobile ? '64px' : voiceChannel ? '56px' : '0' }}>
                        <Outlet />
                    </main>
                </div>
            </div>

            {/* ── Drawer mobile ──────────────────────────────────────────── */}
            {isMobile && mobileMenuOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }}
                         onClick={() => setMobileMenuOpen(false)} />
                    <aside style={{ position: 'relative', zIndex: 10, width: '280px', display: 'flex',
                        flexDirection: 'column', background: 'var(--surface)',
                        borderRight: '1px solid var(--border)', boxShadow: 'var(--shadow-pop)',
                        padding: '14px 10px', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 14px',
                            borderBottom: '1px solid var(--border)', marginBottom: 10 }}>
                            <img src="/logo.jpeg" alt="INCO LAB" style={{ width: 30, height: 30, borderRadius: 9, objectFit: 'cover' }} />
                            <div style={{ flex: 1 }}>
                                <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>INCO LAB</p>
                                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-2)' }}>{t('layout.appDescription')}</p>
                            </div>
                            <button className="icon-btn" onClick={() => setMobileMenuOpen(false)} aria-label="Fermer">
                                <X />
                            </button>
                        </div>
                        {railItems.map(({ to, icon: Icon, label }) => (
                            <NavLink key={to} to={to} end={to === '/'} className={drawerClass}>
                                <Icon />
                                {label}
                            </NavLink>
                        ))}
                        <NavLink to="/profile" className={drawerClass}>
                            <User />
                            {t('nav.profile')}
                        </NavLink>
                    </aside>
                </div>
            )}

            {/* ── Nav mobile basse ───────────────────────────────────────── */}
            {isMobile && (
                <nav className="mobile-bottom-nav">
                    {bottomNavItems.map(({ to, icon: Icon, label }) => (
                        <NavLink key={to} to={to} end={to === '/'} className={railClass}>
                            <Icon />
                            <span className="nav-label">{label}</span>
                        </NavLink>
                    ))}
                </nav>
            )}

            <NotificationsPanel
                isOpen={isNotificationsPanelOpen}
                onClose={() => setIsNotificationsPanelOpen(false)}
                onUnreadCountChange={setUnreadCount}
            />

            {showSearch && <GlobalSearch onClose={() => setShowSearch(false)} />}

            {/* ── Incoming call notification ─────────────────────────────────── */}
            {incomingCall && !activeCall && (
                <IncomingCallPopup
                    call={incomingCall}
                    onAccept={() => acceptCall(incomingCall)}
                    onDecline={() => rejectCall(incomingCall)}
                    t={t}
                />
            )}

            {/* ── Active call (full-screen) ──────────────────────────────────── */}
            {activeCall && (
                <MeetingModal
                    roomId={`call-${[String(user?.id || user?.userId), String(activeCall.remoteUser?.id)].sort().join('-')}`}
                    mode={activeCall.mode}
                    remoteUser={activeCall.remoteUser}
                    onClose={() => endCall()}
                />
            )}

            {/* ── Voice channel persistent bar ──────────────────────────────── */}
            {voiceChannel && <VoiceChannelSession />}

            {/* ── Incoming voice channel popup (bottom-right) ───────────────── */}
            <VoiceChannelIncomingPopup />

            {/* ── AI Assistant floating panel ────────────────────────────────── */}
            {showAI && <AIAssistantPanel onClose={() => setShowAI(false)} />}

            <GlobalImagePreviewOverlay />
        </>
    )
}


// ─── Global Search ────────────────────────────────────────────────────────────

function GlobalSearch({ onClose }) {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { joinChannel: joinVoiceChannel } = useVoiceStore()

    /** Open or create a 1:1 conversation with a user. */
    const openDmWith = (u) => {
        navigate('/chat', { state: { openDmUserId: u.id } })
        onClose()
    }

    /** Start a voice or video call with a user via their direct conversation. */
    const callUser = async (u, mode) => {
        try {
            const res  = await api.post(`/chat/conversations/direct/${u.id}`)
            const conv = res.data?.data
            if (conv) {
                joinVoiceChannel('CONVERSATION', null, conv.id, `Call with ${u.fullName}`, mode)
                onClose()
            }
        } catch {
            toast.error('Could not start call')
        }
    }
    const [query,   setQuery]   = useState('')
    const [results, setResults] = useState({
        tasks: [], files: [], folders: [], projects: [], users: [],
        conversations: [], groups: [], templates: []
    })
    const [loading, setLoading] = useState(false)
    const inputRef = useRef(null)

    const getToken = () =>
        JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.token ||
        localStorage.getItem('token') || ''

    useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50) }, [])

    useEffect(() => {
        if (!query.trim() || query.length < 2) {
            setResults({ tasks: [], files: [], folders: [], projects: [], users: [], conversations: [], groups: [], templates: [] })
            return
        }
        const timer = setTimeout(async () => {
            setLoading(true)
            const token = getToken()
            const headers = { Authorization: `Bearer ${token}` }
            const ql = query.toLowerCase()
            const q  = encodeURIComponent(ql)

            const safeFilter = (arr, fn) => Array.isArray(arr) ? arr.filter(fn).slice(0, 5) : []
            const safeJson   = r => r.ok ? r.json() : Promise.resolve({ data: [] })

            try {
                const [
                    tasksR, filesR, foldersR, projectsR, usersR,
                    convsR, groupsR, templatesR
                ] = await Promise.allSettled([
                    fetch('/api/tasks/hub', { headers }).then(safeJson)
                        .then(d => safeFilter(d.data, t => t.title?.toLowerCase().includes(ql))),
                    fetch(`/api/files/my-documents/search?keyword=${q}`, { headers }).then(safeJson)
                        .then(d => (d.data || []).slice(0, 5)),
                    fetch(`/api/folders/search?keyword=${q}`, { headers }).then(safeJson)
                        .then(d => (d.data || []).slice(0, 5)),
                    fetch('/api/projects', { headers }).then(safeJson)
                        .then(d => safeFilter(d.data, p => p.name?.toLowerCase().includes(ql))),
                    fetch(`/api/users/search?keyword=${q}`, { headers }).then(safeJson)
                        .then(d => safeFilter(d.data, u => u.fullName?.toLowerCase().includes(ql))),
                    fetch('/api/chat/conversations', { headers }).then(safeJson)
                        .then(d => safeFilter(d.data, c =>
                            (c.name || c.projectName || c.participants?.map(p => p.fullName).join(' ') || '')
                                .toLowerCase().includes(ql))),
                    fetch('/api/groups', { headers }).then(safeJson)
                        .then(d => safeFilter(d.data, g => g.name?.toLowerCase().includes(ql))),
                    fetch('/api/tasks/templates', { headers }).then(safeJson)
                        .then(d => safeFilter(d.data, t => t.name?.toLowerCase().includes(ql))),
                ])

                setResults({
                    tasks:         tasksR.status     === 'fulfilled' ? tasksR.value     : [],
                    files:         filesR.status     === 'fulfilled' ? filesR.value     : [],
                    folders:       foldersR.status   === 'fulfilled' ? foldersR.value   : [],
                    projects:      projectsR.status  === 'fulfilled' ? projectsR.value  : [],
                    users:         usersR.status     === 'fulfilled' ? usersR.value     : [],
                    conversations: convsR.status     === 'fulfilled' ? convsR.value     : [],
                    groups:        groupsR.status    === 'fulfilled' ? groupsR.value    : [],
                    templates:     templatesR.status === 'fulfilled' ? templatesR.value : [],
                })
            } finally {
                setLoading(false)
            }
        }, 300)
        return () => clearTimeout(timer)
    }, [query])

    const total = Object.values(results).reduce((s, a) => s + a.length, 0)
    const hasResults = total > 0
    const isEmpty    = query.length >= 2 && !loading && !hasResults

    const go = (path, state = {}) => { navigate(path, { state }); onClose() }

    const PRIORITY_EMOJI = { LOW: '🟢', NORMAL: '🔵', HIGH: '🟠', URGENT: '🔴' }

    const Section = ({ skey, title, icon, children, hasBorder }) => (
        <div style={{ borderTop: hasBorder ? '1px solid var(--border-primary)' : 'none' }}>
            <div style={{ padding: '8px 16px 4px', display: 'flex', alignItems: 'center', gap: '6px',
                fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <span>{icon}</span> {title}
            </div>
            {children}
        </div>
    )

    const ResultRow = ({ icon, label, sublabel, badge, onClick }) => (
        <button onClick={onClick}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '9px 16px', textAlign: 'left', background: 'transparent',
                    border: 'none', cursor: 'pointer', color: 'var(--text-primary)', transition: 'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <div style={{ width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--bg-card)', fontSize: '16px', border: '1px solid var(--border-primary)' }}>
                {icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{label}</div>
                {sublabel && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sublabel}</div>}
            </div>
            {badge && <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '20px',
                background: 'rgba(59,130,246,0.15)', color: '#60a5fa',
                border: '1px solid rgba(59,130,246,0.25)', flexShrink: 0, fontWeight: 600 }}>{badge}</span>}
            <div style={{ color: 'var(--text-muted)', opacity: 0.5, flexShrink: 0, fontSize: '11px' }}>↵</div>
        </button>
    )

    return (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-14 px-4"
             style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }}
             onClick={onClose}>
            <div className="w-full max-w-xl shadow-2xl rounded-2xl overflow-hidden"
                 style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
                 onClick={e => e.stopPropagation()}>

                {/* Input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '14px 16px', borderBottom: '1px solid var(--border-primary)', flexShrink: 0 }}>
                    <Search style={{ width: '18px', height: '18px', color: 'var(--text-muted)', flexShrink: 0 }} />
                    <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                           placeholder="Search tasks, projects, chats, files, folders, groups, users…"
                           style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none',
                               color: 'var(--text-primary)', fontSize: '15px' }}
                           onKeyDown={e => e.key === 'Escape' && onClose()}
                    />
                    {loading
                        ? <Loader2 style={{ width: '16px', height: '16px', color: '#3b82f6', flexShrink: 0 }} className="animate-spin" />
                        : query && <button onClick={() => setQuery('')}
                                           style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}>
                        <X style={{ width: '15px', height: '15px' }} />
                    </button>
                    }
                    <kbd style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--bg-card)',
                        padding: '2px 6px', borderRadius: '5px', border: '1px solid var(--border-primary)', flexShrink: 0 }}>ESC</kbd>
                </div>

                {/* Results */}
                <div style={{ overflowY: 'auto', flex: 1 }}>

                    {!query && (
                        <div style={{ padding: '36px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <Search style={{ width: '28px', height: '28px', margin: '0 auto 10px', opacity: 0.25 }} />
                            <p style={{ fontSize: '14px', marginBottom: '4px' }}>Search everything</p>
                            <p style={{ fontSize: '12px', opacity: 0.6 }}>Tasks · Projects · Chats · Files · Folders · Groups · Users · Templates</p>
                        </div>
                    )}

                    {isEmpty && (
                        <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <p style={{ fontSize: '14px' }}>No results for <strong>"{query}"</strong></p>
                            <p style={{ fontSize: '12px', marginTop: '6px', opacity: 0.6 }}>Try a different keyword</p>
                        </div>
                    )}

                    {results.tasks.length > 0 && (
                        <Section skey="tasks" title="Tasks" icon="✅" hasBorder={false}>
                            {results.tasks.map(task => (
                                <ResultRow key={task.id}
                                           icon={PRIORITY_EMOJI[task.priority] || '✅'}
                                           label={task.title}
                                           sublabel={`${task.projectName || 'No project'} · ${task.status?.replace('_', ' ')}`}
                                           badge={task.isArchived ? 'Archived' : null}
                                           onClick={() => go('/projects', { openProjectId: task.projectId, openTaskId: task.id })}
                                />
                            ))}
                        </Section>
                    )}

                    {results.projects.length > 0 && (
                        <Section skey="projects" title="Projects" icon="📁" hasBorder={results.tasks.length > 0}>
                            {results.projects.map(p => (
                                <ResultRow key={p.id}
                                           icon="📁"
                                           label={p.name}
                                           sublabel={p.description?.slice(0, 60) || p.status}
                                           badge={p.status === 'ARCHIVED' ? 'Archived' : null}
                                           onClick={() => go('/projects', { openProjectId: p.id })}
                                />
                            ))}
                        </Section>
                    )}

                    {results.conversations.length > 0 && (
                        <Section skey="conversations" title="Conversations" icon="💬" hasBorder={results.tasks.length > 0 || results.projects.length > 0}>
                            {results.conversations.map(c => {
                                const name = c.name || c.participants?.filter(p => p.id !== c.currentUserId)
                                    .map(p => p.fullName).join(', ') || `Conversation #${c.id}`
                                return (
                                    <ResultRow key={c.id}
                                               icon={c.type === 'GROUP' ? '👥' : '💬'}
                                               label={name}
                                               sublabel={c.type === 'GROUP' ? 'Group conversation' : 'Direct message'}
                                               badge={c.unreadCount > 0 ? `${c.unreadCount} new` : null}
                                               onClick={() => go('/chat', { openConvId: c.id })}
                                    />
                                )
                            })}
                        </Section>
                    )}

                    {results.files.length > 0 && (
                        <Section skey="files" title="Documents" icon="📄"
                                 hasBorder={results.tasks.length > 0 || results.projects.length > 0 || results.conversations.length > 0}>
                            {results.files.map(f => (
                                <ResultRow key={f.id}
                                           icon="📄"
                                           label={f.originalName || f.fileName}
                                           sublabel={`${f.mimeType?.split('/')[1]?.toUpperCase() || 'File'}${f.fileSize ? ` · ${(f.fileSize/1024).toFixed(0)} KB` : ''}`}
                                           badge={f.isArchived ? 'Archived' : null}
                                           onClick={() => go('/documents', { highlightFileId: f.id })}
                                />
                            ))}
                        </Section>
                    )}

                    {results.folders.length > 0 && (
                        <Section skey="folders" title="Folders" icon="📂"
                                 hasBorder={results.tasks.length > 0 || results.projects.length > 0 || results.conversations.length > 0 || results.files.length > 0}>
                            {results.folders.map(f => (
                                <ResultRow key={f.id}
                                           icon="📂"
                                           label={f.name}
                                           sublabel={f.parentFolder ? `Inside: ${f.parentFolder.name}` : 'Root folder'}
                                           badge={f.isArchived ? 'Archived' : null}
                                           onClick={() => go('/documents', { openFolderId: f.id, openFolderName: f.name })}
                                />
                            ))}
                        </Section>
                    )}

                    {results.groups.length > 0 && (
                        <Section skey="groups" title="Groups" icon="👥"
                                 hasBorder={results.tasks.length > 0 || results.projects.length > 0 || results.files.length > 0 || results.folders.length > 0 || results.conversations.length > 0}>
                            {results.groups.map(g => (
                                <ResultRow key={g.id}
                                           icon="👥"
                                           label={g.name}
                                           sublabel={g.description || `${g.members?.length || 0} members`}
                                           badge={g.isArchived ? 'Archived' : null}
                                           onClick={() => go('/groups', { openGroupId: g.id })}
                                />
                            ))}
                        </Section>
                    )}

                    {results.users.length > 0 && (
                        <Section skey="users" title="People" icon="👤"
                                 hasBorder={hasResults && results.groups.length === 0 ? true : results.groups.length > 0}>
                            {results.users.map(u => (
                                <div key={u.id}
                                     style={{ display: 'flex', alignItems: 'center', gap: '8px',
                                              padding: '6px 10px 6px 16px',
                                              transition: 'background 0.12s' }}
                                     onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                                     onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <button
                                        onClick={() => openDmWith(u)}
                                        style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px',
                                                 padding: '4px 0', textAlign: 'left', background: 'transparent',
                                                 border: 'none', cursor: 'pointer', color: 'var(--text-primary)',
                                                 minWidth: 0 }}>
                                        <div style={{ width: '34px', height: '34px', borderRadius: '10px',
                                                      flexShrink: 0, display: 'flex', alignItems: 'center',
                                                      justifyContent: 'center', background: 'var(--bg-card)',
                                                      fontSize: '16px', border: '1px solid var(--border-primary)' }}>
                                            {u.profilePhotoUrl
                                                ? <img src={getAvatarUrl(u)} style={{ width: '34px', height: '34px', borderRadius: '10px', objectFit: 'cover' }} alt="" />
                                                : '👤'}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '13px', fontWeight: 500,
                                                          overflow: 'hidden', textOverflow: 'ellipsis',
                                                          whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                                                {u.fullName}
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)',
                                                          marginTop: '1px', overflow: 'hidden',
                                                          textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {(u.role?.toLowerCase().replace('_', ' ') || '')} · {u.email || ''}
                                            </div>
                                        </div>
                                    </button>
                                    {/* Quick actions — message / voice call / video call */}
                                    <button onClick={() => openDmWith(u)}
                                            title="Send message"
                                            style={{ width: '32px', height: '32px', borderRadius: '8px',
                                                     background: 'rgba(59,130,246,0.12)', color: '#60a5fa',
                                                     border: '1px solid rgba(59,130,246,0.25)',
                                                     cursor: 'pointer', display: 'flex', alignItems: 'center',
                                                     justifyContent: 'center', flexShrink: 0 }}>
                                        <MessageSquare style={{ width: '15px', height: '15px' }} />
                                    </button>
                                    <button onClick={() => callUser(u, 'audio')}
                                            title="Voice call"
                                            style={{ width: '32px', height: '32px', borderRadius: '8px',
                                                     background: 'rgba(16,185,129,0.12)', color: '#34d399',
                                                     border: '1px solid rgba(16,185,129,0.25)',
                                                     cursor: 'pointer', display: 'flex', alignItems: 'center',
                                                     justifyContent: 'center', flexShrink: 0 }}>
                                        <Phone style={{ width: '15px', height: '15px' }} />
                                    </button>
                                    <button onClick={() => callUser(u, 'video')}
                                            title="Video call"
                                            style={{ width: '32px', height: '32px', borderRadius: '8px',
                                                     background: 'rgba(147,51,234,0.12)', color: '#c084fc',
                                                     border: '1px solid rgba(147,51,234,0.25)',
                                                     cursor: 'pointer', display: 'flex', alignItems: 'center',
                                                     justifyContent: 'center', flexShrink: 0 }}>
                                        <Video style={{ width: '15px', height: '15px' }} />
                                    </button>
                                </div>
                            ))}
                        </Section>
                    )}

                    {results.templates.length > 0 && (
                        <Section skey="templates" title="Task Templates" icon="📋"
                                 hasBorder={hasResults}>
                            {results.templates.map(tmpl => (
                                <ResultRow key={tmpl.id}
                                           icon="📋"
                                           label={tmpl.name}
                                           sublabel={`${tmpl.tasks?.length || 0} tasks`}
                                           onClick={() => go('/task-templates')}
                                />
                            ))}
                        </Section>
                    )}

                    {hasResults && (
                        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border-primary)',
                            fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{total} result{total !== 1 ? 's' : ''}</span>
                            <span>Click to navigate directly →</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Global Image Preview Overlay (listens to 'preview-img' event from any page)
───────────────────────────────────────────────────────────────────────────── */
function GlobalImagePreviewOverlay() {
    const [src, setSrc] = useState(null)

    useEffect(() => {
        const handler = e => setSrc(e.detail)
        window.addEventListener('preview-img', handler)
        return () => window.removeEventListener('preview-img', handler)
    }, [])

    if (!src) return null

    return (
        <div className="fixed inset-0 bg-black/90 z-[99999] flex items-center justify-center cursor-zoom-out"
             onClick={() => setSrc(null)}>
            <button className="absolute top-4 right-4 text-white/60 hover:text-white p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all"
                    onClick={() => setSrc(null)}>
                <X style={{ width: '24px', height: '24px' }} />
            </button>
            <img src={src} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
                 onClick={e => e.stopPropagation()} />
        </div>
    )
}

/* ─────────────────────────────────────────────────────────────────────────────
   IncomingCallPopup
───────────────────────────────────────────────────────────────────────────── */
function IncomingCallPopup({ call, onAccept, onDecline }) {
    const displayName = call.remoteUser?.fullName || 'Calling...'
    const letter      = displayName.charAt(0).toUpperCase()
    const isVideo     = call.mode === 'video'
    const accent   = isVideo ? '#5865f2' : '#3ba55c'
    const answered = React.useRef(false)

    const handleAccept = () => {
        if (answered.current) return
        answered.current = true
        onAccept()
    }
    const handleDecline = () => {
        if (answered.current) return
        answered.current = true
        onDecline()
    }

    return (
        <>
            <style>{`
              @keyframes icpSlideIn {
                from { transform: translateX(120%) scale(0.92); opacity: 0; }
                to   { transform: translateX(0)   scale(1);    opacity: 1; }
              }
              @keyframes icpRing1 {
                0%   { transform: scale(1);    opacity: 0.55; }
                100% { transform: scale(1.9);  opacity: 0; }
              }
              @keyframes icpRing2 {
                0%   { transform: scale(1);    opacity: 0.35; }
                100% { transform: scale(2.5);  opacity: 0; }
              }
              @keyframes icpBar {
                0%,100% { transform: scaleY(0.3); }
                50%     { transform: scaleY(1); }
              }
              .icp-decline, .icp-accept {
                flex: 1; height: 42px; border-radius: 10px; border: none;
                cursor: pointer; font-weight: 700; font-size: 13px;
                display: flex; align-items: center; justify-content: center; gap: 7px;
                transition: transform 0.12s, filter 0.12s, box-shadow 0.12s;
                font-family: inherit;
              }
              .icp-decline {
                background: #ed4245; color: #fff;
                box-shadow: 0 3px 14px rgba(237,66,69,0.4);
              }
              .icp-accept {
                background: #3ba55c; color: #fff;
                box-shadow: 0 3px 14px rgba(59,165,92,0.4);
              }
              .icp-decline:hover { filter: brightness(1.15); transform: translateY(-1px); box-shadow: 0 6px 20px rgba(237,66,69,0.55); }
              .icp-accept:hover  { filter: brightness(1.15); transform: translateY(-1px); box-shadow: 0 6px 20px rgba(59,165,92,0.55); }
              .icp-decline:active, .icp-accept:active { transform: scale(0.95); }
            `}</style>

            <div style={{
                position: 'fixed', bottom: 28, right: 28, zIndex: 99999,
                width: 300,
                borderRadius: 18,
                overflow: 'visible',
                pointerEvents: 'all',
                animation: 'icpSlideIn 0.35s cubic-bezier(0.34,1.4,0.64,1) forwards',
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            }}>
                <div style={{
                    borderRadius: 18, overflow: 'hidden',
                    background: 'rgba(30,33,36,0.97)',
                    backdropFilter: 'blur(28px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 32px 80px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.04)',
                    pointerEvents: 'all',
                }}>
                    <div style={{ height: 3, background: `linear-gradient(90deg, ${accent}, ${accent}88)` }} />

                    <div style={{ padding: '20px 20px 18px' }}>
                        <p style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 600,
                            color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                            INCOLAB
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
                            <div style={{ position: 'relative', flexShrink: 0, width: 56, height: 56 }}>
                                <div style={{
                                    position: 'absolute', inset: 0, borderRadius: '50%',
                                    background: accent, opacity: 0.45,
                                    animation: 'icpRing1 1.8s ease-out infinite',
                                }} />
                                <div style={{
                                    position: 'absolute', inset: 0, borderRadius: '50%',
                                    background: accent, opacity: 0.25,
                                    animation: 'icpRing2 1.8s ease-out infinite 0.4s',
                                }} />
                                <div style={{
                                    position: 'relative', width: 56, height: 56, borderRadius: '50%',
                                    background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#fff', fontWeight: 800, fontSize: 22,
                                    boxShadow: `0 4px 16px ${accent}55`,
                                }}>
                                    {letter}
                                </div>
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{
                                    color: '#fff', fontWeight: 700, fontSize: 16, margin: '0 0 5px',
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                }}>
                                    {displayName}
                                </p>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 5,
                                        fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
                                        color: accent, textTransform: 'uppercase',
                                    }}>
                                        {isVideo ? (
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M15 8v8H5V8h10m1-2H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4V7a1 1 0 00-1-1z"/>
                                            </svg>
                                        ) : (
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
                                            </svg>
                                        )}
                                        {isVideo ? 'Video call' : 'Voice call'}
                                    </span>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 14 }}>
                                        {[0, 0.2, 0.4, 0.15, 0.35].map((delay, i) => (
                                            <div key={i} style={{
                                                width: 3, height: '100%',
                                                background: accent, borderRadius: 2,
                                                transformOrigin: 'bottom',
                                                animation: `icpBar 0.9s ease-in-out infinite ${delay}s`,
                                            }} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button className="icp-decline" onClick={handleDecline}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
                                </svg>
                                Decline
                            </button>
                            <button className="icp-accept" onClick={handleAccept}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
                                </svg>
                                Accept
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
