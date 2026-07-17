import { useEffect, useState, useRef } from 'react'
import { Volume2, Video, Plus, Users, Mic } from 'lucide-react'
import useVoiceStore from '../store/voiceStore'
import useSocketStore from '../store/socketStore'
import useAuthStore from '../store/authStore'

/**
 * Props:
 *   type          — "PROJECT" | "CONVERSATION"
 *   id            — projectId or conversationId
 *   defaultMode   — "audio" | "video"  (default "audio")
 */
export default function VoiceChannelsPanel({ type, id, defaultMode = 'audio' }) {
    const { user }             = useAuthStore()
    const { joinChannel, activeChannel, leaveChannel } = useVoiceStore()
    const { client, connected } = useSocketStore()

    const [channels,  setChannels]  = useState([])
    const [joining,   setJoining]   = useState(null) // channelName being joined
    const [newName,   setNewName]   = useState('')
    const [showNew,   setShowNew]   = useState(false)
    const subRef = useRef(null)

    const topicKey = type === 'PROJECT' ? 'project' : 'conversation'
    const apiPath  = type === 'PROJECT'
        ? `/api/voice-channels/project/${id}`
        : `/api/voice-channels/conversation/${id}`

    // Fetch initial list
    useEffect(() => {
        if (!id) return
        const token = JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.token || localStorage.getItem('token') || ''
        fetch(apiPath, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(d => setChannels(d.data || []))
            .catch(() => {})
    }, [id, apiPath])

    // STOMP real-time updates
    useEffect(() => {
        if (!client || !connected || !id) return
        const topic = `/topic/voice/${topicKey}/${id}`
        subRef.current = client.subscribe(topic, msg => {
            try {
                const update = JSON.parse(msg.body)
                setChannels(prev => {
                    if (!update.active) {
                        return prev.filter(ch => ch.roomId !== update.roomId)
                    }
                    const idx = prev.findIndex(ch => ch.roomId === update.roomId)
                    const entry = {
                        channelId:        update.channelId,
                        roomId:           update.roomId,
                        name:             update.name,
                        mode:             update.mode,
                        participantCount: update.participants?.length ?? 0,
                        participants:     update.participants || [],
                    }
                    if (idx >= 0) {
                        const copy = [...prev]; copy[idx] = entry; return copy
                    }
                    return [...prev, entry]
                })
            } catch {}
        })
        return () => { try { subRef.current?.unsubscribe() } catch {} }
    }, [client, connected, id, topicKey])

    const handleJoin = async (channelName, mode) => {
        setJoining(channelName)
        try {
            await joinChannel(
                type,
                type === 'PROJECT' ? id : null,
                type === 'CONVERSATION' ? id : null,
                channelName,
                mode,
            )
        } catch (e) {
            console.error('[Voice] join failed', e)
        } finally {
            setJoining(null)
        }
    }

    const handleCreateAndJoin = async () => {
        const name = newName.trim() || 'Voice'
        setShowNew(false)
        setNewName('')
        await handleJoin(name, defaultMode)
    }

    const myId = String(user?.id || user?.userId)

    return (
        <div className="space-y-2">
            {/* Header */}
            <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <Volume2 className="w-3 h-3" /> Voice Channels
                </span>
                <button
                    onClick={() => setShowNew(v => !v)}
                    className="text-slate-500 hover:text-green-400 transition-colors"
                    title="Create channel"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            {/* New channel input */}
            {showNew && (
                <div className="flex gap-1">
                    <input
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleCreateAndJoin(); if (e.key === 'Escape') setShowNew(false) }}
                        placeholder="Channel name…"
                        autoFocus
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white placeholder-slate-500 outline-none focus:border-green-500"
                    />
                    <button
                        onClick={handleCreateAndJoin}
                        className="bg-green-600 hover:bg-green-500 text-white rounded-lg px-2 py-1 text-xs font-medium transition-all"
                    >
                        Join
                    </button>
                </div>
            )}

            {/* Channel list */}
            {channels.length === 0 && (
                <p className="text-xs text-slate-600 py-2 text-center">No active channels — click + to start one</p>
            )}

            {channels.map(ch => {
                const isInThis = activeChannel?.roomId === ch.roomId
                const isBusy   = joining === ch.name
                const imIn     = ch.participants?.some(p => String(p.userId) === myId)

                return (
                    <div key={ch.roomId}
                         className={`rounded-xl border transition-all ${isInThis ? 'border-green-500/40 bg-green-500/5' : 'border-slate-700/50 bg-slate-800/40'}`}>
                        <div className="flex items-center gap-2 px-3 py-2">
                            {ch.mode === 'video'
                                ? <Video className={`w-3.5 h-3.5 flex-shrink-0 ${isInThis ? 'text-green-400' : 'text-slate-500'}`} />
                                : <Volume2 className={`w-3.5 h-3.5 flex-shrink-0 ${isInThis ? 'text-green-400' : 'text-slate-500'}`} />
                            }
                            <span className={`text-xs font-medium flex-1 truncate ${isInThis ? 'text-green-300' : 'text-slate-300'}`}>
                                {ch.name}
                            </span>
                            <span className="flex items-center gap-0.5 text-xs text-slate-500">
                                <Users className="w-3 h-3" />
                                {ch.participantCount ?? ch.participants?.length ?? 0}
                            </span>

                            {isInThis ? (
                                <button
                                    onClick={leaveChannel}
                                    className="ml-1 text-xs text-red-400 hover:text-red-300 transition-colors font-medium"
                                >
                                    Leave
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleJoin(ch.name, ch.mode)}
                                    disabled={!!isBusy}
                                    className="ml-1 text-xs text-green-400 hover:text-green-300 transition-colors font-medium disabled:opacity-50"
                                >
                                    {isBusy ? '…' : 'Join'}
                                </button>
                            )}
                        </div>

                        {/* Participant avatars */}
                        {ch.participants?.length > 0 && (
                            <div className="px-3 pb-2 flex flex-wrap gap-1">
                                {ch.participants.map(p => (
                                    <div key={p.userId}
                                         className="flex items-center gap-1 bg-slate-700/50 rounded-full px-2 py-0.5"
                                         title={p.fullName}>
                                        <Mic className="w-2.5 h-2.5 text-green-400" />
                                        <span className="text-xs text-slate-300 max-w-[80px] truncate">{p.fullName}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
