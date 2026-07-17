import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, Phone, Video, X, Users, Mic, CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../store/authStore'
import useVoiceStore from '../store/voiceStore'
import toast from 'react-hot-toast'
import gsap from 'gsap'

export default function CallLinkPage() {
    const { t } = useTranslation()
    const { linkId } = useParams()
    const { isAuthenticated, user, login } = useAuthStore()
    const { joinChannel: joinVoiceChannel, activeChannel } = useVoiceStore()
    const pageRef = useRef(null)

    const [link,        setLink]        = useState(null)
    const [loadingLink, setLoadingLink] = useState(true)
    const [error,       setError]       = useState(null)
    const [displayName, setDisplayName] = useState('')
    const [joining,     setJoining]     = useState(false)
    const [joined,      setJoined]      = useState(false)
    const [channelInfo, setChannelInfo] = useState(null)

    useEffect(() => {
        if (!pageRef.current) return
        gsap.fromTo(pageRef.current,
            { opacity: 0, y: 24 },
            { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }
        )
    }, [])

    useEffect(() => {
        fetch(`/api/call-links/${linkId}/metadata`)
            .then(r => r.json())
            .then(d => {
                if (d.success) setLink(d.data)
                else setError(d.message || 'Link not found or expired')
            })
            .catch(() => setError('Failed to load call link'))
            .finally(() => setLoadingLink(false))
    }, [linkId])

    // Authenticated user: join voice channel directly via voiceStore
    const handleAuthJoin = async () => {
        if (!link) return
        setJoining(true)
        try {
            const token = JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.token
                || localStorage.getItem('token')
            const info = await joinVoiceChannel(
                'LINK', null, null,
                link.mode === 'video' ? 'Video Call' : 'Voice Call',
                link.mode || 'audio',
                link.roomId,
                token
            )
            setChannelInfo(info)
            setJoined(true)
            toast.success('Joined voice channel!')
        } catch (e) {
            toast.error(e.message || 'Failed to join')
        } finally {
            setJoining(false)
        }
    }

    // Guest: backend handles EVERYTHING in one call — creates user, session, joins channel
    const handleGuestJoin = async () => {
        if (!displayName.trim()) { toast.error('Please enter your name'); return }
        setJoining(true)
        try {
            const r = await fetch(`/api/call-links/${linkId}/guest-join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ displayName: displayName.trim() })
            })
            const d = await r.json()
            if (!d.success) throw new Error(d.message || 'Failed to join')

            const { token, roomId, channelId, channelName, mode, participants, ...userData } = d.data

            // Store auth for potential future calls
            login(token, { ...userData, userId: userData.userId })

            // Voice channel already joined on the backend — just update local state
            // so the voice bar shows in the UI
            useVoiceStore.setState({
                activeChannel: {
                    roomId,
                    channelId,
                    channelName: channelName || (mode === 'video' ? 'Video Call' : 'Voice Call'),
                    mode: mode || 'audio',
                    type: 'LINK',
                    projectId: null,
                    conversationId: null,
                }
            })

            setChannelInfo({ roomId, channelId, channelName, mode, participants })
            setJoined(true)
            toast.success('Joined voice channel!')
        } catch (e) {
            toast.error(e.message || 'Failed to join')
        } finally {
            setJoining(false)
        }
    }

    if (loadingLink) return (
        <div className="flex items-center justify-center h-screen bg-slate-900">
            <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
        </div>
    )

    if (error) return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
                <X className="w-8 h-8 text-red-400" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">{t('callLink.linkUnavailable')}</h1>
            <p className="text-slate-400 max-w-sm text-sm">{error}</p>
        </div>
    )

    const isVideo = link?.mode === 'video'

    if (joined || activeChannel) return (
        <div className="flex items-center justify-center h-screen bg-slate-900">
            <div ref={pageRef} className="w-full max-w-sm px-6 text-center">
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5 ${isVideo ? 'bg-blue-600/20 border border-blue-500/30' : 'bg-emerald-600/20 border border-emerald-500/30'}`}>
                    <CheckCircle2 className={`w-10 h-10 ${isVideo ? 'text-blue-400' : 'text-emerald-400'}`} />
                </div>
                <h1 className="text-xl font-bold text-white mb-2">{t('callLink.youInTheChannel')}</h1>
                <p className="text-slate-400 text-sm mb-1">
                    {t('callLink.joined')} <span className="text-white font-medium">
                        {channelInfo?.channelName || activeChannel?.channelName || (isVideo ? 'Video Call' : 'Voice Call')}
                    </span>
                </p>
                {channelInfo?.participants?.length > 0 && (
                    <p className="text-xs text-slate-500 mt-2">
                        {channelInfo.participants.length} {t('callLink.participantInChannel')}
                    </p>
                )}
                <div className="mt-6 flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-800/60 border border-slate-700/40">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs text-emerald-400 font-medium">{t('callLink.voiceChannelActive')}</span>
                </div>
            </div>
        </div>
    )

    return (
        <div className="flex items-center justify-center h-screen bg-slate-900">
            <div ref={pageRef} className="w-full max-w-md px-6">
                <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden">
                    <div className={`h-1 ${isVideo ? 'bg-blue-500' : 'bg-emerald-500'}`} />

                    <div className="p-8">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
                                <span className="text-white font-bold text-sm">IL</span>
                            </div>
                            <div>
                                <h1 className="font-bold text-white text-sm">INCO LAB</h1>
                                <p className="text-xs text-slate-400">{t('callLink.youveBeenInvited')}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 p-4 bg-slate-900/50 rounded-xl border border-slate-700/30 mb-6">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isVideo ? 'bg-blue-600/20' : 'bg-emerald-600/20'}`}>
                                {isVideo ? <Video className="w-6 h-6 text-blue-400" /> : <Mic className="w-6 h-6 text-emerald-400" />}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-white">
                                    {isVideo ? t('callLink.videoChannel') : t('callLink.voiceChannel')}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                                    <Users className="w-3 h-3" /> {t('callLink.joinSameChannelAsSender')}
                                </p>
                                {link?.expiresAt && (
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {t('callLink.expires')} {new Date(link.expiresAt).toLocaleString()}
                                    </p>
                                )}
                            </div>
                        </div>

                        {isAuthenticated ? (
                            <div className="space-y-3">
                                <p className="text-xs text-slate-400 text-center">
                                    {t('callLink.joiningAs')} <span className="text-white font-medium">{user?.fullName}</span>
                                </p>
                                <button onClick={handleAuthJoin} disabled={joining}
                                        className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 text-white ${isVideo ? 'bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700' : 'bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700'}`}>
                                    {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : isVideo ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                                    {joining ? t('callLink.joining') : t('callLink.joinVoiceChannel')}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1.5">{t('callLink.yourName')}</label>
                                    <input
                                        value={displayName}
                                        onChange={e => setDisplayName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleGuestJoin()}
                                        placeholder={t('callLink.enterDisplayName')}
                                        autoFocus
                                        className="w-full bg-slate-900/50 border border-slate-600/50 rounded-xl py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    />
                                </div>
                                <button onClick={handleGuestJoin}
                                        disabled={joining || !displayName.trim()}
                                        className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 text-white disabled:cursor-not-allowed ${isVideo ? 'bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700' : 'bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700'}`}>
                                    {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : isVideo ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                                    {joining ? t('callLink.joining') : t('callLink.joinVoiceChannel')}
                                </button>
                                <p className="text-xs text-slate-500 text-center">{t('callLink.noAccountNeeded')}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
