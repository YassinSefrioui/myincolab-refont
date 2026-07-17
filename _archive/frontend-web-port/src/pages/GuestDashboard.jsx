import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
    FolderOpen, MessageSquare, FileText, Download, Upload,
    Send, Loader2, X, Trash2, LogOut,
    Users, Calendar, AlertTriangle, BookOpen, Languages,
    Phone, Paperclip, Link as LinkIcon
} from 'lucide-react'
import api from '../api/axios'
import useAuthStore from '../store/authStore'
import useSocketStore from '../store/socketStore'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import gsap from 'gsap'
import MeetingModal from '../components/Meetingmodal.jsx'
import CallLinkGenerator from '../components/CallLinkGenerator.jsx'
import VoiceChannelsPanel from '../components/VoiceChannelsPanel.jsx'
import VoiceChannelSession from '../components/VoiceChannelSession.jsx'
import ParticleBackground from '../components/ParticleBackground.jsx'

const getMediaUrl = (url) => {
    if (!url) return url
    const token = localStorage.getItem('token')
    if (!token) return url
    const sep = url.includes('?') ? '&' : '?'
    return `${url}${sep}t=${token}`
}

const LANG_CODE = { en:'en', fr:'fr', es:'es', zh:'zh', it:'it', EN:'en', FR:'fr', ES:'es', ZH:'zh', IT:'it' }

async function translateText(text, targetLang) {
    const lang = LANG_CODE[targetLang] || 'en'
    try {
        const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${lang}`)
        const data = await res.json()
        if (data.responseStatus === 200 && data.responseData?.translatedText) return data.responseData.translatedText
        throw new Error()
    } catch {
        const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(text)}`)
        const data = await res.json()
        return data?.[0]?.map(i => i?.[0]).filter(Boolean).join('') || text
    }
}

