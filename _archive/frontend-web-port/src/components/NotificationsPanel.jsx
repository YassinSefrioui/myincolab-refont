import { useEffect, useState, useRef } from 'react'
import { X, Check, Clock, Bell, ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import api from '../api/axios'
import toast from 'react-hot-toast'
import useSoundNotification from '../hooks/useSoundNotification.js'

export default function NotificationsPanel({ isOpen, onClose, onUnreadCountChange }) {
    const { t }  = useTranslation()
    const sounds = useSoundNotification()
    const navigate = useNavigate()
    const [notifications, setNotifications] = useState([])
    const [loading, setLoading]             = useState(false)
    const panelRef     = useRef(null)
    const prevCountRef = useRef(0)

    useEffect(() => { if (isOpen) fetchNotifications() }, [isOpen])

    useEffect(() => {
        const handleClickOutside = e => {
            if (panelRef.current && !panelRef.current.contains(e.target)) onClose()
        }
        const handleEscape = e => { if (e.key === 'Escape') onClose() }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            document.addEventListener('keydown', handleEscape)
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('keydown', handleEscape)
        }
    }, [isOpen, onClose])

    useEffect(() => {
        const pollUnread = async () => {
            try {
                const res   = await api.get('/notifications/unread-count')
                const count = res.data.data || 0
                if (count > prevCountRef.current) {
                    sounds.playNotification()
                    onUnreadCountChange(count)
                }
                prevCountRef.current = count
            } catch {}
        }
        pollUnread()
        const interval = setInterval(pollUnread, 15000)
        return () => clearInterval(interval)
    }, [])

    const fetchNotifications = async () => {
        setLoading(true)
        try {
            const response = await api.get('/notifications')
            setNotifications(response.data.data || [])
        } catch { toast.error('Failed to load notifications') }
        finally   { setLoading(false) }
    }

    const markAllAsRead = async () => {
        try {
            await api.post('/notifications/mark-all-read')
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
            onUnreadCountChange(0)
            prevCountRef.current = 0
        } catch { toast.error('Failed') }
    }

    const buildUrl = (n) => {
        if (n.referenceUrl) return n.referenceUrl
        if (!n.entityType || !n.entityId) return null
        switch (n.entityType) {
            case 'Task':         return `/projects?taskId=${n.entityId}`
            case 'Project':      return `/projects?projectId=${n.entityId}`
            case 'File':         return `/documents?fileId=${n.entityId}`
            case 'Message':
            case 'Conversation': return `/chat?conversationId=${n.entityId}`
            case 'Announcement': return `/announcements?announcementId=${n.entityId}`
            case 'CalendarEvent':return `/calendar?eventId=${n.entityId}`
            default:             return null
        }
    }

    const handleNotificationClick = (notification) => {
        // Fire-and-forget delete — don't await so navigation is synchronous
        api.delete(`/notifications/${notification.id}`).catch(() => {})
        // Remove from UI immediately
        setNotifications(prev => prev.filter(n => n.id !== notification.id))
        const newUnread = notifications.filter(n => !n.isRead && n.id !== notification.id).length
        onUnreadCountChange(newUnread)
        prevCountRef.current = newUnread
        // Navigate first, then close — order matters
        const url = buildUrl(notification)
        if (url) {
            navigate(url)
        }
        onClose()
    }

    const formatTimestamp = ts => {
        if (!ts) return ''
        const diff = Math.floor((new Date() - new Date(ts)) / 1000)
        if (diff < 60)    return 'Just now'
        if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
        return `${Math.floor(diff / 86400)}d ago`
    }

    // Some notification bodies (voice channels, files, etc.) were stored as
    // raw JSON before the server preview was added. Detect & humanize.
    const humanizeBody = (n) => {
        const raw = n?.body
        if (!raw || typeof raw !== 'string') return raw
        if (!raw.trim().startsWith('{')) return raw
        let data; try { data = JSON.parse(raw) } catch { return raw }
        if (!data || typeof data !== 'object') return raw
        const time = n.createdAt
            ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : ''
        // Voice channel END (has "duration")
        if ('duration' in data) {
            return t('notifications.voiceCallEnded', { time, duration: data.duration || '' })
                || `📞 Ended a voice call${time ? ' at ' + time : ''}`
        }
        // Voice channel START (has "roomId" / "channelName")
        if ('roomId' in data || 'channelName' in data) {
            return t('notifications.voiceCallStarted', { time })
                || `📞 Started a voice call${time ? ' at ' + time : ''}`
        }
        return raw
    }

    const getTypeIcon = type => {
        const icons = {
            TASK_ASSIGNED: '📋', TASK_STATUS_UPDATED: '🔄', TASK_APPROVED: '✅',
            TASK_REJECTED: '❌', MENTION: '🏷️', FILE_UPLOADED: '📁', FILE_NEW_VERSION: '🔄',
            ISSUE_LOGGED: '⚠️', ISSUE_STATUS_CHANGED: '⚠️', DECISION_ADDED: '📝',
            NEW_MESSAGE: '💬', ANNOUNCEMENT: '📢', CALENDAR_EVENT: '📅',
            GUEST_EXPIRING: '⏰',
        }
        return icons[type] || '🔔'
    }

    const unreadCount = notifications.filter(n => !n.isRead).length

    if (!isOpen) return null

    return (
        <>
            <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.2)' }} />
            <div ref={panelRef}
                 className="fixed top-0 right-0 h-full w-96 shadow-2xl z-50 flex flex-col"
                 style={{ background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-primary)' }}>

                <div className="flex items-center justify-between p-6" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                    <div className="flex items-center gap-2">
                        <Bell className="w-5 h-5 text-blue-400" />
                        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{t('notifications.title')}</h2>
                        {unreadCount > 0 && (
                            <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full font-medium">{unreadCount}</span>
                        )}
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-700/50 transition-all" style={{ color: 'var(--text-secondary)' }}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {notifications.some(n => !n.isRead) && (
                    <div className="p-4" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                        <button onClick={markAllAsRead} className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
                            <Check className="w-4 h-4" /> {t('notifications.markAllAsRead')}
                        </button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center p-8">
                            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center">
                            <Clock className="w-10 h-10 mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('notifications.noNotificationsYet')}</p>
                        </div>
                    ) : (
                        <div>
                            {notifications.map(n => (
                                <div key={n.id} onClick={() => handleNotificationClick(n)}
                                     className="p-4 cursor-pointer transition-all hover:bg-slate-700/30 group"
                                     style={{ borderBottom: '1px solid var(--border-primary)', background: n.isRead ? 'transparent' : 'rgba(37,99,235,0.06)' }}>
                                    <div className="flex items-start gap-3">
                                        <div className={`w-2 h-2 rounded-full mt-2.5 flex-shrink-0 ${n.isRead ? 'bg-transparent' : 'bg-blue-500'}`} />
                                        <div className="w-8 h-8 rounded-xl bg-slate-700/50 flex items-center justify-center flex-shrink-0 text-sm">
                                            {getTypeIcon(n.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="font-medium text-sm leading-tight"
                                                   style={{ color: n.isRead ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                                                    {n.title}
                                                </p>
                                                {n.referenceUrl && (
                                                    <ExternalLink className="w-3 h-3 text-blue-400 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                )}
                                            </div>
                                            {n.body && (
                                                <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{humanizeBody(n)}</p>
                                            )}
                                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{formatTimestamp(n.createdAt)}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}
