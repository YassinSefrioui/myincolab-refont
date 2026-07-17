import { useEffect, useState, useRef, useCallback } from 'react'
import {
    Building2, Plus, X, Loader2, ShieldCheck, UserPlus, Power, PowerOff,
    RefreshCw, Pencil, Mail, Lock, BarChart3, Users, FolderOpen, CheckSquare,
    TrendingUp, Globe, Megaphone, Activity, Download, Search, AlertTriangle,
    Zap, Trophy, FileText, MessageSquare, Eye, Target, Database,
    Calendar, ChevronRight, Flame, Bell, Wifi, WifiOff, HardDrive,
    LogOut, Key, Filter, ChevronDown, TriangleAlert, Info, CheckCircle2,
    LayoutGrid, List, ArrowUpRight, Clock, Send, BarChart2
} from 'lucide-react'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { getAvatarUrl } from '../utils/avatarUrl'

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_COLOR = {
    SUPER_ADMIN: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
    ADMIN:       'text-red-400 bg-red-400/10 border-red-400/20',
    MANAGER:     'text-amber-400 bg-amber-400/10 border-amber-400/20',
    EMPLOYEE:    'text-blue-400 bg-blue-400/10 border-blue-400/20',
    GUEST:       'text-slate-400 bg-slate-400/10 border-slate-400/20',
}
const TASK_STATUS_COLOR = {
    TODO:        { bar: '#64748b', label: 'To Do' },
    IN_PROGRESS: { bar: '#3b82f6', label: 'In Progress' },
    IN_REVIEW:   { bar: '#a78bfa', label: 'In Review' },
    DONE:        { bar: '#10b981', label: 'Done' },
    REJECTED:    { bar: '#ef4444', label: 'Rejected' },
    BLOCKED:     { bar: '#f97316', label: 'Blocked' },
}
const SEVERITY_CFG = {
    CRITICAL: { icon: Flame,         color: 'text-red-400',    bg: 'bg-red-400/8 border-red-500/25',    label: 'Critical' },
    WARNING:  { icon: AlertTriangle, color: 'text-amber-400',  bg: 'bg-amber-400/8 border-amber-500/25', label: 'Warning'  },
    INFO:     { icon: Info,          color: 'text-blue-400',   bg: 'bg-blue-400/8 border-blue-500/25',   label: 'Info'     },
}