export default function GuestDashboard() {
    const { t } = useTranslation()
    const { user, logout } = useAuthStore()
    const navigate = useNavigate()
    const pageRef  = useRef(null)

    const { connect, disconnect, incomingCall, activeCall, acceptCall, rejectCall, endCall } = useSocketStore()
    const [guestGroupCall, setGuestGroupCall] = useState(null) // { mode, roomId }

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
        }, pageRef)
        return () => ctx.revert()
    }, [])

    // Connect socketStore for incoming call support
    useEffect(() => {
        if (!user) return
        const token = localStorage.getItem('token') ||
            JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.token
        const userId = user?.id || user?.userId
        const companyId = user?.companyId
        if (!token || !userId) return
        connect(token, userId, companyId, null, null)
        return () => disconnect()
    }, [user?.id])

    const [projects, setProjects]   = useState([])
    const [selected, setSelected]   = useState(null)
    const [tab, setTab]             = useState('chat')
    const [loading, setLoading]     = useState(true)

    const targetLang = user?.preferredLanguage || 'EN'
    const userId     = user?.id || user?.userId

    useEffect(() => {
        api.get('/projects')
            .then(r => {
                const list = r.data.data || []
                setProjects(list)
                if (list.length === 1) setSelected(list[0])
            })
            .catch(() => toast.error('Failed to load projects'))
            .finally(() => setLoading(false))
    }, [])

    const handleLogout = async () => {
        try { await api.post('/auth/logout') } catch {}
        disconnect()
        logout()
        navigate('/login')
    }

    if (loading) return (
        <div className="flex items-center justify-center h-screen bg-slate-900">
            <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
        </div>
    )

    return (
        <div ref={pageRef} className="flex h-screen bg-slate-900 text-white overflow-hidden" style={{ position: 'relative' }}>
            <ParticleBackground />

            {/* Sidebar */}
            <aside className="w-64 bg-slate-800/50 border-r border-slate-700/50 flex flex-col">
                <div className="p-5 border-b border-slate-700/50">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
                            <span className="text-white font-bold text-sm">IL</span>
                        </div>
                        <div>
                            <h1 className="font-bold text-white text-sm">INCO LAB</h1>
                            <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full font-medium">{t('guestDashboard.guestAccess')}</span>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 truncate">{user?.fullName}</p>
                </div>

                <div className="flex-1 p-3 overflow-y-auto">
                    <p className="text-xs text-slate-500 px-2 mb-2 uppercase tracking-wider font-medium">{t('guestDashboard.yourProjects')}</p>
                    {projects.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                            <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-20" />
                            <p className="text-xs">{t('guestDashboard.noProjectsAssigned')}</p>
                        </div>
                    ) : projects.map(p => (
                        <button key={p.id} onClick={() => { setSelected(p); setTab('chat') }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left mb-1 ${
                                selected?.id === p.id
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                            }`}>
                            <FolderOpen className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{p.name}</span>
                        </button>
                    ))}
                </div>

                <div className="p-4 border-t border-slate-700/50">
                    <button onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all">
                        <LogOut className="w-4 h-4" />
                        {t('guestDashboard.signOut')}
                    </button>
                </div>
            </aside>

            {/* Main */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {selected ? (
                    <>
                        <div className="p-5 border-b border-slate-700/50 bg-slate-800/30 flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-xl font-bold text-white">{selected.name}</h1>
                                    <p className="text-slate-400 text-sm mt-0.5">{selected.description || 'No description'}</p>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <Users className="w-3.5 h-3.5" />
                                    {selected.members?.length || 0} members
                                    {selected.endDate && (
                                        <>
                                            <Calendar className="w-3.5 h-3.5 ml-2" />
                                            {new Date(selected.endDate).toLocaleDateString()}
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-1 mt-4 flex-wrap">
                                {[
                                    { key: 'chat',      label: t('guestDashboard.chat'),      icon: MessageSquare },
                                    { key: 'files',     label: t('guestDashboard.files'),     icon: FileText      },
                                    { key: 'issues',    label: t('guestDashboard.issues'),    icon: AlertTriangle },
                                    { key: 'decisions', label: t('guestDashboard.decisions'), icon: BookOpen      },
                                    { key: 'calls',     label: t('guestDashboard.calls'),     icon: Phone         },
                                ].map(({ key, label, icon: Icon }) => (
                                    <button key={key} onClick={() => setTab(key)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                                            tab === key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                        }`}>
                                        <Icon className="w-4 h-4" />{label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={`flex-1 ${tab === 'chat' ? 'overflow-hidden' : 'overflow-y-auto p-6'}`}>
                            {tab === 'chat'      && <GuestGroupChat project={selected} targetLang={targetLang} />}
                            {tab === 'files'     && <GuestFileHub projectId={selected.id} />}
                            {tab === 'issues'    && <GuestIssuesList projectId={selected.id} />}
                            {tab === 'decisions' && <GuestDecisionsList projectId={selected.id} />}
                            {tab === 'calls'     && (
                                <GuestCallsTab
                                    project={selected}
                                    onStartGroupCall={(mode, roomId) => setGuestGroupCall({ mode, roomId })}
                                />
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                        <FolderOpen className="w-16 h-16 mb-4 opacity-20" />
                        <p className="text-lg font-medium">{t('guestDashboard.selectProject')}</p>
                        <p className="text-sm mt-1">{t('guestDashboard.chooseProjectFromSidebar')}</p>
                    </div>
                )}
            </div>

            {/* Incoming P2P call popup */}
            {incomingCall && !activeCall && (
                <GuestCallPopup
                    call={incomingCall}
                    onAccept={() => acceptCall(incomingCall)}
                    onDecline={() => rejectCall(incomingCall)}
                />
            )}

            {/* Active P2P call */}
            {activeCall && !guestGroupCall && (
                <MeetingModal
                    roomId={`call-${[String(userId), String(activeCall.remoteUser?.id)].sort().join('-')}`}
                    mode={activeCall.mode}
                    remoteUser={activeCall.remoteUser}
                    onClose={() => endCall()}
                />
            )}

            {/* Group call (legacy, kept for P2P incoming calls) */}
            {guestGroupCall && (
                <MeetingModal
                    roomId={guestGroupCall.roomId}
                    mode={guestGroupCall.mode}
                    remoteUser={null}
                    onClose={() => setGuestGroupCall(null)}
                />
            )}

            {/* Voice channel session bar */}
            <VoiceChannelSession />
        </div>
    )
}

// ─── Guest Group Chat ─────────────────────────────────────────────────────────

function GuestGroupChat({ project, targetLang }) {
    const { t }       = useTranslation()
    const { user }    = useAuthStore()
    const [conv, setConv]         = useState(null)
    const [messages, setMessages] = useState([])
    const [input, setInput]       = useState('')
    const [loading, setLoading]   = useState(true)
    const [sending, setSending]   = useState(false)
    const [uploading, setUploading] = useState(false)
    const bottomRef = useRef(null)
    const stompRef  = useRef(null)
    const fileRef   = useRef(null)
    const userId    = user?.id || user?.userId

    useEffect(() => {
        const load = async () => {
            try {
                const res = await api.get(`/chat/conversations/project/${project.id}`)
                const c = res.data.data
                setConv(c)
                const msgs = await api.get(`/chat/conversations/${c.id}/messages`)
                setMessages((msgs.data.data || []).reverse())
            } catch { toast.error('Failed to load chat') }
            finally { setLoading(false) }
        }
        load()
    }, [project.id])

    useEffect(() => {
        if (!conv) return
        const token = localStorage.getItem('token') ||
            JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.token
        const client = new Client({
            webSocketFactory: () => new SockJS(`${window.location.protocol}//${window.location.host}/ws`),
            connectHeaders: { Authorization: `Bearer ${token}` },
            onConnect: () => {
                client.subscribe(`/topic/conversation/${conv.id}`, msg => {
                    const m = JSON.parse(msg.body)
                    setMessages(prev => prev.find(x => x.id === m.id) ? prev : [...prev, m])
                })
            },
            onStompError: () => {}
        })
        client.activate()
        stompRef.current = client
        return () => client.deactivate()
    }, [conv?.id])

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

    const handleSend = async () => {
        if (!input.trim() || !conv || sending) return
        setSending(true)
        try {
            await api.post(`/chat/conversations/${conv.id}/messages`, { content: input.trim(), messageType: 'TEXT' })
            setInput('')
        } catch { toast.error('Failed to send') }
        finally { setSending(false) }
    }

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file || !conv) return
        if (file.size > 50 * 1024 * 1024) { toast.error('File too large (max 50MB)'); return }
        setUploading(true)
        try {
            const fd = new FormData()
            fd.append('file', file)
            await api.post(`/chat/conversations/${conv.id}/upload`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
        } catch (err) { toast.error(err.response?.data?.message || 'Upload failed') }
        finally { setUploading(false); e.target.value = '' }
    }

    if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin w-6 h-6 text-blue-500" /></div>

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-700/30 flex-shrink-0">
                <MessageSquare className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-slate-300 font-medium">{t('guestDashboard.groupChat')} — {project.name}</span>
                <span className="ml-auto text-xs text-slate-500">{conv?.participants?.length || 0} participants</span>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500">
                        <MessageSquare className="w-10 h-10 mb-3 opacity-20" />
                        <p>{t('guestDashboard.noMessagesYet')}</p>
                    </div>
                ) : messages.map(msg => (
                    <GuestMessageBubble
                        key={msg.id}
                        msg={msg}
                        isOwn={String(msg.sender?.id) === String(userId)}
                        targetLang={targetLang}
                        onDelete={async id => {
                            try {
                                await api.delete(`/chat/messages/${id}`)
                                setMessages(prev => prev.map(m => m.id === id ? { ...m, isDeleted: true, content: null } : m))
                            } catch { toast.error('Cannot delete') }
                        }}
                    />
                ))}
                <div ref={bottomRef} />
            </div>

            <div className="px-6 py-4 border-t border-slate-700/50 flex-shrink-0">
                <input ref={fileRef} type="file" className="hidden" onChange={handleFileUpload}
                       accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.csv" />
                <div className="flex items-end gap-3">
                    <button onClick={() => fileRef.current?.click()} disabled={uploading}
                        className="p-2.5 rounded-xl text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 transition-all flex-shrink-0 border border-slate-600/50"
                        title={t('guestDashboard.attachFile')}>
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                    </button>
                    <div className="flex-1 bg-slate-800 border border-slate-600/50 rounded-2xl px-4 py-3 focus-within:border-blue-500/50 transition-colors">
                        <textarea rows={1} value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                            placeholder={`Message ${project.name}...`}
                            className="w-full bg-transparent text-white placeholder-slate-500 text-sm resize-none focus:outline-none"
                            style={{ maxHeight: '100px' }} />
                    </div>
                    <button onClick={handleSend} disabled={!input.trim() || sending}
                        className="w-10 h-10 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed flex items-center justify-center transition-all flex-shrink-0">
                        {sending ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
                    </button>
                </div>
            </div>
        </div>
    )
}

