import { useEffect, useState, useRef } from 'react'
import { Phone, Video, X, PhoneOff } from 'lucide-react'
import useSocketStore from '../store/socketStore'
import useVoiceStore from '../store/voiceStore'
import useAuthStore from '../store/authStore'
import useSoundNotification from '../hooks/useSoundNotification.js'

/**
 * Listens for new voice channel activity on the user's conversations and projects
 * and shows a bottom-right popup to join. Each popup auto-dismisses after 30s.
 */
export default function VoiceChannelIncomingPopup() {
    const { user }              = useAuthStore()
    const { client, connected } = useSocketStore()
    const { joinChannel, activeChannel } = useVoiceStore()
    const sounds                = useSoundNotification()

    const [popups, setPopups]   = useState([]) // [{ id, channelName, mode, roomId, type, projectId, conversationId, createdBy }]
    const dismissTimers         = useRef({})
    const subRefs               = useRef([])

    // Subscribe to all voice topic updates the user might be part of
    useEffect(() => {
        if (!client || !connected || !user) return

        // Subscribe to a personal user topic for incoming channel invites
        const topic = `/topic/voice/user/${user.id}`
        const sub = client.subscribe(topic, msg => {
            try {
                const update = JSON.parse(msg.body)
                if (!update.active) return
                // Don't show popup for the channel the user already joined
                if (activeChannel && activeChannel.roomId === update.roomId) return

                const popup = {
                    id:             update.roomId,
                    channelName:    update.name,
                    mode:           update.mode,
                    roomId:         update.roomId,
                    type:           update.type,
                    projectId:      update.projectId   || null,
                    conversationId: update.conversationId || null,
                    createdBy:      update.createdBy   || null,
                    participantCount: update.participants?.length ?? 1,
                }

                setPopups(prev => {
                    if (prev.find(p => p.id === popup.id)) return prev
                    return [...prev, popup]
                })

                sounds.playNotification()

                // Auto-dismiss after 30s
                dismissTimers.current[popup.id] = setTimeout(() => {
                    setPopups(prev => prev.filter(p => p.id !== popup.id))
                    delete dismissTimers.current[popup.id]
                }, 30000)
            } catch {}
        })

        subRefs.current.push(sub)
        return () => {
            sub.unsubscribe()
            subRefs.current = subRefs.current.filter(s => s !== sub)
        }
    }, [client, connected, user?.id])

    // Clean up timers on unmount
    useEffect(() => {
        return () => {
            Object.values(dismissTimers.current).forEach(clearTimeout)
        }
    }, [])

    const dismiss = (id) => {
        clearTimeout(dismissTimers.current[id])
        delete dismissTimers.current[id]
        setPopups(prev => prev.filter(p => p.id !== id))
    }

    const handleJoin = async (popup) => {
        dismiss(popup.id)
        try {
            await joinChannel(popup.type, popup.projectId, popup.conversationId, popup.channelName, popup.mode, popup.roomId)
        } catch {}
    }

    if (popups.length === 0) return null

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 items-end">
            {popups.map(popup => (
                <div key={popup.id}
                     className="rounded-2xl shadow-2xl border overflow-hidden w-80 animate-in slide-in-from-bottom-4 fade-in duration-300"
                     style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 pt-4 pb-2">
                        <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${popup.mode === 'video' ? 'bg-purple-500/20' : 'bg-emerald-500/20'}`}>
                                {popup.mode === 'video'
                                    ? <Video className="w-4 h-4 text-purple-400" />
                                    : <Phone className="w-4 h-4 text-emerald-400" />
                                }
                            </div>
                            <div>
                                <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                                    {popup.mode === 'video' ? 'Video Call' : 'Voice Channel'} Active
                                </p>
                                {popup.createdBy && (
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                        Started by {popup.createdBy}
                                    </p>
                                )}
                            </div>
                        </div>
                        <button onClick={() => dismiss(popup.id)}
                                className="p-1 rounded-lg hover:bg-slate-700/50 transition-all"
                                style={{ color: 'var(--text-muted)' }}>
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Channel name */}
                    <div className="px-4 pb-3">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                            {popup.channelName}
                        </p>
                        {popup.participantCount > 0 && (
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                {popup.participantCount} participant{popup.participantCount !== 1 ? 's' : ''} already inside
                            </p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 px-4 pb-4">
                        <button onClick={() => dismiss(popup.id)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-sm font-medium transition-all"
                                style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
                            <PhoneOff className="w-3.5 h-3.5" /> Ignore
                        </button>
                        <button onClick={() => handleJoin(popup)}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium text-white transition-all ${
                                    popup.mode === 'video'
                                        ? 'bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-600/20'
                                        : 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20'
                                }`}>
                            {popup.mode === 'video' ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
                            Join
                        </button>
                    </div>
                </div>
            ))}
        </div>
    )
}