const fmt     = n => n >= 1_000_000 ? (n/1_000_000).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(1)+'k' : String(n||0)
const fmtBytes= b => b >= 1e9 ? (b/1e9).toFixed(2)+' GB' : b >= 1e6 ? (b/1e6).toFixed(1)+' MB' : b >= 1e3 ? (b/1e3).toFixed(0)+' KB' : b+' B'
const fmtDate = dt => new Date(dt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
const fmtAgo  = dt => {
    const s = Math.floor((Date.now() - new Date(dt)) / 1000)
    if (s < 60) return `${s}s ago`
    if (s < 3600) return `${Math.floor(s/60)}m ago`
    if (s < 86400) return `${Math.floor(s/3600)}h ago`
    return `${Math.floor(s/86400)}d ago`
}
const inputCls = `w-full rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all
    bg-slate-900/80 border border-slate-700/60 text-white placeholder:text-slate-500`

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SuperAdminPage() {
    const [activeTab, setActiveTab] = useState('dashboard')
    const [companies, setCompanies] = useState([])
    const [stats, setStats]         = useState(null)
    const [loading, setLoading]     = useState(true)
    const [showCreate, setShowCreate]           = useState(false)
    const [selectedCompany, setSelectedCompany] = useState(null)
    const [detailCompany, setDetailCompany]     = useState(null)
    const [form, setForm] = useState({ name: '', slug: '', logoUrl: '' })
    const [creating, setCreating] = useState(false)

    const TABS = [
        { key: 'dashboard',  label: 'Dashboard',   icon: BarChart3    },
        { key: 'companies',  label: 'Companies',   icon: Building2    },
        { key: 'projects',   label: 'Projects',    icon: FolderOpen   },
        { key: 'users',      label: 'Users',       icon: Users        },
        { key: 'sessions',   label: 'Live',        icon: Wifi         },
        { key: 'storage',    label: 'Storage',     icon: HardDrive    },
        { key: 'alerts',     label: 'Alerts',      icon: Bell         },
        { key: 'audit',      label: 'Audit',       icon: Activity     },
        { key: 'timeline',   label: 'Timeline',    icon: BarChart2    },
        { key: 'broadcast',  label: 'Broadcast',   icon: Megaphone    },
    ]

    const fetchAll = async () => {
        setLoading(true)
        try {
            const [compRes, statsRes] = await Promise.allSettled([
                api.get('/superadmin/companies'),
                api.get('/superadmin/stats'),
            ])
            if (compRes.status  === 'fulfilled') setCompanies(compRes.value.data.data || [])
            if (statsRes.status === 'fulfilled') setStats(statsRes.value.data.data || null)
        } catch { toast.error('Failed to load') }
        finally { setLoading(false) }
    }
    useEffect(() => { fetchAll() }, [])

    const handleCreate = async e => {
        e.preventDefault(); setCreating(true)
        try {
            await api.post('/superadmin/companies', form)
            toast.success(`Company "${form.name}" created!`)
            setShowCreate(false); setForm({ name: '', slug: '', logoUrl: '' }); fetchAll()
        } catch (err) { toast.error(err.response?.data?.message || 'Failed') }
        finally { setCreating(false) }
    }

    const handleToggle = async company => {
        const action = company.isActive ? 'deactivate' : 'activate'
        try { await api.patch(`/superadmin/companies/${company.id}/${action}`); toast.success(`${action}d`); fetchAll() }
        catch (err) { toast.error(err.response?.data?.message || 'Failed') }
    }

    const handleNameChange = name => {
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        setForm({ ...form, name, slug })
    }

    const handleExport = async (type) => {
        try {
            const token = JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.token
            const res   = await fetch(`/api/superadmin/export/${type}`, { headers: { Authorization: `Bearer ${token}` } })
            const blob  = await res.blob()
            const url   = URL.createObjectURL(blob)
            const a     = document.createElement('a')
            a.href = url; a.download = `${type}_export.csv`
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
            toast.success(`${type} exported!`)
        } catch { toast.error('Export failed') }
    }

    if (loading) return (
        <div className="flex items-center justify-center h-full">
            <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <ShieldCheck className="w-8 h-8 text-violet-400" />
                </div>
                <p className="text-slate-400 text-sm">Loading platform data...</p>
            </div>
        </div>
    )

    return (
        <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

            {/* Header */}
            <div className="px-6 pt-5 pb-0 flex-shrink-0">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-600/30">
                            <ShieldCheck className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-white flex items-center gap-2">
                                Super Admin
                                <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/20">PLATFORM</span>
                            </h1>
                            <p className="text-xs text-slate-400">{companies.length} companies · {stats?.totalUsers||0} users · {stats?.totalProjects||0} projects</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Export menu */}
                        <div className="flex items-center gap-1">
                            {['users','projects','companies'].map(t => (
                                <button key={t} onClick={() => handleExport(t)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700/50 text-xs text-slate-400 hover:text-white hover:border-slate-600 transition-all">
                                    <Download className="w-3 h-3" /> {t}
                                </button>
                            ))}
                        </div>
                        <button onClick={fetchAll} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all">
                            <RefreshCw className="w-4 h-4" />
                        </button>
                        {activeTab === 'companies' && (
                            <button onClick={() => setShowCreate(true)}
                                    className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-violet-600/20">
                                <Plus className="w-4 h-4" /> New Company
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabs — scrollable */}
                <div className="flex gap-0.5 overflow-x-auto pb-0 scrollbar-none">
                    {TABS.map(({ key, label, icon: Icon }) => (
                        <button key={key} onClick={() => setActiveTab(key)}
                                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold whitespace-nowrap rounded-t-xl transition-all border-b-2 flex-shrink-0 ${
                                    activeTab === key
                                        ? 'text-violet-300 border-violet-500 bg-violet-500/8'
                                        : 'text-slate-400 border-transparent hover:text-slate-200'
                                }`}>
                            <Icon className="w-3.5 h-3.5" />{label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                {/* ═══ DASHBOARD ═══ */}
                {activeTab === 'dashboard' && stats && <DashboardTab stats={stats} onDrillDown={setDetailCompany} />}

                {/* ═══ COMPANIES ═══ */}
                {activeTab === 'companies' && (
                    <CompaniesTab companies={companies} stats={stats}
                                  onToggle={handleToggle}
                                  onCreateAdmin={setSelectedCompany}
                                  onDetail={setDetailCompany} />
                )}

                {/* ═══ PROJECTS ═══ */}
                {activeTab === 'projects' && <ProjectsTab companies={companies} />}

                {/* ═══ USERS ═══ */}
                {activeTab === 'users' && <SuperAdminUsersPanel />}

                {/* ═══ LIVE SESSIONS ═══ */}
                {activeTab === 'sessions' && <LiveSessionsTab />}

                {/* ═══ STORAGE ═══ */}
                {activeTab === 'storage' && <StorageTab />}

                {/* ═══ ALERTS ═══ */}
                {activeTab === 'alerts' && <AlertsTab />}

                {/* ═══ AUDIT LOG ═══ */}
                {activeTab === 'audit' && <AuditTab companies={companies} />}

                {/* ═══ TIMELINE ═══ */}
                {activeTab === 'timeline' && <TimelineTab />}

                {/* ═══ BROADCAST ═══ */}
                {activeTab === 'broadcast' && <BroadcastTab companies={companies} />}
            </div>

            {/* Modals */}
            {detailCompany && <CompanyDetailModal company={detailCompany} onClose={() => setDetailCompany(null)} />}
            {selectedCompany && <CreateAdminModal company={selectedCompany} onClose={() => setSelectedCompany(null)} onSuccess={fetchAll} />}

            {showCreate && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="rounded-2xl w-full max-w-md shadow-2xl border border-slate-700/60 bg-slate-900">
                        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
                            <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Building2 className="w-4 h-4 text-violet-400" /> New Company</h2>
                            <button onClick={() => { setShowCreate(false); setForm({ name:'',slug:'',logoUrl:'' }) }} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Company Name *</label>
                                <input type="text" required value={form.name} onChange={e => handleNameChange(e.target.value)} placeholder="Acme Corp" className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Slug</label>
                                <input type="text" required value={form.slug} onChange={e => setForm({...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'')})} className={`${inputCls} font-mono`} />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm hover:text-white">Cancel</button>
                                <button type="submit" disabled={creating||!form.name||!form.slug} className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium text-sm flex items-center justify-center gap-2">
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

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

function DashboardTab({ stats, onDrillDown }) {
    return (
        <div className="space-y-5">
            {/* KPI */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: 'Companies',  value: stats.totalCompanies,  sub: `${stats.activeCompanies} active`,                icon: Building2,   glyph: '🏢' },
                    { label: 'Users',      value: stats.totalUsers,      sub: `+${stats.newUsersLast30Days||0} this month`,    icon: Users,       glyph: '👥' },
                    { label: 'Projects',   value: stats.totalProjects,   sub: `${stats.projectsByStatus?.ACTIVE||0} active`,   icon: FolderOpen,  glyph: '📁' },
                    { label: 'Tasks',      value: stats.totalTasks,      sub: `${stats.overdueTasks||0} overdue`,              icon: CheckSquare, glyph: '✅' },
                ].map(({ label, value, sub, glyph }) => (
                    <div key={label} className="rounded-2xl p-5 border border-slate-700/40 bg-slate-800/30">
                        <div className="flex items-start justify-between mb-2">
                            <p className="text-3xl font-black text-white tabular-nums">{fmt(value||0)}</p>
                            <span className="text-2xl opacity-50">{glyph}</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-300">{label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
                    </div>
                ))}
            </div>

            {/* Secondary row */}
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                    { label: 'Files',    value: stats.totalFiles||0,        icon: FileText,     color: 'text-cyan-400'    },
                    { label: 'Messages', value: stats.totalMessages||0,     icon: MessageSquare,color: 'text-blue-400'    },
                    { label: 'Issues',   value: stats.totalIssues||0,       icon: AlertTriangle,color: 'text-orange-400'  },
                    { label: 'Groups',   value: stats.totalGroups||0,       icon: Users,        color: 'text-pink-400'    },
                    { label: 'Guests',   value: stats.guestUsers||0,        icon: Eye,          color: 'text-slate-400'   },
                    { label: 'Done/30d', value: stats.tasksCompletedLast30Days||0, icon: Trophy, color: 'text-emerald-400' },
                ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="rounded-xl p-3 border border-slate-700/40 bg-slate-800/30 flex items-center gap-3">
                        <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} />
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-white">{fmt(value)}</p>
                            <p className="text-xs text-slate-500 truncate">{label}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Task status */}
                <div className="rounded-2xl p-5 border border-slate-700/40 bg-slate-800/30">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Target className="w-4 h-4 text-amber-400" /> Task Status</h3>
                    <div className="space-y-2.5">
                        {stats.tasksByStatus && Object.entries(stats.tasksByStatus)
                            .filter(([,v]) => v > 0).sort(([,a],[,b]) => b-a)
                            .map(([status, count]) => {
                                const pct = Math.round((count/(stats.totalTasks||1))*100)
                                const cfg = TASK_STATUS_COLOR[status] || { bar:'#64748b', label: status }
                                return (
                                    <div key={status}>
                                        <div className="flex justify-between mb-1">
                                            <span className="text-xs text-slate-400">{cfg.label}</span>
                                            <span className="text-xs font-bold text-white">{count} <span className="text-slate-500">({pct}%)</span></span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                                            <div className="h-full rounded-full" style={{ width:`${pct}%`, background: cfg.bar }} />
                                        </div>
                                    </div>
                                )
                            })}
                    </div>
                </div>

                {/* User roles donut */}
                <div className="rounded-2xl p-5 border border-slate-700/40 bg-slate-800/30">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-violet-400" /> User Roles</h3>
                    <div className="flex items-center gap-4">
                        <DonutChart data={Object.entries(stats.usersByRole||{}).filter(([,v])=>v>0).map(([role,value]) => ({
                            label: role, value,
                            color: {SUPER_ADMIN:'#a78bfa',ADMIN:'#f87171',MANAGER:'#fbbf24',EMPLOYEE:'#60a5fa',GUEST:'#94a3b8'}[role]||'#64748b'
                        }))} total={stats.totalUsers} label="users" />
                        <div className="space-y-2 flex-1">
                            {Object.entries(stats.usersByRole||{}).filter(([,v])=>v>0).sort(([,a],[,b])=>b-a).map(([role,count]) => (
                                <div key={role} className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full" style={{ background: {SUPER_ADMIN:'#a78bfa',ADMIN:'#f87171',MANAGER:'#fbbf24',EMPLOYEE:'#60a5fa',GUEST:'#94a3b8'}[role] }} />
                                        <span className="text-xs text-slate-400">{role.replace('_',' ')}</span>
                                    </div>
                                    <span className="text-xs font-bold text-white">{count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Top performers */}
                <div className="rounded-2xl p-5 border border-slate-700/40 bg-slate-800/30">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-400" /> Top Performers</h3>
                    {!(stats.topPerformers||[]).length ? (
                        <p className="text-xs text-slate-500 text-center py-4">No data yet</p>
                    ) : (stats.topPerformers||[]).map((p,i) => (
                        <div key={p.userId} className="flex items-center gap-3 mb-3">
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 ${i===0?'bg-amber-500/20 text-amber-400':i===1?'bg-slate-400/20 text-slate-300':'bg-orange-800/20 text-orange-600'}`}>{i+1}</div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-white truncate">{p.fullName}</p>
                                <p className="text-xs text-slate-500 truncate">{p.company||'—'}</p>
                            </div>
                            <span className="text-xs font-bold text-emerald-400">{p.tasksDone}✓</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Company health table */}
            <CompanyHealthTable companies={stats.companyBreakdown||[]} onDrillDown={onDrillDown} />
        </div>
    )
}

// ─── Company Health Table ─────────────────────────────────────────────────────

function CompanyHealthTable({ companies, onDrillDown }) {
    return (
        <div className="rounded-2xl border border-slate-700/40 overflow-hidden bg-slate-800/20">
            <div className="px-5 py-4 flex items-center justify-between border-b border-slate-700/40">
                <h3 className="text-sm font-bold text-white flex items-center gap-2"><Building2 className="w-4 h-4 text-violet-400" /> Company Health</h3>
                <span className="text-xs text-slate-500">Click a row for details</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead><tr className="border-b border-slate-700/30">
                        {['#','Company','Status','Users','Projects','Tasks','Done %','Overdue','Score'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                        ))}
                    </tr></thead>
                    <tbody>
                    {companies.map((c,i) => {
                        const doneRate = c.tasksDoneRate||0
                        const health   = doneRate>=70?'great':doneRate>=40?'ok':c.tasks>0?'poor':'new'
                        const hcfg     = {great:{label:'Healthy',color:'text-emerald-400 bg-emerald-400/10'},ok:{label:'Moderate',color:'text-amber-400 bg-amber-400/10'},poor:{label:'At risk',color:'text-red-400 bg-red-400/10'},new:{label:'New',color:'text-blue-400 bg-blue-400/10'}}[health]
                        return (
                            <tr key={c.id} className="border-b border-slate-700/20 hover:bg-slate-700/10 transition-colors cursor-pointer" onClick={() => onDrillDown(c)}>
                                <td className="px-4 py-3 text-xs text-slate-500 font-mono">{i+1}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-violet-600/20 flex items-center justify-center flex-shrink-0"><Building2 className="w-3.5 h-3.5 text-violet-400" /></div>
                                        <div><p className="text-sm font-semibold text-white">{c.name}</p><p className="text-xs text-slate-500">/{c.slug}</p></div>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    {c.isActive ? <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">Active</span>
                                        : <span className="text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">Inactive</span>}
                                </td>
                                <td className="px-4 py-3 text-sm font-bold text-white">{c.users}</td>
                                <td className="px-4 py-3"><span className="text-sm text-white">{c.projects}</span><span className="text-xs text-slate-500 ml-1">({c.activeProjects} active)</span></td>
                                <td className="px-4 py-3 text-sm text-white">{c.tasks}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-16 h-1.5 rounded-full bg-slate-700/50 overflow-hidden"><div className="h-full rounded-full bg-emerald-500" style={{ width:`${doneRate}%` }} /></div>
                                        <span className="text-xs font-bold text-white">{doneRate}%</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">{c.tasksOverdue>0?<span className="text-xs font-bold text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{c.tasksOverdue}</span>:<span className="text-xs text-slate-500">—</span>}</td>
                                <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${hcfg.color}`}>{hcfg.label}</span></td>
                            </tr>
                        )
                    })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// ─── Companies Tab ────────────────────────────────────────────────────────────

function CompaniesTab({ companies, stats, onToggle, onCreateAdmin, onDetail }) {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label:'Total',    value: companies.length,                         color:'text-violet-400 bg-violet-600/10' },
                    { label:'Active',   value: companies.filter(c=>c.isActive).length,   color:'text-emerald-400 bg-emerald-600/10' },
                    { label:'Inactive', value: companies.filter(c=>!c.isActive).length,  color:'text-red-400 bg-red-600/10' },
                ].map(({label,value,color}) => (
                    <div key={label} className={`rounded-xl p-4 border border-slate-700/40 ${color} flex items-center gap-3`}>
                        <div><p className="text-2xl font-black">{value}</p><p className="text-xs text-slate-400">{label}</p></div>
                    </div>
                ))}
            </div>
            <div className="rounded-2xl border border-slate-700/40 overflow-hidden bg-slate-800/20">
                {companies.map(c => (
                    <div key={c.id} className="flex items-center gap-4 px-5 py-4 border-b border-slate-700/20 hover:bg-slate-700/10 transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center flex-shrink-0"><Building2 className="w-5 h-5 text-violet-400" /></div>
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onDetail(stats?.companyBreakdown?.find(x=>x.id===c.id)||c)}>
                            <p className="text-sm font-semibold text-white">{c.name}</p>
                            <p className="text-xs text-slate-500">/{c.slug} · ID: {c.id}</p>
                        </div>
                        {c.isActive
                            ? <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Active</span>
                            : <span className="text-xs text-red-400 bg-red-400/10 px-2.5 py-1 rounded-full">Inactive</span>}
                        <span className="text-xs text-slate-500">{c.createdAt ? new Date(c.createdAt).toLocaleDateString('en',{day:'numeric',month:'short',year:'numeric'}) : '—'}</span>
                        <div className="flex items-center gap-1">
                            <button onClick={()=>onCreateAdmin(c)} className="p-1.5 rounded-lg text-slate-400 hover:text-violet-400 hover:bg-violet-400/10 transition-all" title="Create Admin"><UserPlus className="w-4 h-4" /></button>
                            <button onClick={()=>onToggle(c)} className={`p-1.5 rounded-lg transition-all ${c.isActive?'text-slate-400 hover:text-red-400 hover:bg-red-400/10':'text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10'}`}>
                                {c.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ─── Projects Tab ─────────────────────────────────────────────────────────────

function ProjectsTab({ companies }) {
    const [projects, setProjects] = useState([])
    const [loading,  setLoading]  = useState(true)
    const [search,   setSearch]   = useState('')
    const [filterCompany, setFilterCompany] = useState('')
    const [filterStatus,  setFilterStatus]  = useState('')

    useEffect(() => {
        setLoading(true)
        const params = new URLSearchParams()
        if (filterCompany) params.set('companyId', filterCompany)
        if (filterStatus)  params.set('status', filterStatus)
        api.get(`/superadmin/projects?${params}`)
            .then(r => setProjects(r.data.data || []))
            .catch(() => toast.error('Failed to load projects'))
            .finally(() => setLoading(false))
    }, [filterCompany, filterStatus])

    const filtered = projects.filter(p =>
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.company?.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search projects..." className={`${inputCls} pl-9`} />
                </div>
                <select value={filterCompany} onChange={e=>setFilterCompany(e.target.value)} className="rounded-xl py-2.5 px-3 text-sm bg-slate-900/80 border border-slate-700/60 text-white">
                    <option value="">All companies</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="rounded-xl py-2.5 px-3 text-sm bg-slate-900/80 border border-slate-700/60 text-white">
                    <option value="">All statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="ARCHIVED">Archived</option>
                </select>
                <span className="text-xs text-slate-500 ml-auto">{filtered.length} projects</span>
            </div>

            {loading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin w-6 h-6 text-violet-500" /></div> : (
                <div className="rounded-2xl border border-slate-700/40 overflow-hidden bg-slate-800/20">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-slate-700/30">
                            {['Project','Company','Status','Creator','Members','Tasks','Start','End'].map(h => (
                                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                            ))}
                        </tr></thead>
                        <tbody>
                        {filtered.map(p => (
                            <tr key={p.id} className="border-b border-slate-700/20 hover:bg-slate-700/10 transition-colors">
                                <td className="px-4 py-3">
                                    <p className="text-sm font-semibold text-white">{p.name}</p>
                                    <p className="text-xs text-slate-500">#{p.id}</p>
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-400">{p.company||'—'}</td>
                                <td className="px-4 py-3">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.status==='ACTIVE'?'text-emerald-400 bg-emerald-400/10':'text-slate-400 bg-slate-400/10'}`}>{p.status}</span>
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-400">{p.createdBy||'—'}</td>
                                <td className="px-4 py-3 text-xs text-white">{p.memberCount}</td>
                                <td className="px-4 py-3 text-xs text-white">{p.taskCount}</td>
                                <td className="px-4 py-3 text-xs text-slate-400">{p.startDate||'—'}</td>
                                <td className="px-4 py-3 text-xs text-slate-400">{p.endDate||'—'}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                    {filtered.length === 0 && <p className="text-center py-10 text-sm text-slate-500">No projects found</p>}
                </div>
            )}
        </div>
    )
}

// ─── Live Sessions Tab ────────────────────────────────────────────────────────

function LiveSessionsTab() {
    const [sessions, setSessions] = useState([])
    const [loading,  setLoading]  = useState(true)

    const fetch = useCallback(async () => {
        try { const r = await api.get('/superadmin/sessions/live'); setSessions(r.data.data||[]) }
        catch { toast.error('Failed') } finally { setLoading(false) }
    }, [])

    useEffect(() => { fetch(); const id = setInterval(fetch, 30000); return () => clearInterval(id) }, [fetch])

    const handleForceLogout = async (userId, name) => {
        if (!confirm(`Force logout ${name}?`)) return
        try { await api.post(`/superadmin/users/${userId}/force-logout`); toast.success('Logged out'); fetch() }
        catch { toast.error('Failed') }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-emerald-400" /> Live Sessions
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </h3>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{sessions.length} active · refreshes every 30s</span>
                    <button onClick={fetch} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all"><RefreshCw className="w-3.5 h-3.5" /></button>
                </div>
            </div>

            {loading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin w-6 h-6 text-emerald-500" /></div> : sessions.length === 0 ? (
                <div className="text-center py-16 rounded-2xl border border-slate-700/40 bg-slate-800/20">
                    <WifiOff className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">No active sessions in the last 30 minutes</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {sessions.map(s => (
                        <div key={s.sessionId} className="flex items-center gap-4 p-4 rounded-xl border border-emerald-500/15 bg-emerald-400/5">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                {s.fullName?.charAt(0)?.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold text-white">{s.fullName}</p>
                                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ROLE_COLOR[s.role]||ROLE_COLOR.GUEST}`}>{s.role}</span>
                                </div>
                                <p className="text-xs text-slate-400">{s.email} · {s.company||'No company'}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <p className="text-xs text-emerald-400 font-medium">{fmtAgo(s.lastActive)}</p>
                                <p className="text-xs text-slate-500">{s.ipAddress||'—'}</p>
                            </div>
                            <button onClick={() => handleForceLogout(s.userId, s.fullName)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all flex-shrink-0" title="Force logout">
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── Storage Tab ──────────────────────────────────────────────────────────────

function StorageTab() {
    const [data,    setData]    = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        api.get('/superadmin/storage')
            .then(r => setData(r.data.data))
            .catch(() => toast.error('Failed'))
            .finally(() => setLoading(false))
    }, [])

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin w-6 h-6 text-violet-500" /></div>
    if (!data) return null

    const maxBytes = Math.max(...(data.byCompany||[]).map(c => c.bytes), 1)

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl p-5 border border-slate-700/40 bg-slate-800/30">
                    <p className="text-xs text-slate-400 mb-1">Total Storage Used</p>
                    <p className="text-3xl font-black text-white">{fmtBytes(data.totalBytes||0)}</p>
                </div>
                <div className="rounded-2xl p-5 border border-slate-700/40 bg-slate-800/30">
                    <p className="text-xs text-slate-400 mb-1">Total Files</p>
                    <p className="text-3xl font-black text-white">{fmt(data.totalFiles||0)}</p>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-700/40 overflow-hidden bg-slate-800/20">
                <div className="px-5 py-4 border-b border-slate-700/40">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2"><HardDrive className="w-4 h-4 text-cyan-400" /> Storage by Company</h3>
                </div>
                <div className="divide-y divide-slate-700/20">
                    {(data.byCompany||[]).map(c => (
                        <div key={c.companyId} className="px-5 py-4">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <p className="text-sm font-semibold text-white">{c.companyName}</p>
                                    <p className="text-xs text-slate-500">{c.files} files</p>
                                </div>
                                <p className="text-sm font-bold text-cyan-400">{fmtBytes(c.bytes)}</p>
                            </div>
                            <div className="h-2 rounded-full bg-slate-700/50 overflow-hidden mb-2">
                                <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" style={{ width:`${Math.round((c.bytes/maxBytes)*100)}%` }} />
                            </div>
                            {c.byType && (
                                <div className="flex items-center gap-3 flex-wrap">
                                    {Object.entries(c.byType).map(([type, count]) => (
                                        <span key={type} className="text-xs text-slate-500">{type}: {count}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

// ─── Alerts Tab ───────────────────────────────────────────────────────────────

function AlertsTab() {
    const [alerts,  setAlerts]  = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        api.get('/superadmin/alerts')
            .then(r => setAlerts(r.data.data||[]))
            .catch(() => toast.error('Failed'))
            .finally(() => setLoading(false))
    }, [])

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin w-6 h-6 text-amber-500" /></div>

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2"><Bell className="w-4 h-4 text-amber-400" /> Platform Alerts</h3>
                <span className="text-xs text-slate-500">{alerts.length} alerts</span>
            </div>

            {alerts.length === 0 ? (
                <div className="text-center py-16 rounded-2xl border border-slate-700/40 bg-slate-800/20">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                    <p className="text-emerald-400 font-semibold">All clear!</p>
                    <p className="text-slate-500 text-sm mt-1">No alerts at this time</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {alerts.map((alert, i) => {
                        const cfg = SEVERITY_CFG[alert.severity] || SEVERITY_CFG.INFO
                        const Icon = cfg.icon
                        return (
                            <div key={i} className={`flex items-start gap-4 p-4 rounded-xl border ${cfg.bg}`}>
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>{alert.severity}</span>
                                        <span className="text-xs text-slate-500 font-mono">{alert.type}</span>
                                    </div>
                                    <p className="text-sm text-white">{alert.message}</p>
                                    {alert.company && <p className="text-xs text-slate-400 mt-0.5">🏢 {alert.company}</p>}
                                </div>
                                {alert.count && <span className={`text-lg font-black ${cfg.color} flex-shrink-0`}>{alert.count}</span>}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// ─── Audit Log Tab ────────────────────────────────────────────────────────────

function AuditTab({ companies }) {
    const [logs,     setLogs]     = useState([])
    const [loading,  setLoading]  = useState(true)
    const [action,   setAction]   = useState('')
    const [companyId, setCompanyId]= useState('')
    const [days,     setDays]     = useState(7)
    const [limit,    setLimit]    = useState(50)

    const fetchLogs = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({ days, limit })
            if (action)    params.set('action', action)
            if (companyId) params.set('companyId', companyId)
            const r = await api.get(`/superadmin/audit?${params}`)
            setLogs(r.data.data||[])
        } catch { toast.error('Failed') }
        finally { setLoading(false) }
    }, [action, companyId, days, limit])

    useEffect(() => { fetchLogs() }, [fetchLogs])

    const ACTION_TYPES = ['FILE_UPLOADED','PROJECT_CREATED','PROJECT_DELETED','PROJECT_ARCHIVED','FILE_DELETED','USER_CREATED']

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 max-w-xs">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input value={action} onChange={e=>setAction(e.target.value)} placeholder="Filter by action..." className={`${inputCls} pl-9`} />
                </div>
                <select value={companyId} onChange={e=>setCompanyId(e.target.value)} className="rounded-xl py-2.5 px-3 text-sm bg-slate-900/80 border border-slate-700/60 text-white">
                    <option value="">All companies</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={days} onChange={e=>setDays(Number(e.target.value))} className="rounded-xl py-2.5 px-3 text-sm bg-slate-900/80 border border-slate-700/60 text-white">
                    {[1,3,7,14,30].map(d => <option key={d} value={d}>Last {d} day{d>1?'s':''}</option>)}
                </select>
                <select value={limit} onChange={e=>setLimit(Number(e.target.value))} className="rounded-xl py-2.5 px-3 text-sm bg-slate-900/80 border border-slate-700/60 text-white">
                    {[25,50,100,200].map(l => <option key={l} value={l}>{l} entries</option>)}
                </select>
                <span className="text-xs text-slate-500 ml-auto">{logs.length} entries</span>
            </div>

            {/* Quick action filters */}
            <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setAction('')} className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${!action?'bg-violet-600 text-white border-violet-600':'text-slate-400 border-slate-700/40 hover:text-white'}`}>All</button>
                {ACTION_TYPES.map(a => (
                    <button key={a} onClick={() => setAction(action===a?'':a)} className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${action===a?'bg-violet-600 text-white border-violet-600':'text-slate-400 border-slate-700/40 hover:text-white'}`}>
                        {a.replace(/_/g,' ')}
                    </button>
                ))}
            </div>

            {loading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin w-6 h-6 text-violet-500" /></div> : (
                <div className="space-y-1.5">
                    {logs.length === 0 ? <p className="text-center py-10 text-sm text-slate-500">No logs found</p>
                        : logs.map(l => (
                            <div key={l.id} className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-700/30 bg-slate-800/20 hover:bg-slate-800/40 transition-colors">
                                <Zap className="w-3.5 h-3.5 text-violet-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                        <span className="text-xs font-bold text-violet-300 bg-violet-500/10 px-1.5 py-0.5 rounded font-mono">{l.action}</span>
                                        {l.entityType && <span className="text-xs text-slate-500">{l.entityType} #{l.entityId}</span>}
                                    </div>
                                    <p className="text-xs text-slate-300 truncate">{l.details||'—'}</p>
                                    <div className="flex items-center gap-3 mt-1">
                                        {l.userName && <span className="text-xs text-blue-400">👤 {l.userName}</span>}
                                        {l.userCompany && <span className="text-xs text-slate-500">🏢 {l.userCompany}</span>}
                                    </div>
                                </div>
                                <span className="text-xs text-slate-600 flex-shrink-0">{l.createdAt ? fmtDate(l.createdAt) : '—'}</span>
                            </div>
                        ))}
                </div>
            )}
        </div>
    )
}

// ─── Timeline Tab ─────────────────────────────────────────────────────────────

function TimelineTab() {
    const [data,    setData]    = useState(null)
    const [loading, setLoading] = useState(true)
    const [days,    setDays]    = useState(30)

    useEffect(() => {
        setLoading(true)
        api.get(`/superadmin/timeline?days=${days}`)
            .then(r => setData(r.data.data))
            .catch(() => toast.error('Failed'))
            .finally(() => setLoading(false))
    }, [days])

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin w-6 h-6 text-violet-500" /></div>
    if (!data) return null

    const series = [
        { key: 'users',    label: 'New Users',    color: '#3b82f6' },
        { key: 'projects', label: 'New Projects', color: '#10b981' },
        { key: 'tasks',    label: 'New Tasks',    color: '#f59e0b' },
        { key: 'tasksDone',label: 'Tasks Done',   color: '#a78bfa' },
    ]

    const maxVal = Math.max(...series.flatMap(s => data[s.key]||[]), 1)
    const chartH = 140

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2"><BarChart2 className="w-4 h-4 text-violet-400" /> Activity Timeline</h3>
                <div className="flex gap-1">
                    {[7,14,30,60].map(d => (
                        <button key={d} onClick={() => setDays(d)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${days===d?'bg-violet-600 text-white':'text-slate-400 hover:text-white bg-slate-800/50'}`}>{d}d</button>
                    ))}
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 flex-wrap">
                {series.map(s => (
                    <div key={s.key} className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm" style={{ background: s.color }} />
                        <span className="text-xs text-slate-400">{s.label}</span>
                    </div>
                ))}
            </div>

            {/* SVG Chart */}
            <div className="rounded-2xl border border-slate-700/40 bg-slate-800/20 p-5 overflow-x-auto">
                <svg width="100%" height={chartH + 40} viewBox={`0 0 ${Math.max((data.days||[]).length * 20, 400)} ${chartH + 40}`} preserveAspectRatio="none">
                    {/* Grid lines */}
                    {[0,0.25,0.5,0.75,1].map(pct => (
                        <line key={pct} x1="0" y1={chartH * (1 - pct)} x2="100%" y2={chartH * (1 - pct)}
                              stroke="rgba(51,65,85,0.5)" strokeWidth="1" />
                    ))}
                    {/* Series */}
                    {series.map(s => {
                        const vals = data[s.key] || []
                        if (vals.length < 2) return null
                        const w = 100 / (vals.length - 1)
                        const pts = vals.map((v, i) => `${i * w},${chartH - (v / maxVal) * chartH}`).join(' ')
                        return (
                            <g key={s.key}>
                                <polyline points={pts} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                                {vals.map((v, i) => v > 0 && (
                                    <circle key={i} cx={`${i * w}%`} cy={chartH - (v / maxVal) * chartH} r="3" fill={s.color} />
                                ))}
                            </g>
                        )
                    })}
                </svg>

                {/* X-axis labels */}
                <div className="flex justify-between mt-2">
                    {(data.days||[]).filter((_,i,arr) => i===0 || i===arr.length-1 || i%(Math.ceil(arr.length/5))===0).map(d => (
                        <span key={d} className="text-xs text-slate-600">{d.slice(5)}</span>
                    ))}
                </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-4 gap-3">
                {series.map(s => {
                    const vals   = data[s.key]||[]
                    const total  = vals.reduce((a,b)=>a+b,0)
                    const recent = vals.slice(-7).reduce((a,b)=>a+b,0)
                    return (
                        <div key={s.key} className="rounded-xl p-4 border border-slate-700/40 bg-slate-800/30">
                            <div className="w-3 h-3 rounded-sm mb-2" style={{ background: s.color }} />
                            <p className="text-xl font-black text-white">{total}</p>
                            <p className="text-xs text-slate-400">{s.label}</p>
                            <p className="text-xs text-slate-500 mt-0.5">+{recent} last 7d</p>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ─── Broadcast Tab ────────────────────────────────────────────────────────────

function BroadcastTab({ companies }) {
    const [tab,      setTab]      = useState('global') // 'global' | 'targeted'
    const [form,     setForm]     = useState({ title:'', content:'', companyId:'' })
    const [posting,  setPosting]  = useState(false)
    const [announcements, setAnnouncements] = useState([])
    const [loadingAnn, setLoadingAnn] = useState(true)

    const fetchAnn = async () => {
        setLoadingAnn(true)
        try { const r = await api.get('/announcements'); setAnnouncements(r.data.data||[]) }
        catch {} finally { setLoadingAnn(false) }
    }
    useEffect(() => { fetchAnn() }, [])

    const handlePost = async e => {
        e.preventDefault(); setPosting(true)
        try {
            if (tab === 'global') {
                const fd = new FormData()
                fd.append('title', form.title); fd.append('content', form.content)
                await api.post('/announcements/global', fd, { headers:{ 'Content-Type':'multipart/form-data' } })
                toast.success('Broadcast to all companies!')
            } else {
                await api.post(`/superadmin/companies/${form.companyId}/announce`, { title: form.title, content: form.content })
                toast.success('Sent to company!')
            }
            setForm({ title:'', content:'', companyId:'' }); fetchAnn()
        } catch (err) { toast.error(err.response?.data?.message || 'Failed') }
        finally { setPosting(false) }
    }

    const handleDelete = async id => {
        if (!confirm('Delete?')) return
        try { await api.delete(`/announcements/${id}`); toast.success('Deleted'); fetchAnn() }
        catch { toast.error('Failed') }
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Compose */}
            <div className="rounded-2xl border border-slate-700/40 bg-slate-800/20 p-5 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2"><Send className="w-4 h-4 text-blue-400" /> Compose</h3>

                <div className="flex gap-1 bg-slate-900/50 rounded-xl p-1">
                    {[['global','🌐 Platform-wide'],['targeted','🏢 Single company']].map(([k,l]) => (
                        <button key={k} onClick={() => setTab(k)} className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${tab===k?'bg-blue-600 text-white':'text-slate-400 hover:text-white'}`}>{l}</button>
                    ))}
                </div>

                {tab === 'targeted' && (
                    <select value={form.companyId} onChange={e=>setForm({...form,companyId:e.target.value})} className={inputCls} required>
                        <option value="">Select a company...</option>
                        {companies.filter(c=>c.isActive).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                )}

                <form onSubmit={handlePost} className="space-y-3">
                    <input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Title..." className={inputCls} />
                    <textarea required rows={4} value={form.content} onChange={e=>setForm({...form,content:e.target.value})} placeholder="Message..." className={`${inputCls} resize-none`} />
                    <button type="submit" disabled={posting || (tab==='targeted'&&!form.companyId)} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-sm flex items-center justify-center gap-2">
                        {posting ? <><Loader2 className="w-4 h-4 animate-spin" />Sending...</> : tab==='global' ? '📣 Broadcast to All' : '📨 Send to Company'}
                    </button>
                </form>
            </div>

            {/* History */}
            <div className="rounded-2xl border border-slate-700/40 bg-slate-800/20 p-5 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2"><Megaphone className="w-4 h-4 text-amber-400" /> History</h3>
                {loadingAnn ? <div className="flex justify-center py-8"><Loader2 className="animate-spin w-5 h-5 text-blue-500" /></div>
                    : announcements.length === 0 ? <p className="text-center py-8 text-sm text-slate-500">No announcements yet</p>
                        : (
                            <div className="space-y-2 max-h-[500px] overflow-y-auto">
                                {announcements.map(ann => (
                                    <div key={ann.id} className="p-3 rounded-xl border border-slate-700/30 bg-slate-800/30">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    {ann.isGlobal && <Globe className="w-3 h-3 text-blue-400 flex-shrink-0" />}
                                                    <p className="text-sm font-semibold text-white truncate">{ann.title}</p>
                                                </div>
                                                <p className="text-xs text-slate-500">{ann.createdBy?.fullName} · {fmtDate(ann.createdAt)}</p>
                                            </div>
                                            <button onClick={() => handleDelete(ann.id)} className="p-1 rounded text-slate-500 hover:text-red-400 transition-all flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{ann.content}</p>
                                    </div>
                                ))}
                            </div>
                        )}
            </div>
        </div>
    )
}

// ─── Users Panel ──────────────────────────────────────────────────────────────

export function SuperAdminUsersPanel() {
    const [users,       setUsers]       = useState([])
    const [loading,     setLoading]     = useState(true)
    const [filterRole,  setFilterRole]  = useState('ALL')
    const [search,      setSearch]      = useState('')
    const [editTarget,  setEditTarget]  = useState(null)
    const [resetTarget, setResetTarget] = useState(null)
    const [editForm,    setEditForm]    = useState({ fullName:'', email:'', password:'', role:'' })
    const [saving,      setSaving]      = useState(false)

    const fetchUsers = async () => {
        setLoading(true)
        try {
            const url = filterRole==='ALL' ? '/superadmin/users' : `/superadmin/users?role=${filterRole}`
            const r = await api.get(url); setUsers(r.data.data||[])
        } catch { toast.error('Failed') } finally { setLoading(false) }
    }
    useEffect(() => { fetchUsers() }, [filterRole])

    const filtered = users.filter(u =>
        u.fullName?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.company?.name?.toLowerCase().includes(search.toLowerCase())
    )

    const handleEdit = async e => {
        e.preventDefault(); setSaving(true)
        const payload = { fullName: editForm.fullName, email: editForm.email, role: editForm.role }
        if (editForm.password.trim()) payload.password = editForm.password
        try { await api.patch(`/superadmin/users/${editTarget.id}/full`, payload); toast.success('Updated'); setEditTarget(null); fetchUsers() }
        catch (err) { toast.error(err.response?.data?.message || 'Failed') }
        finally { setSaving(false) }
    }

    const handleSuspend  = async u => { try { await api.patch(`/superadmin/users/${u.id}/suspend`);  toast.success('Suspended'); fetchUsers() } catch (err) { toast.error(err.response?.data?.message||'Failed') } }
    const handleActivate = async u => { try { await api.patch(`/superadmin/users/${u.id}/activate`); toast.success('Activated'); fetchUsers() } catch (err) { toast.error(err.response?.data?.message||'Failed') } }
    const handleDelete   = async u => {
        if (!confirm(`Delete ${u.fullName}?`)) return
        try { await api.delete(`/superadmin/users/${u.id}`); toast.success('Deleted'); fetchUsers() }
        catch (err) { toast.error(err.response?.data?.message||'Failed') }
    }
    const handleForceLogout = async u => {
        try { await api.post(`/superadmin/users/${u.id}/force-logout`); toast.success(`${u.fullName} logged out`) }
        catch { toast.error('Failed') }
    }
    const handleResetPw = async (userId, newPw) => {
        try {
            const r = await api.post(`/superadmin/users/${userId}/reset-password`, { password: newPw })
            toast.success(`Password reset! New: ${r.data.data}`)
            setResetTarget(null)
        } catch { toast.error('Failed') }
    }

    if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin w-8 h-8 text-violet-500" /></div>

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search users..." className={`${inputCls} pl-9`} />
                </div>
                <div className="flex gap-1 flex-wrap">
                    {['ALL','SUPER_ADMIN','ADMIN','MANAGER','EMPLOYEE','GUEST'].map(r => (
                        <button key={r} onClick={()=>setFilterRole(r)} className={`px-3 py-2 rounded-xl text-xs font-medium transition-all border ${filterRole===r?'bg-violet-600 text-white border-violet-600':'text-slate-400 hover:text-white border-slate-700/40 bg-slate-800/30'}`}>{r.replace('_',' ')}</button>
                    ))}
                </div>
                <span className="text-xs text-slate-500 ml-auto">{filtered.length} users</span>
            </div>

            <div className="rounded-2xl overflow-hidden border border-slate-700/40 bg-slate-800/20">
                {filtered.length === 0 ? <div className="text-center py-12 text-sm text-slate-500">No users found</div>
                    : filtered.map(u => (
                        <div key={u.id} className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-700/20 hover:bg-slate-700/10 transition-colors">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                {u.fullName?.charAt(0)?.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{u.fullName}</p>
                                <p className="text-xs text-slate-500 truncate">{u.email} · {u.company?.name||'—'}</p>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${ROLE_COLOR[u.role]||ROLE_COLOR.GUEST}`}>{u.role}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${u.status==='ACTIVE'?'text-emerald-400 bg-emerald-400/10':u.status==='SUSPENDED'?'text-red-400 bg-red-400/10':'text-slate-400 bg-slate-400/10'}`}>{u.status}</span>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <button onClick={() => { setEditTarget(u); setEditForm({ fullName:u.fullName, email:u.email, password:'', role:u.role }) }} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 transition-all" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                                <button onClick={() => setResetTarget(u)} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 transition-all" title="Reset password"><Key className="w-3.5 h-3.5" /></button>
                                <button onClick={() => handleForceLogout(u)} className="p-1.5 rounded-lg text-slate-400 hover:text-orange-400 hover:bg-orange-400/10 transition-all" title="Force logout"><LogOut className="w-3.5 h-3.5" /></button>
                                {u.status==='ACTIVE'
                                    ? <button onClick={()=>handleSuspend(u)} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 transition-all" title="Suspend"><PowerOff className="w-3.5 h-3.5" /></button>
                                    : <button onClick={()=>handleActivate(u)} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10 transition-all" title="Activate"><Power className="w-3.5 h-3.5" /></button>
                                }
                                <button onClick={()=>handleDelete(u)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all" title="Delete"><X className="w-3.5 h-3.5" /></button>
                            </div>
                        </div>
                    ))}
            </div>

            {/* Edit modal */}
            {editTarget && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="rounded-2xl w-full max-w-sm shadow-2xl border border-slate-700/60 bg-slate-900">
                        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
                            <h2 className="text-lg font-semibold text-white">Edit User</h2>
                            <button onClick={()=>setEditTarget(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleEdit} className="p-6 space-y-4">
                            <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name</label><input type="text" value={editForm.fullName} onChange={e=>setEditForm({...editForm,fullName:e.target.value})} className={inputCls} /></div>
                            <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label><input type="email" value={editForm.email} onChange={e=>setEditForm({...editForm,email:e.target.value})} className={inputCls} /></div>
                            <div><label className="block text-sm font-medium text-slate-300 mb-1.5">New Password <span className="text-slate-500 font-normal">(optional)</span></label><input type="password" value={editForm.password} placeholder="Leave empty to keep" onChange={e=>setEditForm({...editForm,password:e.target.value})} className={inputCls} /></div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Role</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['SUPER_ADMIN','ADMIN','MANAGER','EMPLOYEE','GUEST'].map(role => (
                                        <button key={role} type="button" onClick={()=>setEditForm({...editForm,role})} className={`py-2 rounded-xl text-xs font-medium border transition-all ${editForm.role===role?(ROLE_COLOR[role]||ROLE_COLOR.GUEST)+' border-current':'bg-slate-800/50 text-slate-400 border-slate-700/40 hover:text-white'}`}>{role.replace('_',' ')}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={()=>setEditTarget(null)} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm hover:text-white">Cancel</button>
                                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-medium text-sm flex items-center justify-center gap-2">
                                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reset password modal */}
            {resetTarget && <ResetPasswordModal user={resetTarget} onClose={() => setResetTarget(null)} onConfirm={handleResetPw} />}
        </div>
    )
}

function ResetPasswordModal({ user, onClose, onConfirm }) {
    const [pw, setPw] = useState('')
    const [auto, setAuto] = useState(true)

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="rounded-2xl w-full max-w-sm shadow-2xl border border-slate-700/60 bg-slate-900">
                <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
                    <h2 className="text-base font-semibold text-white flex items-center gap-2"><Key className="w-4 h-4 text-amber-400" /> Reset Password</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-400">Reset password for <span className="text-white font-medium">{user.fullName}</span></p>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setAuto(true)} className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${auto?'bg-amber-600/20 border-amber-500/40 text-amber-300':'border-slate-700 text-slate-400 hover:text-white'}`}>Auto-generate</button>
                        <button onClick={() => setAuto(false)} className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${!auto?'bg-violet-600/20 border-violet-500/40 text-violet-300':'border-slate-700 text-slate-400 hover:text-white'}`}>Custom</button>
                    </div>
                    {!auto && <input type="text" value={pw} onChange={e=>setPw(e.target.value)} placeholder="New password..." className={inputCls} />}
                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm hover:text-white">Cancel</button>
                        <button onClick={() => onConfirm(user.id, auto ? '' : pw)} className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-medium text-sm">
                            Reset
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Company Detail Modal ─────────────────────────────────────────────────────

function CompanyDetailModal({ company, onClose }) {
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="rounded-2xl w-full max-w-lg shadow-2xl border border-slate-700/60 bg-slate-900 overflow-y-auto max-h-[85vh]">
                <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center"><Building2 className="w-5 h-5 text-violet-400" /></div>
                        <div><h2 className="text-base font-bold text-white">{company.name}</h2><p className="text-xs text-slate-500">/{company.slug}</p></div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl p-3 bg-slate-800/50 border border-slate-700/30">
                            <p className="text-xs text-slate-500 mb-1">Status</p>
                            {company.isActive ? <span className="text-sm font-bold text-emerald-400">● Active</span> : <span className="text-sm font-bold text-red-400">● Inactive</span>}
                        </div>
                        <div className="rounded-xl p-3 bg-slate-800/50 border border-slate-700/30">
                            <p className="text-xs text-slate-500 mb-1">Task Completion</p>
                            <span className="text-sm font-bold text-white">{company.tasksDoneRate||0}%</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        {[{label:'Users',value:company.users,icon:'👥'},{label:'Projects',value:company.projects,icon:'📁'},{label:'Tasks',value:company.tasks,icon:'✅'}].map(({label,value,icon}) => (
                            <div key={label} className="rounded-xl p-3 text-center bg-slate-800/50 border border-slate-700/30">
                                <p className="text-xl mb-1">{icon}</p><p className="text-lg font-black text-white">{value||0}</p><p className="text-xs text-slate-500">{label}</p>
                            </div>
                        ))}
                    </div>
                    <div className="rounded-xl p-4 bg-slate-800/50 border border-slate-700/30 space-y-2">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Details</p>
                        {[['Active projects',company.activeProjects||0,'text-emerald-400'],['Archived projects',company.archivedProjects||0,'text-slate-400'],['Tasks done',company.tasksDone||0,'text-emerald-400'],['Overdue tasks',company.tasksOverdue||0,company.tasksOverdue>0?'text-red-400':'text-slate-500']].map(([l,v,c])=>(
                            <div key={l} className="flex justify-between text-sm"><span className="text-slate-400">{l}</span><span className={`font-bold ${c}`}>{v}</span></div>
                        ))}
                    </div>
                    {company.usersByRole && Object.keys(company.usersByRole).length > 0 && (
                        <div className="rounded-xl p-4 bg-slate-800/50 border border-slate-700/30">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">User Roles</p>
                            <div className="space-y-2">
                                {Object.entries(company.usersByRole).map(([role,count]) => (
                                    <div key={role} className="flex items-center justify-between">
                                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ROLE_COLOR[role]||ROLE_COLOR.GUEST}`}>{role.replace('_',' ')}</span>
                                        <span className="text-sm font-bold text-white">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {company.lastUserJoined && <p className="text-xs text-slate-500 text-center">Last user joined: {fmtDate(company.lastUserJoined)}</p>}
                </div>
            </div>
        </div>
    )
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────

function DonutChart({ data, total, label }) {
    const t    = data.reduce((s,d) => s+d.value, 0) || 1
    const r    = 40; const cx = 56; const cy = 56
    const circ = 2*Math.PI*r; let offset = 0
    return (
        <svg width="112" height="112" style={{ flexShrink:0 }}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(51,65,85,0.5)" strokeWidth="14" />
            {data.map(({value,color},i) => {
                const dash = (value/t)*circ; const gap = circ-dash
                const seg = <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="14" strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-offset} transform={`rotate(-90 ${cx} ${cy})`} />
                offset += dash; return seg
            })}
            <text x={cx} y={cy-4} textAnchor="middle" fontSize="18" fontWeight="900" fill="white">{fmt(total||t)}</text>
            <text x={cx} y={cy+14} textAnchor="middle" fontSize="10" fill="#64748b">{label||'total'}</text>
        </svg>
    )
}

// ─── Create Admin Modal ───────────────────────────────────────────────────────

function CreateAdminModal({ company, onClose, onSuccess }) {
    const [form, setForm]     = useState({ fullName:'', email:'', password:'' })
    const [creating, setCreating] = useState(false)
    const [showPw,   setShowPw]   = useState(false)
    const checks = [
        { ok: form.password.length>=8,   label:'At least 8 chars' },
        { ok: /[A-Z]/.test(form.password), label:'One uppercase'  },
        { ok: /[a-z]/.test(form.password), label:'One lowercase'  },
        { ok: /[0-9]/.test(form.password), label:'One number'     },
    ]
    const pwValid = checks.every(c=>c.ok)
    const handleCreate = async e => {
        e.preventDefault(); if (!pwValid) { toast.error('Password requirements not met'); return }; setCreating(true)
        try { await api.post(`/superadmin/companies/${company.id}/admin`, form); toast.success(`Admin created!`); onSuccess(); onClose() }
        catch (err) { toast.error(err.response?.data?.message||'Failed') } finally { setCreating(false) }
    }
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="rounded-2xl w-full max-w-md shadow-2xl border border-slate-700/60 bg-slate-900">
                <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
                    <div><div className="flex items-center gap-2 mb-1"><UserPlus className="w-4 h-4 text-violet-400" /><h2 className="text-lg font-semibold text-white">Create Admin</h2></div><p className="text-xs text-slate-500">For: <span className="text-violet-300 font-medium">{company.name}</span></p></div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleCreate} className="p-6 space-y-4">
                    <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name *</label><input required value={form.fullName} onChange={e=>setForm({...form,fullName:e.target.value})} placeholder="Jane Doe" className={inputCls} /></div>
                    <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Email *</label><input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="admin@company.com" className={inputCls} /></div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Password *</label>
                        <div className="relative"><input type={showPw?'text':'password'} required value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="••••••••" className={`${inputCls} pr-16`} /><button type="button" onClick={()=>setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{showPw?'Hide':'Show'}</button></div>
                        {form.password && <div className="mt-2 space-y-1">{checks.map(({ok,label}) => (<div key={label} className={`flex items-center gap-2 text-xs ${ok?'text-emerald-400':'text-slate-500'}`}><div className={`w-1.5 h-1.5 rounded-full ${ok?'bg-emerald-400':'bg-slate-600'}`} />{label}</div>))}</div>}
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm hover:text-white">Cancel</button>
                        <button type="submit" disabled={creating||!form.fullName||!form.email||!pwValid} className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium text-sm flex items-center justify-center gap-2">
                            {creating ? <><Loader2 className="w-4 h-4 animate-spin" />Creating...</> : 'Create Admin'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