function GuestMessageBubble({ msg, isOwn, targetLang, onDelete }) {
    const [showActions, setShowActions] = useState(false)
    const [translation, setTranslation] = useState(null)
    const [translating, setTranslating] = useState(false)

    if (msg.isDeleted) return (
        <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
            <p className="text-xs text-slate-600 italic px-3 py-1.5">Message deleted</p>
        </div>
    )

    const handleTranslate = async () => {
        if (translation) { setTranslation(null); return }
        if (!msg.content?.trim()) return
        setTranslating(true)
        try { setTranslation(await translateText(msg.content, targetLang)) }
        catch { toast.error('Translation failed') }
        finally { setTranslating(false) }
    }

    const isImage = msg.messageType === 'IMAGE'
    const isFile  = msg.messageType === 'FILE'
    const isMedia = isImage || isFile

    return (
        <div className={`flex gap-2.5 group ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
            onMouseEnter={() => setShowActions(true)} onMouseLeave={() => setShowActions(false)}>
            {!isOwn && (
                <div className="w-7 h-7 rounded-full bg-blue-600/30 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-blue-400 text-xs font-bold">{msg.sender?.fullName?.charAt(0)}</span>
                </div>
            )}
            <div className={`flex flex-col gap-1 max-w-xs lg:max-w-md ${isOwn ? 'items-end' : 'items-start'}`}>
                {!isOwn && <span className="text-xs text-slate-500 px-1">{msg.sender?.fullName}</span>}
                <div className={`px-4 py-2.5 rounded-2xl text-sm ${isOwn ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-slate-700/80 text-slate-100 rounded-tl-sm'}`}>
                    {msg.isPinned && <span className="text-xs opacity-60 block mb-1">📌 Pinned</span>}
                    {isImage ? (
                        <div className="cursor-zoom-in"
                             onClick={() => window.dispatchEvent(new CustomEvent('preview-img', { detail: getMediaUrl(msg.fileUrl) }))}>
                            <img src={getMediaUrl(msg.fileUrl)} alt=""
                                 className="rounded-xl object-cover hover:opacity-90 transition-opacity"
                                 style={{ maxWidth: '280px', maxHeight: '280px', width: '100%', display: 'block' }} />
                        </div>
                    ) : isFile ? (
                        <a href={getMediaUrl(msg.fileUrl)} target="_blank" rel="noreferrer"
                           className="flex items-center gap-2 hover:opacity-90 transition-opacity">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isOwn ? 'bg-white/20' : 'bg-blue-600/30'}`}>
                                <Paperclip className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{msg.fileName || 'File'}</p>
                                {msg.fileSize && <p className="text-xs opacity-70">{(msg.fileSize / 1024).toFixed(1)} KB</p>}
                            </div>
                        </a>
                    ) : (
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    )}
                </div>
                {translation && (
                    <div className={`relative px-3 py-2 rounded-xl text-xs border ${isOwn ? 'bg-blue-500/20 border-blue-500/30 text-blue-100' : 'bg-slate-600/40 border-slate-600/50 text-slate-200'}`}>
                        <div className="flex items-center gap-1 mb-1 opacity-70">
                            <Languages className="w-3 h-3" />
                            <span className="font-semibold uppercase">{LANG_CODE[targetLang]?.toUpperCase() || 'EN'}</span>
                        </div>
                        <p>{translation}</p>
                        <button onClick={() => setTranslation(null)} className="absolute top-1.5 right-1.5 opacity-50 hover:opacity-100">
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                )}
                <span className="text-xs text-slate-600 px-1">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>
            {showActions && !isMedia && (
                <div className={`flex items-center gap-0.5 self-center ${isOwn ? 'order-first' : ''}`}>
                    {msg.content && (
                        <button onClick={handleTranslate} disabled={translating}
                            className={`p-1.5 rounded-lg transition-all ${translation ? 'bg-blue-600/30 text-blue-400' : 'bg-slate-700/80 hover:bg-slate-600 text-slate-400 hover:text-blue-400'}`}
                            title="Translate">
                            {translating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Languages className="w-3 h-3" />}
                        </button>
                    )}
                    {isOwn && (
                        <button onClick={() => onDelete(msg.id)}
                            className="p-1.5 rounded-lg bg-slate-700/80 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all">
                            <Trash2 className="w-3 h-3" />
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

// ─── Guest Calls Tab ──────────────────────────────────────────────────────────

function GuestCallsTab({ project, onStartGroupCall }) {
    const { t } = useTranslation()
    const [showLinkGen, setShowLinkGen] = useState(false)

    return (
        <div className="space-y-5">
            {/* Voice channels */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-white mb-1">{t('guestDashboard.voiceChannels')}</h3>
                <p className="text-xs text-slate-400 mb-4">Join or create a voice/video channel for {project.name}</p>
                <VoiceChannelsPanel type="PROJECT" id={project.id} defaultMode="audio" />
            </div>

            {/* Shareable call link */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-white mb-1">{t('guestDashboard.shareableCallLink')}</h3>
                <p className="text-xs text-slate-400 mb-4">Generate a link anyone can use to join a call — no account needed</p>
                <button onClick={() => setShowLinkGen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-all">
                    <LinkIcon className="w-4 h-4" /> {t('guestDashboard.generateLink')}
                </button>
            </div>

            {showLinkGen && <CallLinkGenerator onClose={() => setShowLinkGen(false)} />}
        </div>
    )
}

// ─── Guest Incoming Call Popup ────────────────────────────────────────────────

function GuestCallPopup({ call, onAccept, onDecline }) {
    const { t }       = useTranslation()
    const displayName = call.remoteUser?.fullName || 'Incoming call'
    const isVideo     = call.mode === 'video'
    const accent      = isVideo ? '#5865f2' : '#3ba55c'

    return (
        <div style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 99999, width: 280,
            borderRadius: 16, overflow: 'hidden',
            background: 'rgba(30,33,36,0.97)', backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}>
            <div style={{ height: 3, background: accent }} />
            <div style={{ padding: '16px 18px' }}>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600,
                    letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>INCOLAB</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: accent,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 800, fontSize: 18, flexShrink: 0 }}>
                        {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p style={{ color: '#fff', fontWeight: 700, fontSize: 15, margin: '0 0 3px' }}>{displayName}</p>
                        <p style={{ color: accent, fontSize: 12, fontWeight: 600, margin: 0 }}>
                            {isVideo ? `📹 ${t('guestDashboard.videoCall')}` : `📞 ${t('guestDashboard.voiceCall')}`}
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={onDecline} style={{
                        flex: 1, height: 38, borderRadius: 10, border: 'none',
                        background: '#ed4245', color: '#fff', fontWeight: 700, fontSize: 13,
                        cursor: 'pointer', fontFamily: 'inherit'
                    }}>{t('guestDashboard.decline')}</button>
                    <button onClick={onAccept} style={{
                        flex: 1, height: 38, borderRadius: 10, border: 'none',
                        background: '#3ba55c', color: '#fff', fontWeight: 700, fontSize: 13,
                        cursor: 'pointer', fontFamily: 'inherit'
                    }}>{t('guestDashboard.accept')}</button>
                </div>
            </div>
        </div>
    )
}

// ─── Guest File Hub ───────────────────────────────────────────────────────────

function GuestFileHub({ projectId }) {
    const { t } = useTranslation()
    const [files, setFiles]   = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        api.get(`/files/project/${projectId}`)
            .then(r => setFiles(r.data.data || []))
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [projectId])

    const handleDownload = async (fileId, fileName) => {
        try {
            const res = await api.get(`/files/${fileId}/download`, { responseType: 'blob' })
            const url = window.URL.createObjectURL(new Blob([res.data]))
            const a = document.createElement('a'); a.href = url; a.download = fileName; a.click()
            window.URL.revokeObjectURL(url)
        } catch { toast.error('Download failed') }
    }

    const getIcon = t => {
        if (!t) return '📄'
        if (t.includes('image')) return '🖼️'
        if (t.includes('pdf')) return '📕'
        if (t.includes('word')||t.includes('document')) return '📝'
        if (t.includes('sheet')||t.includes('excel')) return '📊'
        if (t.includes('video')) return '🎬'
        return '📄'
    }
    const fmtSize = b => { if(!b) return '—'; if(b<1024) return b+' B'; if(b<1024*1024) return (b/1024).toFixed(1)+' KB'; return (b/1024/1024).toFixed(1)+' MB' }

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin w-6 h-6 text-blue-500" /></div>

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-400">{files.length} files</span>
            </div>

            {files.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p>{t('guestDashboard.noFilesYet')}</p>
                </div>
            ) : files.map(file => (
                <div key={file.id} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 flex items-center gap-4">
                    <div className="text-2xl flex-shrink-0">{getIcon(file.mimeType)}</div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{file.originalName}</p>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                            <span>{fmtSize(file.fileSize)}</span>
                            <span>v{file.version || 1}</span>
                            {file.uploadedBy && <span>by {file.uploadedBy.fullName}</span>}
                            <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <button onClick={() => handleDownload(file.id, file.originalName)}
                        className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all flex-shrink-0" title={t('guestDashboard.download')}>
                        <Download className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    )
}

// ─── Guest Issues ─────────────────────────────────────────────────────────────

const SEVERITY_COLOR = {
    LOW: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
    MEDIUM: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    HIGH: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
    CRITICAL: 'text-red-400 bg-red-400/10 border-red-400/20',
}
const ISSUE_STATUS_COLOR = {
    OPEN: 'text-red-400 bg-red-400/10',
    IN_PROGRESS: 'text-amber-400 bg-amber-400/10',
    RESOLVED: 'text-emerald-400 bg-emerald-400/10',
    CLOSED: 'text-slate-400 bg-slate-400/10',
}

function GuestIssuesList({ projectId }) {
    const { t } = useTranslation()
    const [issues, setIssues] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        api.get(`/issues/project/${projectId}`)
            .then(r => setIssues(r.data.data || []))
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [projectId])

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin w-6 h-6 text-blue-500" /></div>

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-400">{issues.length} issues — read only</span>
            </div>
            {issues.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                    <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p>{t('guestDashboard.noIssuesLogged')}</p>
                </div>
            ) : issues.map(issue => (
                <div key={issue.id} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${SEVERITY_COLOR[issue.severity]}`}>{issue.severity}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ISSUE_STATUS_COLOR[issue.status]}`}>{issue.status?.replace('_', ' ')}</span>
                            </div>
                            <p className="text-sm font-medium text-white">{issue.title}</p>
                            {issue.description && <p className="text-xs text-slate-400 mt-1">{issue.description}</p>}
                        </div>
                        <span className="text-xs text-slate-500 flex-shrink-0">{new Date(issue.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>
            ))}
        </div>
    )
}

// ─── Guest Decisions ──────────────────────────────────────────────────────────

function GuestDecisionsList({ projectId }) {
    const { t } = useTranslation()
    const [decisions, setDecisions] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        api.get(`/decisions/project/${projectId}`)
            .then(r => setDecisions(r.data.data || []))
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [projectId])

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin w-6 h-6 text-blue-500" /></div>

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-400">{decisions.length} decisions — read only</span>
            </div>
            {decisions.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                    <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p>{t('guestDashboard.noDecisionsLogged')}</p>
                </div>
            ) : decisions.map(dec => (
                <div key={dec.id} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
                    <p className="text-sm font-semibold text-white mb-1">{dec.title}</p>
                    <p className="text-xs text-slate-300 mb-2">{dec.decision}</p>
                    {dec.rationale && <p className="text-xs text-slate-500 italic">{dec.rationale}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        {dec.madeBy && <span>By {dec.madeBy.fullName}</span>}
                        <span>{new Date(dec.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>
            ))}
        </div>
    )
}
