import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, CheckSquare, Clock, AlertCircle, TrendingUp, Users, Activity, AlertTriangle, Calendar } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../api/axios'
import useAuthStore from '../store/authStore'
import gsap from 'gsap'

export default function DashboardPage() {
    const { t } = useTranslation()
    const { user } = useAuthStore()
    const navigate = useNavigate()
    const [tasks, setTasks] = useState([])
    const [projects, setProjects] = useState([])
    const [upcomingEvents, setUpcomingEvents] = useState([])
    const [loading, setLoading] = useState(true)
    const containerRef = useRef(null)

    // Manager-specific data
    const [teamStats, setTeamStats] = useState({ overdue: 0, blocked: 0 })
    const [openIssues, setOpenIssues] = useState(0)
    const [myOpenIssues, setMyOpenIssues] = useState([])

    // Admin-specific data
    const [userStats, setUserStats] = useState({ EMPLOYEE: 0, MANAGER: 0, ADMIN: 0 })
    const [platformStats, setPlatformStats] = useState({ totalTasks: 0, totalProjects: 0, activeUsers: 0 })

    useEffect(() => {
        const fetchData = async () => {
            try {
                const baseRequests = [
                    api.get('/tasks/hub'),
                    api.get('/projects'),
                    api.get('/calendar/events').catch(() => ({ data: { data: [] } })),
                    api.get('/issues/my-open').catch(() => ({ data: { data: [] } }))
                ]

                const additionalRequests = []

                if (user?.role === 'MANAGER' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') {
                    additionalRequests.push(
                        api.get('/tasks/team-stats').catch(() => ({ data: { data: { overdue: 0, blocked: 0 } } })),
                        api.get('/projects/issues-count').catch(() => ({ data: { data: 0 } }))
                    )
                }

                if (user?.role === 'ADMIN') {
                    additionalRequests.push(
                        api.get('/users').catch(() => ({ data: { data: [] } })),
                        api.get('/platform/stats').catch(() => ({ data: { data: { totalTasks: 0, totalProjects: 0, activeUsers: 0 } } }))
                    )
                }

                const responses = await Promise.all([...baseRequests, ...additionalRequests])

                setTasks(responses[0].data.data || [])
                setProjects(responses[1].data.data || [])
                const now = new Date()
                const events = (responses[2].data.data || [])
                    .filter(e => e.startTime && new Date(e.startTime) >= now)
                    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
                    .slice(0, 5)
                setUpcomingEvents(events)
                setMyOpenIssues(responses[3].data.data || [])

                let responseIndex = 4
                if (user?.role === 'MANAGER' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') {
                    setTeamStats(responses[responseIndex]?.data.data || { overdue: 0, blocked: 0 })
                    setOpenIssues(responses[responseIndex + 1]?.data.data || 0)
                    responseIndex += 2
                }

                if (user?.role === 'ADMIN') {
                    const users = responses[responseIndex]?.data.data || []
                    const userCounts = users.reduce((acc, u) => {
                        acc[u.role] = (acc[u.role] || 0) + 1
                        return acc
                    }, { EMPLOYEE: 0, MANAGER: 0, ADMIN: 0 })
                    setUserStats(userCounts)
                    setPlatformStats(responses[responseIndex + 1]?.data.data || { totalTasks: 0, totalProjects: 0, activeUsers: 0 })
                }

            } catch (err) {
                console.error('Dashboard data fetch failed:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [user?.role])


    // ── GSAP entrance animation ──────────────────────────────────────────────
    useEffect(() => {
        if (loading) return
        const ctx = gsap.context(() => {
            // Greeting — typewriter-style fade
            gsap.fromTo('.dash-greeting',
                { opacity: 0, y: -20 },
                { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }
            )
            gsap.fromTo('.dash-greeting h1',
                { clipPath: 'inset(0 100% 0 0)' },
                { clipPath: 'inset(0 0% 0 0)', duration: 0.8, delay: 0.1, ease: 'power2.inOut' }
            )

            // Stat cards — cascade from left with spring
            gsap.fromTo('.dash-stat',
                { opacity: 0, y: 30, scale: 0.9, rotateX: 15 },
                {
                    opacity: 1, y: 0, scale: 1, rotateX: 0,
                    duration: 0.55, stagger: 0.1, delay: 0.15,
                    ease: 'back.out(1.4)', clearProps: 'transform'
                }
            )

            // Animate stat numbers counting up
            document.querySelectorAll('.dash-stat .stat-value').forEach(el => {
                const target = parseInt(el.textContent, 10) || 0
                if (target > 0) {
                    gsap.from(el, {
                        textContent: 0,
                        duration: 1.2,
                        delay: 0.4,
                        ease: 'power2.out',
                        snap: { textContent: 1 },
                    })
                }
            })

            // Sections — stagger reveal with parallax feel
            gsap.fromTo('.dash-section',
                { opacity: 0, y: 25 },
                { opacity: 1, y: 0, duration: 0.55, stagger: 0.12, delay: 0.35, ease: 'power2.out' }
            )
        }, containerRef)
        return () => ctx.revert()
    }, [loading])

    if (loading) {
        return (
            <div className="p-6 space-y-6 w-full min-h-full">
                <div className="skeleton h-10 w-64 rounded-xl" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="skeleton h-64 rounded-2xl" />
                    <div className="skeleton h-64 rounded-2xl" />
                </div>
            </div>
        )
    }

    const myTasks          = tasks.filter(t => t.status !== 'DONE')
    const overdueTasks     = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE')
    const completedToday   = tasks.filter(t => t.status === 'DONE' && t.updatedAt && new Date(t.updatedAt).toDateString() === new Date().toDateString())

    const statCards = [
        { label: t('dashboard.activeTasks'),  value: myTasks.length,         icon: CheckSquare, color: 'text-blue-400 bg-blue-400/10',     onClick: () => navigate('/projects')   },
        { label: t('dashboard.projects'),     value: projects.length,        icon: FolderOpen,  color: 'text-violet-400 bg-violet-400/10', onClick: () => navigate('/projects') },
        { label: t('dashboard.overdue'),      value: overdueTasks.length,    icon: AlertCircle, color: 'text-red-400 bg-red-400/10',       onClick: () => navigate('/projects')   },
        { label: t('dashboard.doneToday'),    value: completedToday.length,  icon: TrendingUp,  color: 'text-emerald-400 bg-emerald-400/10', onClick: null },
    ]

    const priorityColor = { HIGH: 'text-red-400', MEDIUM: 'text-amber-400', LOW: 'text-slate-400', CRITICAL: 'text-red-500' }
    const statusColor   = { TODO: 'bg-slate-500', IN_PROGRESS: 'bg-blue-500', REVIEW: 'bg-amber-500', DONE: 'bg-emerald-500', BLOCKED: 'bg-red-500' }

    return (
        <div ref={containerRef} className="p-6 space-y-6 w-full min-h-full">

            {/* Greeting */}
            <div className="dash-greeting">
                <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    {getGreeting()}, {user?.fullName?.split(' ')[0]} 👋
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {statCards.map(({ label, value, icon: Icon, color, onClick }) => (
                    <div key={label}
                         className={`dash-stat rounded-2xl p-5 border transition-all ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''}`}
                         style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}
                         onClick={onClick || undefined}>
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
                            <Icon className="w-4 h-4" />
                        </div>
                        <p className="text-2xl font-bold stat-value" style={{ color: 'var(--text-primary)' }}>{value}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                    </div>
                ))}
            </div>

            {/* Manager/Admin extra stats */}
            {(user?.role === 'MANAGER' || user?.role === 'ADMIN') && (
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: t('dashboard.teamOverdue'),   value: teamStats.overdue,  icon: AlertTriangle, color: 'text-red-400 bg-red-400/10'    },
                        { label: t('dashboard.blockedTasks'),  value: teamStats.blocked,  icon: Activity,      color: 'text-amber-400 bg-amber-400/10' },
                        { label: t('dashboard.openIssues'),    value: openIssues,         icon: AlertCircle,   color: 'text-red-400 bg-red-400/10'    },
                    ].map(({ label, value, icon: Icon, color }) => (
                        <div key={label} className="dash-stat rounded-2xl p-5 border"
                             style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
                                <Icon className="w-4 h-4" />
                            </div>
                            <p className="text-2xl font-bold stat-value" style={{ color: 'var(--text-primary)' }}>{value}</p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Admin platform stats */}
            {user?.role === 'ADMIN' && (
                <div className="dash-section grid grid-cols-3 gap-4">
                    {[
                        { label: t('dashboard.totalTasks'),    value: platformStats.totalTasks,    icon: CheckSquare, color: 'text-blue-400 bg-blue-400/10'     },
                        { label: t('dashboard.totalProjects'), value: platformStats.totalProjects, icon: FolderOpen,  color: 'text-violet-400 bg-violet-400/10' },
                        { label: t('dashboard.activeUsers'),   value: platformStats.activeUsers,   icon: Users,       color: 'text-emerald-400 bg-emerald-400/10' },
                    ].map(({ label, value, icon: Icon, color }) => (
                        <div key={label} className="rounded-2xl p-5 border"
                             style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
                                <Icon className="w-4 h-4" />
                            </div>
                            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* My Open Issues — shown for all roles when there are issues */}
            {myOpenIssues.length > 0 && (
                <div className="dash-section rounded-2xl border overflow-hidden"
                     style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                    <div className="p-5 flex items-center justify-between"
                         style={{ borderBottom: '1px solid var(--border-primary)' }}>
                        <h2 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            <AlertCircle className="w-4 h-4 text-red-400" />
                            {t('dashboard.openIssuesAssignedToMe')}
                            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">{myOpenIssues.length}</span>
                        </h2>
                        <button onClick={() => navigate('/projects')} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">{t('dashboard.viewProjects')}</button>
                    </div>
                    <div className="divide-y" style={{ borderColor: 'var(--border-primary)' }}>
                        {myOpenIssues.slice(0, 4).map(issue => (
                            <div key={issue.id} className="px-5 py-3.5 flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                    issue.severity === 'CRITICAL' ? 'bg-red-500' :
                                        issue.severity === 'HIGH' ? 'bg-orange-500' :
                                            issue.severity === 'MEDIUM' ? 'bg-amber-500' : 'bg-slate-500'
                                }`} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{issue.title}</p>
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                        {issue.severity} · {issue.status?.replace('_', ' ')}
                                    </p>
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                                    issue.status === 'OPEN' ? 'bg-red-400/10 text-red-400' :
                                        issue.status === 'IN_PROGRESS' ? 'bg-amber-400/10 text-amber-400' : 'bg-slate-400/10 text-slate-400'
                                }`}>{issue.status?.replace('_', ' ')}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Main content: Tasks + Notifications */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* My Tasks */}
                <div className="dash-section rounded-2xl border overflow-hidden"
                     style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                    <div className="p-5 flex items-center justify-between"
                         style={{ borderBottom: '1px solid var(--border-primary)' }}>
                        <h2 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            <CheckSquare className="w-4 h-4 text-blue-400" /> {t('dashboard.myTasks')}
                        </h2>
                        <button onClick={() => navigate('/projects')}
                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors">{t('dashboard.viewAll')}</button>
                    </div>
                    {myTasks.length === 0 ? (
                        <div className="p-8 text-center">
                            <CheckSquare className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('dashboard.noActiveTasks')}</p>
                        </div>
                    ) : (
                        <div className="divide-y" style={{ borderColor: 'var(--border-primary)' }}>
                            {myTasks.slice(0, 5).map(task => (
                                <div key={task.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-700/10 transition-all cursor-pointer"
                                     onClick={() => navigate('/projects')}>
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColor[task.status] || 'bg-slate-500'}`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{task.title}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {task.projectName && (
                                                <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border"
                                                      style={{
                                                          color: 'var(--text-muted)',
                                                          borderColor: 'var(--border-primary)',
                                                          background: 'var(--bg-elevated)',
                                                      }}>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                                    {task.projectName}
                                                </span>
                                            )}
                                            {task.dueDate && (
                                                <span className={`text-xs flex items-center gap-1 ${new Date(task.dueDate) < new Date() ? 'text-red-400' : ''}`}
                                                      style={{ color: new Date(task.dueDate) >= new Date() ? 'var(--text-muted)' : undefined }}>
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(task.dueDate).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <span className={`text-xs font-medium ${priorityColor[task.priority] || 'text-slate-400'}`}>
                                        {task.priority}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Upcoming Events */}
                <div className="dash-section rounded-2xl border overflow-hidden"
                     style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                    <div className="p-5 flex items-center justify-between"
                         style={{ borderBottom: '1px solid var(--border-primary)' }}>
                        <h2 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            <Calendar className="w-4 h-4 text-blue-400" /> {t('dashboard.upcomingEvents')}
                        </h2>
                        <button onClick={() => navigate('/calendar')} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">{t('dashboard.viewAll')}</button>
                    </div>
                    {upcomingEvents.length === 0 ? (
                        <div className="p-8 text-center">
                            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('dashboard.noUpcomingEvents')}</p>
                        </div>
                    ) : (
                        <div className="divide-y" style={{ borderColor: 'var(--border-primary)' }}>
                            {upcomingEvents.map(ev => {
                                const typeColor = { MEETING: 'bg-blue-500', CALL: 'bg-emerald-500', VIDEO_CALL: 'bg-purple-500', PROJECT: 'bg-orange-500', TASK: 'bg-rose-500' }
                                const typeIcon  = { MEETING: '📅', CALL: '📞', VIDEO_CALL: '🎥', PROJECT: '📁', TASK: '✅' }
                                return (
                                    <div key={ev.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-700/10 transition-all cursor-pointer"
                                         onClick={() => navigate('/calendar')}>
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm ${typeColor[ev.eventType] || 'bg-blue-500'}/20`}>
                                            {typeIcon[ev.eventType] || '📅'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{ev.title}</p>
                                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                {new Date(ev.startTime).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
                                                {' · '}
                                                {new Date(ev.startTime).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                        {ev.participantCount > 0 && (
                                            <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                                                {ev.participantCount} participant{ev.participantCount !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Projects */}
            {projects.length > 0 && (
                <div className="dash-section">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            <FolderOpen className="w-4 h-4 text-violet-400" /> {t('dashboard.recentProjects')}
                        </h2>
                        <button onClick={() => navigate('/projects')} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                            {t('dashboard.viewAll')}
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {projects.slice(0, 3).map(project => (
                            <div key={project.id}
                                 className="rounded-2xl p-5 border cursor-pointer transition-all hover:scale-[1.02]"
                                 style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}
                                 onClick={() => navigate('/projects')}>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center">
                                        <FolderOpen className="w-4 h-4 text-violet-400" />
                                    </div>
                                    <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{project.name}</p>
                                </div>
                                {project.description && (
                                    <p className="text-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{project.description}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

function getGreeting() {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
}
