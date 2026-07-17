import { useEffect, useState, useCallback, useRef } from 'react'
import {
    Calendar, ChevronLeft, ChevronRight, Plus, X, Loader2,
    Clock, FolderOpen, CheckSquare, Phone, Video, Users, PhoneCall,
    CalendarDays, CalendarRange, LayoutGrid, Pencil, MapPin, Globe
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../api/axios'
import useAuthStore from '../store/authStore'
import SearchableSelect from '../components/SearchableSelect'
import toast from 'react-hot-toast'
import gsap from 'gsap'
import useVoiceStore from '../store/voiceStore'

const EVENT_COLORS = {
    MEETING:    { bg: 'bg-blue-500/80',    text: 'text-white', icon: '📅', dot: 'bg-blue-400'    },
    CALL:       { bg: 'bg-emerald-500/80', text: 'text-white', icon: '📞', dot: 'bg-emerald-400' },
    VIDEO_CALL: { bg: 'bg-purple-500/80',  text: 'text-white', icon: '🎥', dot: 'bg-purple-400'  },
    PROJECT:    { bg: 'bg-orange-500/80',  text: 'text-white', icon: '📁', dot: 'bg-orange-400'  },
    TASK:       { bg: 'bg-rose-500/80',    text: 'text-white', icon: '✅', dot: 'bg-rose-400'     },
}

const VIEW_MODES = ['month', 'week', '3day', 'day']

// Detect system 12h/24h preference
const is12h = new Intl.DateTimeFormat(navigator.language, { hour: 'numeric' }).resolvedOptions().hour12

// Convert a UTC ISO string to the viewer's local timezone for display
function toLocalDisplay(isoStr) {
    if (!isoStr) return ''
    return new Date(isoStr).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

function toLocalTime(isoStr) {
    if (!isoStr) return ''
    return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: is12h })
}

function fmtHour(h) {
    if (is12h) {
        const suffix = h < 12 ? 'AM' : 'PM'
        const h12 = h % 12 || 12
        return `${h12}:00 ${suffix}`
    }
    return `${String(h).padStart(2, '0')}:00`
}

// Build datetime-local value adjusted for creator's timezone stored in event
function toInputLocal(isoStr) {
    if (!isoStr) return ''
    const d = new Date(isoStr)
    const off = d.getTimezoneOffset()
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16)
}

