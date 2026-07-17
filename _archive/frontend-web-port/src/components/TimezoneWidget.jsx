import { useState, useEffect } from 'react'
import { Globe, ChevronDown, ChevronUp, Settings, Save, X, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../api/axios'
import useAuthStore from '../store/authStore'

// Common IANA timezone list for admin picker
export const COMMON_TIMEZONES = [
    { value: 'UTC',                    label: 'UTC' },
    { value: 'America/New_York',       label: 'New York (EST/EDT)' },
    { value: 'America/Chicago',        label: 'Chicago (CST/CDT)' },
    { value: 'America/Denver',         label: 'Denver (MST/MDT)' },
    { value: 'America/Los_Angeles',    label: 'Los Angeles (PST/PDT)' },
    { value: 'America/Sao_Paulo',      label: 'São Paulo (BRT)' },
    { value: 'America/Toronto',        label: 'Toronto (EST/EDT)' },
    { value: 'America/Montreal',       label: 'Montreal (EST/EDT)' },
    { value: 'America/Vancouver',      label: 'Vancouver (PST/PDT)' },
    { value: 'Europe/London',          label: 'London (GMT/BST)' },
    { value: 'Europe/Paris',           label: 'Paris (CET/CEST)' },
    { value: 'Europe/Berlin',          label: 'Berlin (CET/CEST)' },
    { value: 'Europe/Rome',            label: 'Italy / Milan (CET/CEST)' },
    { value: 'Europe/Madrid',          label: 'Madrid (CET/CEST)' },
    { value: 'Europe/Amsterdam',       label: 'Amsterdam (CET/CEST)' },
    { value: 'Europe/Moscow',          label: 'Moscow (MSK)' },
    { value: 'Africa/Casablanca',      label: 'Morocco / Casablanca (WET)' },
    { value: 'Africa/Cairo',           label: 'Cairo (EET)' },
    { value: 'Africa/Lagos',           label: 'Lagos (WAT)' },
    { value: 'Africa/Algiers',         label: 'Algeria / Algiers (CET)' },
    { value: 'Africa/Tunis',           label: 'Tunisia / Tunis (CET)' },
    { value: 'Asia/Dubai',             label: 'Dubai (GST)' },
    { value: 'Asia/Kolkata',           label: 'Mumbai / Kolkata (IST)' },
    { value: 'Asia/Bangkok',           label: 'Bangkok (ICT)' },
    { value: 'Asia/Shanghai',          label: 'Shanghai / Beijing (CST)' },
    { value: 'Asia/Tokyo',             label: 'Tokyo (JST)' },
    { value: 'Asia/Seoul',             label: 'Seoul (KST)' },
    { value: 'Asia/Singapore',         label: 'Singapore (SGT)' },
    { value: 'Australia/Sydney',       label: 'Sydney (AEST/AEDT)' },
    { value: 'Pacific/Auckland',       label: 'Auckland (NZST/NZDT)' },
]

function uses12Hour(tz) {
    return tz.startsWith('America/') || tz === 'Pacific/Honolulu'
}

export default function TimezoneWidget() {
    const { t }    = useTranslation()
    const { user } = useAuthStore()
    const isAdmin  = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

    const [zones,      setZones]      = useState([])
    const [times,      setTimes]      = useState({})
    const [collapsed,  setCollapsed]  = useState(false)
    const [showConfig, setShowConfig] = useState(false)
    const [draft,      setDraft]      = useState([])
    const [saving,     setSaving]     = useState(false)

    const fetchZones = () => {
        api.get('/company/settings/timezones')
            .then(r => setZones(r.data.data || []))
            .catch(() => setZones([]))
    }

    // Fetch company timezone settings on mount + re-fetch when admin saves
    useEffect(() => {
        fetchZones()
        window.addEventListener('company-tz-updated', fetchZones)
        return () => window.removeEventListener('company-tz-updated', fetchZones)
    }, [])

    // Tick every second
    useEffect(() => {
        if (zones.length === 0) return
        const update = () => {
            const now = {}
            zones.forEach(z => {
                try {
                    now[z] = new Date().toLocaleTimeString('en-US', {
                        timeZone: z,
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: uses12Hour(z),
                    })
                } catch { now[z] = '--:--' }
            })
            setTimes(now)
        }
        update()
        const id = setInterval(update, 1000)
        return () => clearInterval(id)
    }, [zones])

    const getLabel = (tz) => {
        const found = COMMON_TIMEZONES.find(t => t.value === tz)
        if (found) return found.label.split(' (')[0]
        return tz.split('/').pop().replace('_', ' ')
    }

    const getDatePart = (tz) => {
        try {
            return new Date().toLocaleDateString('en-US', {
                timeZone: tz, weekday: 'short', month: 'short', day: 'numeric'
            })
        } catch { return '' }
    }

    const openConfig = () => { setDraft([...zones]); setShowConfig(true) }

    const addZone = (tz) => {
        if (!tz || draft.includes(tz)) return
        if (draft.length >= 5) { return }
        setDraft(prev => [...prev, tz])
    }

    const removeZone = (tz) => setDraft(prev => prev.filter(z => z !== tz))

    const handleSave = async () => {
        setSaving(true)
        try {
            await api.put('/company/settings/timezones', draft)
            setZones(draft)
            setShowConfig(false)
            window.dispatchEvent(new CustomEvent('company-tz-updated'))
        } catch {
        } finally { setSaving(false) }
    }

    if (zones.length === 0 && !isAdmin) return null

    return (
        <>
            <div className="mx-3 mb-2 rounded-xl border overflow-hidden"
                 style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                <button
                    onClick={() => setCollapsed(v => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-700/30 transition-all"
                    style={{ color: 'var(--text-secondary)' }}>
                    <div className="flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-xs font-semibold">{t('timezones.worldClock')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        {isAdmin && (
                            <span onClick={e => { e.stopPropagation(); openConfig() }}
                                  className="p-0.5 rounded hover:bg-slate-600/50 transition-all cursor-pointer">
                                <Settings className="w-3 h-3" />
                            </span>
                        )}
                        {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                    </div>
                </button>

                {!collapsed && zones.length > 0 && (
                    <div className="px-3 pb-2 space-y-1.5">
                        {zones.map(tz => (
                            <div key={tz} className="flex items-center justify-between gap-2 py-1">
                                <div className="min-w-0">
                                    <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                        {getLabel(tz)}
                                    </p>
                                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                        {getDatePart(tz)}
                                    </p>
                                </div>
                                <span className="font-mono text-sm font-bold text-blue-400 flex-shrink-0">
                                    {times[tz] || '--:--'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {!collapsed && zones.length === 0 && isAdmin && (
                    <div className="px-3 pb-3 text-center">
                        <p className="text-[10px] text-slate-500 mb-2">{t('timezones.noTimezonesConfigured')}</p>
                        <button onClick={openConfig}
                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                            {t('timezones.configure')}
                        </button>
                    </div>
                )}
            </div>

            {/* Admin config modal */}
            {showConfig && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl">
                        <div className="flex items-center justify-between p-4 border-b border-slate-700">
                            <h3 className="font-semibold text-white flex items-center gap-2">
                                <Globe className="w-4 h-4 text-blue-400" /> {t('timezones.worldClockMax5')}
                            </h3>
                            <button onClick={() => setShowConfig(false)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-all">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-4 space-y-3">
                            {/* Current draft zones */}
                            <div className="space-y-1.5">
                                {draft.map(tz => (
                                    <div key={tz} className="flex items-center justify-between px-3 py-2 bg-slate-700/50 rounded-xl">
                                        <span className="text-sm text-white">{getLabel(tz)}</span>
                                        <button onClick={() => removeZone(tz)}
                                                className="p-1 text-slate-400 hover:text-red-400 transition-colors">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                                {draft.length === 0 && (
                                    <p className="text-xs text-slate-500 text-center py-2">No timezones added</p>
                                )}
                            </div>

                            {/* Add zone picker */}
                            {draft.length < 5 && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1.5">{t('timezones.addTimezone')}</label>
                                    <select
                                        defaultValue=""
                                        onChange={e => { addZone(e.target.value); e.target.value = '' }}
                                        className="w-full bg-slate-700/50 border border-slate-600 rounded-xl py-2 px-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                        <option value="" disabled>{t('timezones.selectTimezone')}</option>
                                        {COMMON_TIMEZONES.filter(t => !draft.includes(t.value)).map(t => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2 p-4 border-t border-slate-700">
                            <button onClick={() => setShowConfig(false)}
                                    className="flex-1 py-2 rounded-xl border border-slate-600 text-slate-300 hover:text-white text-sm transition-all">
                                Cancel
                            </button>
                            <button onClick={handleSave} disabled={saving}
                                    className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-all flex items-center justify-center gap-2">
                                {saving ? 'Saving…' : <><Save className="w-4 h-4" /> Save for all</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