export default function CalendarPage() {
    const { t } = useTranslation()
    const { user } = useAuthStore()
    const { joinChannel: joinVoiceChannel } = useVoiceStore()
    const [searchParams] = useSearchParams()
    const pageRef = useRef(null)
    useEffect(() => {
        if (!pageRef.current) return
        const ctx = gsap.context(() => {
            gsap.fromTo(pageRef.current,
                { opacity: 0, y: 20 },
                { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }
            )
            const cards = pageRef.current.querySelectorAll('[class*="rounded-2xl"][class*="border"], [class*="rounded-xl"][class*="border"]')
            if (cards.length) {
                gsap.fromTo(cards,
                    { opacity: 0, y: 16, scale: 0.96 },
                    { opacity: 1, y: 0, scale: 1, duration: 0.4, stagger: 0.05, delay: 0.12, ease: 'back.out(1.2)', clearProps: 'transform' }
                )
            }
            const rows = pageRef.current.querySelectorAll('[class*="divide-y"] > div, table tbody tr')
            if (rows.length) {
                gsap.fromTo(rows,
                    { opacity: 0, x: -10 },
                    { opacity: 1, x: 0, duration: 0.25, stagger: 0.03, delay: 0.18, ease: 'power2.out', clearProps: 'transform' }
                )
            }
        }, pageRef)
        return () => ctx.revert()
    }, [])

    // Week starts Monday (index 0 = Mon … 6 = Sun)
    const DAYS = [
        t('calendar.days.mon'), t('calendar.days.tue'),
        t('calendar.days.wed'), t('calendar.days.thu'), t('calendar.days.fri'),
        t('calendar.days.sat'), t('calendar.days.sun')
    ]
    const MONTHS = [
        t('calendar.months.january'), t('calendar.months.february'), t('calendar.months.march'),
        t('calendar.months.april'), t('calendar.months.may'), t('calendar.months.june'),
        t('calendar.months.july'), t('calendar.months.august'), t('calendar.months.september'),
        t('calendar.months.october'), t('calendar.months.november'), t('calendar.months.december')
    ]
    const HOURS = Array.from({ length: 24 }, (_, i) => i)

    const today = new Date()
    const [viewMode, setViewMode]          = useState('month')
    const [current, setCurrent]            = useState({ year: today.getFullYear(), month: today.getMonth() })
    const [weekStart, setWeekStart]        = useState(() => {
        const d = new Date(today); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d
    })
    const [threeDayStart, setThreeDayStart] = useState(new Date(today))
    const [dayDate, setDayDate]            = useState(new Date(today))
    const [events, setEvents]              = useState([])
    const [projects, setProjects]          = useState([])
    const [tasks, setTasks]                = useState([])
    const [loading, setLoading]            = useState(true)
    const [showModal, setShowModal]        = useState(false)
    const [selectedDay, setSelectedDay]    = useState(null)
    const [dayEvents, setDayEvents]        = useState([])
    const [showDayPanel, setShowDayPanel]  = useState(false)
    const [allUsers, setAllUsers]          = useState([])
    const [allGroups, setAllGroups]        = useState([])
    const [form, setForm] = useState({
        title: '', description: '', startTime: '', endTime: '',
        eventType: 'MEETING', projectId: '', participantIds: [],
        participantGroupIds: []
    })
    const [creating, setCreating] = useState(false)
    const [joiningCall, setJoiningCall] = useState(false)
    const [editEvent, setEditEvent] = useState(null)
    const [editForm, setEditForm] = useState({
        title: '', description: '', startTime: '', endTime: '',
        eventType: 'MEETING', projectId: '', participantIds: [], participantGroupIds: []
    })
    const [updating, setUpdating] = useState(false)
    const [locationTz, setLocationTz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone)
    const [locationGranted, setLocationGranted] = useState(false)

    // Request geolocation to confirm user's location for timezone context
    useEffect(() => {
        if (!navigator.geolocation) return
        navigator.geolocation.getCurrentPosition(
            () => {
                // Permission granted — timezone is derived from the OS via Intl API
                setLocationGranted(true)
                setLocationTz(Intl.DateTimeFormat().resolvedOptions().timeZone)
            },
            () => {
                // Denied or unavailable — fall back to Intl timezone (still correct)
                setLocationTz(Intl.DateTimeFormat().resolvedOptions().timeZone)
            },
            { timeout: 5000, maximumAge: 300000 }
        )
    }, [])

    const fetchAll = useCallback(async () => {
        setLoading(true)
        try {
            const [evRes, prRes, tkRes, usrRes, grpRes] = await Promise.allSettled([
                api.get('/calendar/events'),
                api.get('/projects'),
                api.get('/tasks/hub'),
                api.get('/users/search'),
                api.get('/groups/root'),
            ])
            setEvents(evRes.status === 'fulfilled' ? evRes.value.data.data || [] : [])
            if (grpRes.status === 'fulfilled') setAllGroups(grpRes.value.data.data || [])
            setProjects(prRes.status === 'fulfilled' ? prRes.value.data.data || [] : [])
            setTasks(tkRes.status === 'fulfilled' ? tkRes.value.data.data || [] : [])
            setAllUsers(usrRes.status === 'fulfilled' ? usrRes.value.data.data || [] : [])
        } catch {}
        finally { setLoading(false) }
    }, [])

    useEffect(() => { fetchAll() }, [fetchAll])

    // When arriving via notification link, jump to the event's day
    useEffect(() => {
        const eventId = Number(searchParams.get('eventId'))
        if (!eventId || events.length === 0) return
        const ev = events.find(e => e.id === eventId)
        if (!ev?.startTime) return
        const d = new Date(ev.startTime)
        const key = d.toISOString().slice(0, 10)
        setCurrent({ year: d.getFullYear(), month: d.getMonth() })
        setTimeout(() => {
            const dayEvs = events
                .filter(e => e.startTime?.slice(0, 10) === key)
                .map(e => ({ id: e.id, type: e.eventType, label: e.title, time: toLocalTime(e.startTime), hour: new Date(e.startTime).getHours(), source: 'calendar', raw: e }))
            setSelectedDay(key)
            setDayEvents(dayEvs)
            setShowDayPanel(true)
        }, 100)
    }, [searchParams, events])

    const buildEventMap = useCallback(() => {
        const map = {}
        const add = (dateStr, ev) => {
            if (!dateStr) return
            const key = dateStr.slice(0, 10)
            if (!map[key]) map[key] = []
            map[key].push(ev)
        }
        events.forEach(e => add(e.startTime?.slice(0, 10), {
            id: e.id, type: e.eventType, label: e.title,
            time: e.startTime ? toLocalTime(e.startTime) : '',
            hour: e.startTime ? new Date(e.startTime).getHours() : 0,
            source: 'calendar', raw: e
        }))
        projects.forEach(p => {
            if (p.endDate) add(p.endDate, { id: 'proj-' + p.id, type: 'PROJECT', label: p.name + ' deadline', time: '', hour: 0, source: 'project', raw: p })
        })
        tasks.forEach(t => {
            if (t.dueDate && t.status !== 'DONE') add(t.dueDate, {
                id: 'task-' + t.id, type: 'TASK', label: t.title, time: '', hour: 0, source: 'task', raw: t
            })
        })
        return map
    }, [events, projects, tasks])

    const eventMap = buildEventMap()

    // ── Month helpers (Monday-first grid)
    const firstDay    = (new Date(current.year, current.month, 1).getDay() + 6) % 7
    const daysInMonth = new Date(current.year, current.month + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)

    const dateKey = (year, month, d) =>
        `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const isToday = d => d && current.year === today.getFullYear() && current.month === today.getMonth() && d === today.getDate()

    // ── Week helpers
    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart); d.setDate(d.getDate() + i); return d
    })
    const weekKey = (d) => d.toISOString().slice(0, 10)

    // ── 3-day helpers
    const threeDays = Array.from({ length: 3 }, (_, i) => {
        const d = new Date(threeDayStart); d.setDate(d.getDate() + i); return d
    })

    // ── Navigation
    const prevMonth    = () => setCurrent(c => c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 })
    const nextMonth    = () => setCurrent(c => c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 })
    const prevWeek     = () => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })
    const nextWeek     = () => setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })
    const prev3Day     = () => setThreeDayStart(d => { const n = new Date(d); n.setDate(n.getDate() - 3); return n })
    const next3Day     = () => setThreeDayStart(d => { const n = new Date(d); n.setDate(n.getDate() + 3); return n })
    const prevDay      = () => setDayDate(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n })
    const nextDay      = () => setDayDate(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n })

    const handleDayClick = (key, evs) => {
        setSelectedDay(key); setDayEvents(evs || eventMap[key] || []); setShowDayPanel(true)
    }

    const handleCreate = async e => {
        e.preventDefault()
        if (!form.title || !form.startTime) return
        setCreating(true)
        try {
            // Send ISO string — the input value is local time, convert to UTC ISO
            const startUTC = new Date(form.startTime).toISOString()
            const endUTC   = form.endTime ? new Date(form.endTime).toISOString() : null
            await api.post('/calendar/events', {
                title: form.title,
                description: form.description,
                startTime: startUTC,
                endTime: endUTC,
                eventType: form.eventType,
                projectId: form.projectId ? Number(form.projectId) : null,
                participantIds: form.participantIds,
                participantGroupIds: form.participantGroupIds,
                creatorTimezone: locationTz,
            })
            toast.success(t('calendar.eventCreated'))
            setShowModal(false)
            setForm({ title:'', description:'', startTime:'', endTime:'', eventType:'MEETING', projectId:'', participantIds:[], participantGroupIds:[] })
            fetchAll()
        } catch (err) { toast.error(err.response?.data?.message || t('calendar.failedToCreateEvent')) }
        finally { setCreating(false) }
    }

    const handleDeleteEvent = async id => {
        try {
            await api.delete(`/calendar/events/${id}`)
            toast.success(t('calendar.eventDeleted'))
            fetchAll()
        } catch { toast.error(t('calendar.failedToDelete')) }
    }

    const openEditEvent = (ev) => {
        setEditEvent(ev)
        setEditForm({
            title:                ev.title || '',
            description:          ev.description || '',
            startTime:            toInputLocal(ev.startTime),
            endTime:              ev.endTime ? toInputLocal(ev.endTime) : '',
            eventType:            ev.eventType || 'MEETING',
            projectId:            ev.project?.id ? String(ev.project.id) : (ev.projectId ? String(ev.projectId) : ''),
            participantIds:       ev.participants?.map(p => p.id) || [],
            participantGroupIds:  ev.participantGroups?.map(g => g.id) || [],
        })
    }

    const handleUpdateEvent = async e => {
        e.preventDefault()
        if (!editEvent) return
        setUpdating(true)
        try {
            await api.put(`/calendar/events/${editEvent.id}`, {
                title:               editForm.title,
                description:         editForm.description,
                startTime:           new Date(editForm.startTime).toISOString(),
                endTime:             editForm.endTime ? new Date(editForm.endTime).toISOString() : null,
                eventType:           editForm.eventType,
                projectId:           editForm.projectId ? Number(editForm.projectId) : null,
                participantIds:      editForm.participantIds,
                participantGroupIds: editForm.participantGroupIds,
                creatorTimezone:     locationTz,
            })
            toast.success('Event updated!')
            setEditEvent(null)
            fetchAll()
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to update event') }
        finally { setUpdating(false) }
    }

    const handleJoinCall = async (ev) => {
        const event = ev.raw
        const roomId = `calendar-event-${event.id}`
        const mode   = event.eventType === 'VIDEO_CALL' ? 'video' : 'audio'
        setJoiningCall(true)
        try {
            await joinVoiceChannel('LINK', null, null, event.title || 'Meeting', mode, roomId)
        } catch (err) {
            toast.error(err.message || 'Could not join call')
        } finally {
            setJoiningCall(false)
        }
    }
    const isCallEvent = (ev) => ev.source === 'calendar' && (ev.type === 'CALL' || ev.type === 'VIDEO_CALL' || ev.type === 'MEETING')

    if (loading) return (
        <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
        </div>
    )

    // ── View label
    const viewLabel = () => {
        if (viewMode === 'month') return `${MONTHS[current.month]} ${current.year}`
        if (viewMode === 'week') {
            const s = weekDays[0], e = weekDays[6]
            return `${s.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`
        }
        if (viewMode === '3day') {
            const s = threeDays[0], e = threeDays[2]
            return `${s.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`
        }
        return dayDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    }

    const onPrev = () => {
        if (viewMode === 'month') prevMonth()
        else if (viewMode === 'week') prevWeek()
        else if (viewMode === '3day') prev3Day()
        else prevDay()
    }
    const onNext = () => {
        if (viewMode === 'month') nextMonth()
        else if (viewMode === 'week') nextWeek()
        else if (viewMode === '3day') next3Day()
        else nextDay()
    }
    const onToday = () => {
        if (viewMode === 'month') setCurrent({ year: today.getFullYear(), month: today.getMonth() })
        else if (viewMode === 'week') { const d = new Date(today); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); setWeekStart(d) }
        else if (viewMode === '3day') setThreeDayStart(new Date(today))
        else setDayDate(new Date(today))
    }

    return (
        <div ref={pageRef} className="flex h-full overflow-hidden">

            {/* ── Main area ─────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col p-6 min-w-0 overflow-y-auto">

                {/* Header */}
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            <Calendar className="w-6 h-6 text-blue-400" />
                            {viewLabel()}
                        </h1>
                        <div className="flex items-center gap-1">
                            <button onClick={onPrev} className="p-1.5 rounded-lg hover:bg-slate-700/50 transition-all" style={{ color: 'var(--text-secondary)' }}>
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button onClick={onToday}
                                    className="px-3 py-1 text-xs rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-all font-medium">
                                {t('calendar.today')}
                            </button>
                            <button onClick={onNext} className="p-1.5 rounded-lg hover:bg-slate-700/50 transition-all" style={{ color: 'var(--text-secondary)' }}>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* View mode toggle */}
                        <div className="flex items-center gap-0.5 p-1 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                            {[
                                { mode: 'month', icon: <LayoutGrid className="w-3.5 h-3.5" />, label: 'Month' },
                                { mode: 'week',  icon: <CalendarRange className="w-3.5 h-3.5" />, label: 'Week' },
                                { mode: '3day',  icon: <CalendarDays className="w-3.5 h-3.5" />, label: '3 Days' },
                                { mode: 'day',   icon: <Calendar className="w-3.5 h-3.5" />, label: 'Day' },
                            ].map(({ mode, icon, label }) => (
                                <button key={mode} onClick={() => setViewMode(mode)}
                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === mode ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                                    {icon}{label}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setShowModal(true)}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-600/20">
                            <Plus className="w-4 h-4" /> {t('calendar.newEvent')}
                        </button>
                    </div>
                </div>

                {/* ── MONTH VIEW ── */}
                {viewMode === 'month' && (
                    <>
                        <div className="grid grid-cols-7 mb-2">
                            {DAYS.map(d => (
                                <div key={d} className="text-center text-xs font-semibold py-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{d}</div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1 flex-1">
                            {cells.map((d, i) => {
                                const key = d ? dateKey(current.year, current.month, d) : null
                                const dayEvs = key ? (eventMap[key] || []) : []
                                const tod = isToday(d)
                                return (
                                    <div key={i}
                                         onClick={() => d && handleDayClick(key)}
                                         className={`min-h-20 rounded-xl p-1.5 transition-all cursor-pointer border ${
                                             d ? 'hover:border-blue-500/30' : 'opacity-0 pointer-events-none'
                                         } ${tod ? 'border-blue-500/50 bg-blue-500/5' : 'border-transparent'} ${
                                             selectedDay === key ? 'border-blue-500/50 bg-blue-500/10' : ''
                                         }`}
                                         style={{ background: d && !tod && selectedDay !== key ? 'var(--bg-card)' : undefined }}>
                                        {d && (
                                            <>
                                                <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold mb-1 mx-auto ${tod ? 'bg-blue-500 text-white' : ''}`}
                                                     style={{ color: tod ? 'white' : 'var(--text-secondary)' }}>
                                                    {d}
                                                </div>
                                                <div className="space-y-0.5">
                                                    {dayEvs.slice(0, 2).map((ev, ei) => {
                                                        const c = EVENT_COLORS[ev.type] || EVENT_COLORS.MEETING
                                                        return (
                                                            <div key={ei} className={`text-xs px-1.5 py-0.5 rounded-md truncate font-medium ${c.bg} ${c.text}`}>
                                                                {c.icon} {ev.label}
                                                            </div>
                                                        )
                                                    })}
                                                    {dayEvs.length > 2 && (
                                                        <div className="text-xs text-slate-500 pl-1">+{dayEvs.length - 2} more</div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )}

                {/* ── WEEK VIEW ── */}
                {viewMode === 'week' && (
                    <div className="flex flex-col flex-1 overflow-hidden">
                        {/* Day headers */}
                        <div className="grid grid-cols-8 border-b" style={{ borderColor: 'var(--border-primary)' }}>
                            <div className="w-12 flex-shrink-0" />
                            {weekDays.map((d, i) => {
                                const isT = d.toDateString() === today.toDateString()
                                return (
                                    <div key={i} className="text-center py-2 px-1">
                                        <p className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>{DAYS[(d.getDay() + 6) % 7]}</p>
                                        <div className={`w-7 h-7 mx-auto flex items-center justify-center rounded-full text-sm font-bold mt-1 ${isT ? 'bg-blue-500 text-white' : ''}`}
                                             style={{ color: isT ? 'white' : 'var(--text-secondary)' }}>
                                            {d.getDate()}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        {/* Time slots */}
                        <div className="flex-1 overflow-y-auto">
                            {HOURS.map(h => (
                                <div key={h} className="grid grid-cols-8 border-b" style={{ minHeight: 52, borderColor: 'var(--border-primary)' }}>
                                    <div className="w-12 flex-shrink-0 text-right pr-2 pt-1">
                                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                            {fmtHour(h)}
                                        </span>
                                    </div>
                                    {weekDays.map((d, di) => {
                                        const key = weekKey(d)
                                        const slotEvs = (eventMap[key] || []).filter(ev => ev.hour === h)
                                        return (
                                            <div key={di}
                                                 onClick={() => handleDayClick(key, eventMap[key] || [])}
                                                 className="border-l p-0.5 cursor-pointer hover:bg-slate-700/20 transition-all"
                                                 style={{ borderColor: 'var(--border-primary)' }}>
                                                {slotEvs.map((ev, ei) => {
                                                    const c = EVENT_COLORS[ev.type] || EVENT_COLORS.MEETING
                                                    return (
                                                        <div key={ei} className={`text-[10px] px-1 py-0.5 rounded truncate font-medium mb-0.5 ${c.bg} ${c.text}`}>
                                                            {c.icon} {ev.label}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── 3-DAY VIEW ── */}
                {viewMode === '3day' && (
                    <div className="flex flex-col flex-1 overflow-hidden">
                        {/* Day headers */}
                        <div className="grid grid-cols-4 border-b" style={{ borderColor: 'var(--border-primary)' }}>
                            <div className="w-14 flex-shrink-0" />
                            {threeDays.map((d, i) => {
                                const isT = d.toDateString() === today.toDateString()
                                return (
                                    <div key={i} className="text-center py-2 px-1">
                                        <p className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>{DAYS[(d.getDay() + 6) % 7]}</p>
                                        <div className={`w-7 h-7 mx-auto flex items-center justify-center rounded-full text-sm font-bold mt-1 ${isT ? 'bg-blue-500 text-white' : ''}`}
                                             style={{ color: isT ? 'white' : 'var(--text-secondary)' }}>
                                            {d.getDate()}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        {/* Time slots */}
                        <div className="flex-1 overflow-y-auto">
                            {HOURS.map(h => (
                                <div key={h} className="grid grid-cols-4 border-b" style={{ minHeight: 52, borderColor: 'var(--border-primary)' }}>
                                    <div className="w-14 flex-shrink-0 text-right pr-2 pt-1">
                                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                            {fmtHour(h)}
                                        </span>
                                    </div>
                                    {threeDays.map((d, di) => {
                                        const key = d.toISOString().slice(0, 10)
                                        const slotEvs = (eventMap[key] || []).filter(ev => ev.hour === h)
                                        return (
                                            <div key={di}
                                                 onClick={() => handleDayClick(key, eventMap[key] || [])}
                                                 className="border-l p-0.5 cursor-pointer hover:bg-slate-700/20 transition-all"
                                                 style={{ borderColor: 'var(--border-primary)' }}>
                                                {slotEvs.map((ev, ei) => {
                                                    const c = EVENT_COLORS[ev.type] || EVENT_COLORS.MEETING
                                                    return (
                                                        <div key={ei} className={`text-[10px] px-1 py-0.5 rounded truncate font-medium mb-0.5 ${c.bg} ${c.text}`}>
                                                            {c.icon} {ev.label}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── DAY VIEW ── */}
                {viewMode === 'day' && (
                    <div className="flex flex-col flex-1 overflow-hidden">
                        <div className="pb-2 mb-2 border-b" style={{ borderColor: 'var(--border-primary)' }}>
                            <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                {dayDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                            </p>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {HOURS.map(h => {
                                const key = dayDate.toISOString().slice(0, 10)
                                const slotEvs = (eventMap[key] || []).filter(ev => ev.hour === h)
                                return (
                                    <div key={h} className="flex gap-3 border-b py-2" style={{ minHeight: 52, borderColor: 'var(--border-primary)' }}>
                                        <div className="w-14 text-right flex-shrink-0">
                                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                {fmtHour(h)}
                                            </span>
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            {slotEvs.map((ev, ei) => {
                                                const c = EVENT_COLORS[ev.type] || EVENT_COLORS.MEETING
                                                const canJoin = isCallEvent(ev)
                                                return (
                                                    <div key={ei} className={`flex items-center justify-between px-3 py-2 rounded-xl ${c.bg} ${c.text}`}>
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <span>{c.icon}</span>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-semibold truncate">{ev.label}</p>
                                                                {ev.time && <p className="text-[10px] opacity-80">{ev.time}</p>}
                                                            </div>
                                                        </div>
                                                        {canJoin && (
                                                            <button onClick={e => { e.stopPropagation(); handleJoinCall(ev) }}
                                                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-white/20 hover:bg-white/30 transition-all flex-shrink-0 ml-2">
                                                                {ev.type === 'VIDEO_CALL' ? <Video className="w-3 h-3" /> : <PhoneCall className="w-3 h-3" />} Join
                                                            </button>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Upcoming strip (month view only) */}
                {viewMode === 'month' && events.filter(e => new Date(e.startTime) >= today).length > 0 && (
                    <div className="mt-6">
                        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
                            {t('calendar.upcoming')}
                        </h3>
                        <div className="space-y-2">
                            {events.filter(e => new Date(e.startTime) >= today).slice(0, 5).map(ev => {
                                    const c = EVENT_COLORS[ev.eventType] || EVENT_COLORS.MEETING
                                    const isCallType = ev.eventType === 'CALL' || ev.eventType === 'VIDEO_CALL' || ev.eventType === 'MEETING'
                                    return (
                                        <div key={ev.id} className="flex items-center gap-3 p-3 rounded-xl border transition-all"
                                             style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${c.bg}`}>
                                                <span className="text-sm">{c.icon}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{ev.title}</p>
                                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                    {toLocalDisplay(ev.startTime)}
                                                    {ev.creatorTimezone && ev.creatorTimezone !== Intl.DateTimeFormat().resolvedOptions().timeZone && (
                                                        <span className="ml-1 opacity-60">({ev.creatorTimezone})</span>
                                                    )}
                                                </p>
                                            </div>
                                            {isCallType && (
                                                <button
                                                    onClick={() => handleJoinCall({ type: ev.eventType, raw: ev })}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 transition-all flex-shrink-0">
                                                    {ev.eventType === 'VIDEO_CALL'
                                                        ? <><Video className="w-3.5 h-3.5" /> Join Video</>
                                                        : <><PhoneCall className="w-3.5 h-3.5" /> Join Call</>
                                                    }
                                                </button>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                    </div>
                )}
            </div>

            {/* ── Day Panel ─────────────────────────────────────────── */}
            {showDayPanel && (
                <div className="flex-shrink-0 flex flex-col border-l overflow-hidden" style={{ width: '320px', background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                    <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                        <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                            {selectedDay ? new Date(selectedDay + 'T12:00:00').toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) : ''}
                        </h3>
                        <button onClick={() => setShowDayPanel(false)} style={{ color: 'var(--text-muted)' }} className="hover:text-white transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {dayEvents.length === 0 ? (
                            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                <p className="text-sm">{t('calendar.noEventsThisDay')}</p>
                            </div>
                        ) : dayEvents.map((ev, i) => {
                            const c = EVENT_COLORS[ev.type] || EVENT_COLORS.MEETING
                            const canJoin = isCallEvent(ev)
                            return (
                                <div key={i} className="p-3 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                                                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                                                    {ev.type?.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{ev.label}</p>
                                            {ev.time && (
                                                <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                                                    <Clock className="w-3 h-3" />{ev.time}
                                                    {ev.raw?.creatorTimezone && (
                                                        <span className="opacity-60">· {ev.raw.creatorTimezone}</span>
                                                    )}
                                                </p>
                                            )}
                                            {ev.source === 'calendar' && ev.raw?.participants?.length > 0 && (
                                                <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                                                    <Users className="w-3 h-3" />{ev.raw.participants.length} participant(s)
                                                </p>
                                            )}
                                        </div>
                                        {ev.source === 'calendar' && String(ev.raw?.createdBy?.id) === String(user?.id) && (
                                            <div className="flex items-center gap-0.5 flex-shrink-0">
                                                <button onClick={() => openEditEvent(ev.raw)}
                                                        className="p-1 rounded text-slate-500 hover:text-blue-400 transition-all">
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => handleDeleteEvent(ev.id)}
                                                        className="p-1 rounded text-slate-500 hover:text-red-400 transition-all">
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    {canJoin && (
                                        <button
                                            onClick={() => handleJoinCall(ev)}
                                            className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 transition-all">
                                            {ev.type === 'VIDEO_CALL'
                                                ? <><Video className="w-3.5 h-3.5" /> Join Video Call</>
                                                : <><PhoneCall className="w-3.5 h-3.5" /> Join Call</>
                                            }
                                        </button>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                    <div className="p-4" style={{ borderTop: '1px solid var(--border-primary)' }}>
                        <button onClick={() => {
                            const d = selectedDay
                            setForm(f => ({ ...f, startTime: d ? d + 'T09:00' : '' }))
                            setShowModal(true)
                        }} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all">
                            <Plus className="w-4 h-4" /> {t('calendar.addEventThisDay')}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Edit Event Modal ─────────────────────────────────────── */}
            {editEvent && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="rounded-2xl w-full max-w-lg shadow-2xl border max-h-[90vh] overflow-y-auto"
                         style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                        <div className="flex items-center justify-between p-6 sticky top-0 z-10"
                             style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-secondary)' }}>
                            <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                <Pencil className="w-5 h-5 text-blue-400" /> Edit Event
                            </h2>
                            <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-1 rounded-lg flex items-center gap-1 ${locationGranted ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'}`}>
                                    {locationGranted ? <MapPin className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                                    {locationTz}
                                </span>
                                <button onClick={() => setEditEvent(null)} style={{ color: 'var(--text-secondary)' }}>
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <form onSubmit={handleUpdateEvent} className="p-6 space-y-4">
                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('calendar.titleRequired')}</label>
                                <input required value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})}
                                       placeholder={t('calendar.eventTitlePlaceholder')}
                                       className="w-full rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                       style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }} />
                            </div>
                            {/* Type */}
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('calendar.type')}</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[['MEETING','📅 Meeting'],['CALL','📞 Call'],['VIDEO_CALL','🎥 Video'],['PROJECT','📁 Project'],['TASK','✅ Task']].map(([val, lbl]) => (
                                        <button key={val} type="button" onClick={() => setEditForm({...editForm, eventType: val})}
                                                className={`py-2 rounded-xl text-xs font-medium border transition-all ${editForm.eventType === val ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-600 text-slate-400 hover:border-blue-500/50'}`}>
                                            {lbl}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* Start / End */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('calendar.startRequired')}</label>
                                    <input required type="datetime-local" value={editForm.startTime}
                                           onChange={e => setEditForm({...editForm, startTime: e.target.value})}
                                           className="w-full rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                           style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('calendar.end')}</label>
                                    <input type="datetime-local" value={editForm.endTime}
                                           onChange={e => setEditForm({...editForm, endTime: e.target.value})}
                                           className="w-full rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                           style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }} />
                                </div>
                            </div>
                            {/* Timezone hint */}
                            {editForm.startTime && (
                                <div className="rounded-xl p-3 text-xs flex items-start gap-2" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
                                    <Globe className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                                    <div style={{ color: 'var(--text-secondary)' }}>
                                        <span className="font-medium text-blue-400">{locationTz}</span>
                                        {' — '}Times are entered in your local timezone.
                                    </div>
                                </div>
                            )}
                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('calendar.description')}</label>
                                <textarea rows={2} value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})}
                                          placeholder={t('calendar.optionalDetails')}
                                          className="w-full rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }} />
                            </div>
                            {/* Linked project */}
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                    {t('calendar.linkedProject')} <span className="font-normal" style={{ color: 'var(--text-muted)' }}>({t('calendar.optional')})</span>
                                </label>
                                <select value={editForm.projectId} onChange={e => setEditForm({...editForm, projectId: e.target.value})}
                                        className="w-full rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}>
                                    <option value="">{t('calendar.none')}</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            {/* Participants */}
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('calendar.participants')}</label>
                                <SearchableSelect
                                    options={allUsers.filter(u => !editForm.participantIds.includes(u.id)).map(u => ({ value: u.id, label: u.fullName, sublabel: u.email }))}
                                    value=""
                                    onChange={uid => { if (uid && !editForm.participantIds.includes(uid)) setEditForm(f => ({...f, participantIds: [...f.participantIds, uid]})) }}
                                    placeholder={t('calendar.addParticipants')}
                                />
                                {editForm.participantIds.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {editForm.participantIds.map(uid => {
                                            const u = allUsers.find(u => u.id === uid)
                                            return (
                                                <div key={uid} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                                                     style={{ background: 'var(--bg-input)', borderColor: 'var(--border-input)', color: 'var(--text-primary)' }}>
                                                    {u?.fullName}
                                                    <button type="button" onClick={() => setEditForm(f => ({...f, participantIds: f.participantIds.filter(id => id !== uid)}))}
                                                            className="text-slate-500 hover:text-red-400 transition-colors">×</button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                            {/* Participant groups */}
                            {allGroups.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                        Participant Groups <span style={{ color: 'var(--text-muted)' }}>({t('calendar.optional')})</span>
                                    </label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {allGroups.map(g => (
                                            <button key={g.id} type="button"
                                                    onClick={() => setEditForm(f => ({
                                                        ...f,
                                                        participantGroupIds: f.participantGroupIds.includes(g.id)
                                                            ? f.participantGroupIds.filter(id => id !== g.id)
                                                            : [...f.participantGroupIds, g.id]
                                                    }))}
                                                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${editForm.participantGroupIds.includes(g.id) ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-600 text-slate-400 hover:border-blue-500/50'}`}>
                                                <Users className="w-3 h-3 inline mr-1" />{g.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setEditEvent(null)}
                                        className="flex-1 py-2.5 rounded-xl text-sm transition-all border"
                                        style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
                                    {t('common.cancel')}
                                </button>
                                <button type="submit" disabled={updating}
                                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium text-sm transition-all flex items-center justify-center gap-2">
                                    {updating ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : '💾 Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Create Event Modal ────────────────────────────────────── */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="rounded-2xl w-full max-w-lg shadow-2xl border max-h-[90vh] overflow-y-auto"
                         style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                        <div className="flex items-center justify-between p-6 sticky top-0 z-10" style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-secondary)' }}>
                            <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                <Calendar className="w-5 h-5 text-blue-400" /> {t('calendar.newEvent')}
                            </h2>
                            <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-1 rounded-lg flex items-center gap-1 ${locationGranted ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'}`}>
                                    {locationGranted ? <MapPin className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                                    {locationTz}
                                </span>
                                <button onClick={() => setShowModal(false)} style={{ color: 'var(--text-secondary)' }}>
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('calendar.titleRequired')}</label>
                                <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                                       placeholder={t('calendar.eventTitlePlaceholder')}
                                       className="w-full rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                       style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('calendar.type')}</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[['MEETING','📅 Meeting'],['CALL','📞 Call'],['VIDEO_CALL','🎥 Video']].map(([val, lbl]) => (
                                        <button key={val} type="button" onClick={() => setForm({...form, eventType: val})}
                                                className={`py-2 rounded-xl text-xs font-medium border transition-all ${form.eventType === val ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-600 text-slate-400 hover:border-blue-500/50'}`}>
                                            {lbl}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('calendar.startRequired')}</label>
                                    <input required type="datetime-local" value={form.startTime}
                                           onChange={e => setForm({...form, startTime: e.target.value})}
                                           className="w-full rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                           style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('calendar.end')}</label>
                                    <input type="datetime-local" value={form.endTime}
                                           onChange={e => setForm({...form, endTime: e.target.value})}
                                           className="w-full rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                           style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }} />
                                </div>
                            </div>
                            {form.startTime && (
                                <div className="rounded-xl p-3 text-xs flex items-start gap-2" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
                                    <Globe className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                                    <div style={{ color: 'var(--text-secondary)' }}>
                                        <span className="font-medium text-blue-400">{locationTz}</span>
                                        {' — '}Times are entered in your local timezone. Participants in other timezones will see the event converted automatically.
                                    </div>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('calendar.description')}</label>
                                <textarea rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                                          placeholder={t('calendar.optionalDetails')}
                                          className="w-full rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                    {t('calendar.linkedProject')} <span className="font-normal" style={{ color: 'var(--text-muted)' }}>({t('calendar.optional')})</span>
                                </label>
                                <select value={form.projectId} onChange={e => setForm({...form, projectId: e.target.value})}
                                        className="w-full rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}>
                                    <option value="">{t('calendar.none')}</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('calendar.participants')}</label>
                                <SearchableSelect
                                    options={allUsers.filter(u => !form.participantIds.includes(u.id)).map(u => ({ value: u.id, label: u.fullName, sublabel: u.email }))}
                                    value=""
                                    onChange={uid => { if (uid && !form.participantIds.includes(uid)) setForm(f => ({...f, participantIds: [...f.participantIds, uid]})) }}
                                    placeholder={t('calendar.addParticipants')}
                                />
                                {form.participantIds.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {form.participantIds.map(uid => {
                                            const u = allUsers.find(u => u.id === uid)
                                            return (
                                                <div key={uid} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                                                     style={{ background: 'var(--bg-input)', borderColor: 'var(--border-input)', color: 'var(--text-primary)' }}>
                                                    {u?.fullName}
                                                    <button type="button" onClick={() => setForm(f => ({...f, participantIds: f.participantIds.filter(id => id !== uid)}))}
                                                            className="text-slate-500 hover:text-red-400 transition-colors">×</button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                            {allGroups.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                        Participant Groups <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
                                    </label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {allGroups.map(g => (
                                            <button key={g.id} type="button"
                                                    onClick={() => setForm(f => ({
                                                        ...f,
                                                        participantGroupIds: f.participantGroupIds.includes(g.id)
                                                            ? f.participantGroupIds.filter(id => id !== g.id)
                                                            : [...f.participantGroupIds, g.id]
                                                    }))}
                                                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${form.participantGroupIds.includes(g.id) ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-600 text-slate-400 hover:border-blue-500/50'}`}>
                                                <Users className="w-3 h-3 inline mr-1" />{g.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)}
                                        className="flex-1 py-2.5 rounded-xl text-sm transition-all border"
                                        style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
                                    {t('common.cancel')}
                                </button>
                                <button type="submit" disabled={creating}
                                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium text-sm transition-all flex items-center justify-center gap-2">
                                    {creating ? <><Loader2 className="w-4 h-4 animate-spin" />{t('calendar.creating')}</> : '📅 ' + t('calendar.createEvent')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
