import { useEffect, useState, useRef, useCallback, useMemo } from 'react'

// Charge une URL protégée via fetch + Authorization header → Blob URL
// Évite d'exposer le token JWT dans l'URL (logs serveur, historique, Referer)
function useAuthImage(url) {
    const [src, setSrc] = useState(null)
    useEffect(() => {
        if (!url) return
        let objectUrl = null
        const token = JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.token
            || localStorage.getItem('token')
        fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
            .then(r => r.ok ? r.blob() : null)
            .then(blob => {
                if (blob) {
                    objectUrl = URL.createObjectURL(blob)
                    setSrc(objectUrl)
                }
            })
            .catch(() => {})
        return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
    }, [url])
    return src
}

const getMediaUrl = (url) => url  // plus de ?t= — le fetch dans useAuthImage gère l'auth
import { Search, Send, Pin, Trash2, MessageSquare, Loader2, Languages, X,
    Paperclip, AtSign, Volume2, Video, UserPlus, BellOff, Archive, MoreVertical, Sparkles, CalendarPlus, Upload, Link as LinkIcon, Users, Phone, Pencil, Reply, FolderOpen, Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/axios'
import useAuthStore from '../store/authStore'
import toast from 'react-hot-toast'
import useSocketStore from '../store/socketStore'
import { getAvatarUrl } from '../utils/avatarUrl'
import gsap from 'gsap'
import MeetingModal from '../components/Meetingmodal.jsx'
import useSoundNotification from '../hooks/useSoundNotification.js'
import UserProfileModal from '../components/UserProfileModal.jsx'
import CallLinkGenerator from '../components/CallLinkGenerator.jsx'
import useVoiceStore from '../store/voiceStore'

const LANG_CODE = { en:'en',fr:'fr',es:'es',zh:'zh',it:'it', EN:'en',FR:'fr',ES:'es',ZH:'zh',IT:'it' }

async function translateText(text, targetLang) {
    const lang = LANG_CODE[targetLang] || 'en'
    try {
        const res  = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${lang}`)
        const data = await res.json()
        if (data.responseStatus === 200 && data.responseData?.translatedText) return data.responseData.translatedText
        throw new Error()
    } catch {
        const res  = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(text)}`)
        const data = await res.json()
        const t    = data?.[0]?.map(i => i?.[0]).filter(Boolean).join('')
        if (t) return t
        throw new Error('Translation failed')
    }
}

const PRESENCE_COLOR = { ONLINE:'text-emerald-400', AWAY:'text-amber-400', BUSY:'text-red-400', OFFLINE:'text-slate-500' }
const PRESENCE_DOT   = { ONLINE:'bg-emerald-400',   AWAY:'bg-amber-400',   BUSY:'bg-red-400',   OFFLINE:'bg-slate-600' }

export default function ChatPage() {
    const { t, i18n } = useTranslation()
    const { user }    = useAuthStore()
    const location      = useLocation()
    const [searchParams] = useSearchParams()
    const userIdRef   = useRef(null)
    const sounds      = useSoundNotification()
    const pageRef     = useRef(null)
    useEffect(() => {
        if (!pageRef.current) return
        const ctx = gsap.context(() => {
            gsap.fromTo(pageRef.current,
                { opacity: 0 },
                { opacity: 1, duration: 0.35, ease: 'power2.out' }
            )
            // Sidebar conversation list stagger
            setTimeout(() => {
                const convItems = pageRef.current.querySelectorAll('[class*="border-b"] > button')
                if (convItems.length) {
                    gsap.fromTo(convItems,
                        { opacity: 0, x: -14 },
                        { opacity: 1, x: 0, duration: 0.25, stagger: 0.03, ease: 'power2.out', clearProps: 'transform' }
                    )
                }
            }, 200)
        }, pageRef)
        return () => ctx.revert()
    }, [])

    const [conversations, setConversations] = useState([])
    const [users, setUsers]                 = useState([])
    const [selected, setSelected]           = useState(null)
    const [messages, setMessages]           = useState([])
    const [input, setInput]                 = useState('')
    const [search, setSearch]               = useState('')
    const [loading, setLoading]             = useState(true)
    const [sending, setSending]             = useState(false)
    const [uploading]                        = useState(false)  // kept for UI compat
    const [readBy, setReadBy]               = useState({})
    const [onlineUsers, setOnlineUsers]     = useState({})
    const [isMobile, setIsMobile]           = useState(window.innerWidth < 768)
    const [contextMenu, setContextMenu]     = useState(null)  // { convId, x, y }
    const [profileUser, setProfileUser]     = useState(null)

    useEffect(() => {
        const closeMenu = () => setContextMenu(null)
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu() })
        return () => document.removeEventListener('keydown', closeMenu)
    }, [])

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [])

    // New conversation search
    const [newChatSearch, setNewChatSearch] = useState('')
    const [showNewChat,   setShowNewChat]   = useState(false)

    // Typing indicator
    const [typingUsers,     setTypingUsers]     = useState([])  // [{id, fullName}]
    const typingTimerRef    = useRef(null)
    const isTypingRef       = useRef(false)

    // @mentions autocomplete
    const [mentionQuery,    setMentionQuery]    = useState('')
    const [mentionResults,  setMentionResults]  = useState([])
    const [showMentions,    setShowMentions]    = useState(false)
    const [mentionedIds,    setMentionedIds]    = useState([])
    const [mentionCursorAt, setMentionCursorAt] = useState(-1)

    const [isDragging, setIsDragging] = useState(false)
    const [stagedFiles, setStagedFiles] = useState([])  // files staged from drag/paste/select
    const [replyingTo, setReplyingTo] = useState(null)  // message being replied to
    const [showOriginal, setShowOriginal] = useState(false)  // global toggle: show original vs translated
    const [showMembers, setShowMembers] = useState(false)
    const [showSharedFiles, setShowSharedFiles] = useState(false)

    // Group edit
    const [showGroupEdit,    setShowGroupEdit]    = useState(false)
    const [groupEditName,    setGroupEditName]    = useState('')
    const [groupEditSaving,  setGroupEditSaving]  = useState(false)
    const [groupAddSearch,   setGroupAddSearch]   = useState('')
    const [groupAddSaving,   setGroupAddSaving]   = useState(false)

    // Group chat creation
    const [showGroupModal, setShowGroupModal] = useState(false)
    const [groupForm, setGroupForm]           = useState({ name: '', memberIds: [] })
    const [creatingGroup, setCreatingGroup]   = useState(false)

    const bottomRef      = useRef(null)
    const inputRef       = useRef(null)
    const fileRef        = useRef(null)
    const dragCounter    = useRef(0)

    const convSubRef      = useRef(null)   // conversation unsubscribe fn
    const selectedIdRef   = useRef(null)   // track selected conversation ID

    const targetLang  = user?.preferredLanguage || i18n.language || 'en'
    const userId      = user?.id || user?.userId
    const isAdmin     = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
    const canManageConv = (conv) => isAdmin || String(conv?.createdByUserId) === String(userId) || String(conv?.createdBy?.id) === String(userId) || String(conv?.creatorId) === String(userId)

    useEffect(() => { userIdRef.current = userId }, [userId])
    useEffect(() => { selectedIdRef.current = selected?.id }, [selected?.id])

    // ── Use global socketStore (connected in Layout.jsx) ────────────────────
    const { subscribeToConversation, connected: stompConnected } = useSocketStore()
    const { joinChannel: joinVoiceChannel } = useVoiceStore()

    // Listen for presence updates broadcast by socketStore
    useEffect(() => {
        const handler = e => {
            const update = e.detail
            setOnlineUsers(prev => ({ ...prev, [update.userId]: update.presenceStatus }))
        }
        window.addEventListener('presence-update', handler)
        return () => window.removeEventListener('presence-update', handler)
    }, [])

    // ── Global new-message listener ───────────────────────────────────────────
    // Fired by socketStore when ANY message arrives in any conversation.
    // Updates unread count + moves conversation to top + bold — even when
    // the user is on another page or looking at a different conversation.
    useEffect(() => {
        const handler = e => {
            const newMsg = e.detail
            const convId = newMsg.conversationId
            if (!convId) return
            const myId = userIdRef.current

            // Only update if sender is NOT us
            if (String(newMsg.sender?.id) === String(myId)) return

            setConversations(prev => {
                const conv = prev.find(c => c.id === convId)
                if (!conv) {
                    // Unknown conversation — refresh list
                    setTimeout(() => {
                        api.get('/chat/conversations').then(r =>
                            setConversations(r.data.data || [])
                        ).catch(() => {})
                    }, 500)
                    return prev
                }
                const others = prev.filter(c => c.id !== convId)
                const isCurrentlySelected = selectedIdRef.current === convId
                return [{
                    ...conv,
                    lastMessage: newMsg,
                    unreadCount: isCurrentlySelected && document.hasFocus()
                        ? 0
                        : (conv.unreadCount || 0) + 1,
                }, ...others]
            })

            // Play sound if not looking at this conversation
            if (selectedIdRef.current !== convId) {
                sounds.playMessage()
            }
        }
        window.addEventListener('ws-new-message', handler)
        return () => window.removeEventListener('ws-new-message', handler)
    }, [])

    // ── Effect 1: data loading when conversation changes ─────────────────────
    useEffect(() => {
        if (!selected) return
        setTypingUsers([])
        setConversations(prev => prev.map(c =>
            c.id === selected.id ? { ...c, unreadCount: 0 } : c
        ))
        loadMessages(selected.id)
        api.post(`/chat/conversations/${selected.id}/read`).catch(() => {})
        setMentionedIds([])
    }, [selected?.id])

    // ── Effect 2: WebSocket subscription — re-runs on conv change OR reconnect ─
    useEffect(() => {
        if (!selected || !stompConnected) return

        const { client } = useSocketStore.getState()
        let typingSub = null

        // Typing topic
        if (client?.connected) {
            try {
                typingSub = client.subscribe(`/topic/conversation/${selected.id}/typing`, msg => {
                    try {
                        const data = JSON.parse(msg.body)
                        if (String(data.userId) === String(userId)) return
                        setTypingUsers(prev => {
                            if (data.typing) {
                                if (prev.find(u => u.id === data.userId)) return prev
                                return [...prev, { id: data.userId, fullName: data.fullName }]
                            }
                            return prev.filter(u => u.id !== data.userId)
                        })
                        if (data.typing) {
                            setTimeout(() => {
                                setTypingUsers(prev => prev.filter(u => u.id !== data.userId))
                            }, 4000)
                        }
                    } catch {}
                })
            } catch {}
        }

        // Messages + read receipts
        const unsubscribeConv = subscribeToConversation(
            selected.id,
            (newMsg) => {
                setMessages(prev => {
                    // Already present by real id → skip
                    if (prev.find(m => m.id === newMsg.id)) return prev
                    // If it's our own message, replace any pending optimistic temp
                    if (String(newMsg.sender?.id) === String(userIdRef.current)) {
                        const tempIdx = prev.findIndex(m => m._optimistic && m.content === newMsg.content)
                        if (tempIdx !== -1) {
                            const next = [...prev]
                            next[tempIdx] = newMsg
                            return next
                        }
                    }
                    return [...prev, newMsg]
                })
                if (String(newMsg.sender?.id) !== String(userIdRef.current)) {
                    sounds.playMessage()
                    setConversations(prev => {
                        const conv = prev.find(c => c.id === selectedIdRef.current)
                        if (!conv) return prev
                        const others = prev.filter(c => c.id !== selectedIdRef.current)
                        return [{
                            ...conv,
                            lastMessage: newMsg,
                            unreadCount: document.hasFocus() && selectedIdRef.current === conv.id
                                ? 0
                                : (conv.unreadCount || 0) + 1,
                        }, ...others]
                    })
                }
            },
            (receipt) => {
                setReadBy(prev => {
                    const updated = { ...prev }
                    ;(receipt.messageIds || []).forEach(msgId => {
                        if (!updated[msgId]) updated[msgId] = []
                        if (!updated[msgId].find(r => r.userId === receipt.userId)) {
                            updated[msgId] = [...updated[msgId], { userId: receipt.userId, userFullName: receipt.userFullName }]
                        }
                    })
                    return updated
                })
            }
        )

        // Cleanup: unsubscribe from both topics when conv changes or WS drops
        return () => {
            try { typingSub?.unsubscribe() } catch {}
            if (unsubscribeConv) unsubscribeConv()
        }
    }, [selected?.id, stompConnected])

    // ── Refresh conversation list when tab becomes visible again ────────────
    useEffect(() => {
        const onVisible = () => { if (document.visibilityState === 'visible') fetchConversations() }
        document.addEventListener('visibilitychange', onVisible)
        return () => document.removeEventListener('visibilitychange', onVisible)
    }, [])

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

    // Close new-chat dropdown on outside click
    useEffect(() => {
        const handleClick = e => {
            if (!e.target.closest('.new-chat-search')) setShowNewChat(false)
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    const fetchConversations = async () => {
        try { const res = await api.get('/chat/conversations'); setConversations(res.data.data || []) }
        catch { toast.error('Failed to load conversations') }
        finally { setLoading(false) }
    }

    useEffect(() => {
        fetchConversations()
        api.get('/users/search').then(r => setUsers((r.data.data || []).filter(u => u.id !== userId))).catch(() => {})
    }, [])

    // Deep-link from global search: auto-open conversation or start DM
    useEffect(() => {
        const state = location.state
        if (!state) return
        if (state.openConvId) {
            // Wait for conversations to load then select
            const trySelect = (attempts = 0) => {
                setConversations(prev => {
                    const conv = prev.find(c => c.id === state.openConvId)
                    if (conv) { setSelected(conv); return prev }
                    if (attempts < 10) setTimeout(() => trySelect(attempts + 1), 200)
                    return prev
                })
            }
            trySelect()
        } else if (state.openDmUserId) {
            // Start or open DM
            api.post(`/chat/conversations/direct/${state.openDmUserId}`)
                .then(r => {
                    const conv = r.data.data
                    if (conv) {
                        setConversations(prev => {
                            const exists = prev.find(c => c.id === conv.id)
                            return exists ? prev : [conv, ...prev]
                        })
                        setSelected(conv)
                    }
                }).catch(() => toast.error('Failed to open DM'))
        }
        // Clear state after processing
        window.history.replaceState({}, '', location.pathname)
    }, [location.state])

    // Deep-link from notification: ?conversationId=X
    useEffect(() => {
        const convId = Number(searchParams.get('conversationId'))
        if (!convId) return
        const trySelect = (attempts = 0) => {
            setConversations(prev => {
                const conv = prev.find(c => c.id === convId)
                if (conv) { setSelected(conv); return prev }
                if (attempts < 10) setTimeout(() => trySelect(attempts + 1), 200)
                return prev
            })
        }
        trySelect()
    }, [searchParams])

    const loadMessages = async convId => {
        try {
            const res = await api.get(`/chat/conversations/${convId}/messages`)
            setMessages((res.data.data || []).reverse())
            setReadBy({})
            // Animate message bubbles on load
            setTimeout(() => {
                const bubbles = document.querySelectorAll('[class*="space-y-1"] > div')
                if (bubbles.length) {
                    gsap.fromTo(bubbles,
                        { opacity: 0, y: 10 },
                        { opacity: 1, y: 0, duration: 0.2, stagger: 0.02, ease: 'power2.out', clearProps: 'transform' }
                    )
                }
            }, 50)
        } catch {}
    }

    // ── @mention parsing ──────────────────────────────────────────────────────

    const handleInputChange = e => {
        const val     = e.target.value
        const cursor  = e.target.selectionStart
        setInput(val)

        const textBefore = val.slice(0, cursor)
        const atIndex    = textBefore.lastIndexOf('@')
        if (atIndex !== -1 && !textBefore.slice(atIndex + 1).includes(' ')) {
            const query = textBefore.slice(atIndex + 1)
            setMentionQuery(query)
            const allParticipants = [...users, ...(selected?.participants || [])]
            const results = allParticipants
                .filter(u => u.id !== userId && u.fullName?.toLowerCase().includes(query.toLowerCase()))
                .slice(0, 6)
            setMentionResults(results)
            setShowMentions(results.length > 0)
            setMentionCursorAt(-1)
        } else {
            setShowMentions(false)
        }

        // auto-resize textarea
        if (e.target) { e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px` }
    }

    const insertMention = u => {
        const cursor     = inputRef.current?.selectionStart || input.length
        const textBefore = input.slice(0, cursor)
        const atIndex    = textBefore.lastIndexOf('@')
        const before     = input.slice(0, atIndex)
        const after      = input.slice(cursor)
        setInput(`${before}@${u.fullName} ${after}`)
        setMentionedIds(prev => prev.includes(u.id) ? prev : [...prev, u.id])
        setShowMentions(false)
        setTimeout(() => inputRef.current?.focus(), 0)
    }

    const handleKeyDown = e => {
        if (showMentions) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setMentionCursorAt(v => Math.min(v + 1, mentionResults.length - 1)) }
            if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionCursorAt(v => Math.max(v - 1, 0)) }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault()
                if (mentionCursorAt >= 0) insertMention(mentionResults[mentionCursorAt])
                else if (mentionResults.length > 0) insertMention(mentionResults[0])
                return
            }
            if (e.key === 'Escape') { setShowMentions(false); return }
        }
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
    }

    // ── Send message ──────────────────────────────────────────────────────────

    const handleSend = async () => {
        const hasText = !!input.trim()
        const hasFiles = stagedFiles.length > 0
        if (!hasText && !hasFiles) return
        if (!selected) return
        setSending(true)

        // Upload all staged files first
        if (hasFiles) {
            const filesToUpload = [...stagedFiles]
            setStagedFiles([])
            for (const file of filesToUpload) {
                if (file.size > 50 * 1024 * 1024) {
                    toast.error(`${file.name}: File too large (max 50MB)`)
                    continue
                }
                try {
                    const fd = new FormData()
                    fd.append('file', file)
                    await api.post(`/chat/conversations/${selected.id}/upload`, fd, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    })
                } catch (err) { toast.error(err.response?.data?.message || `Failed to upload ${file.name}`) }
            }
            if (!hasText) { setSending(false); loadMessages(selected.id); return }
        }

        if (!hasText) { setSending(false); return }

        const content = input.trim()
        setInput('')
        setMentionedIds([])
        if (inputRef.current) inputRef.current.style.height = 'auto'

        // ── Optimistic update: show message immediately, before server confirms ──
        const tempId = `temp-${Date.now()}`
        // Snapshot the reply target then clear it so the banner disappears.
        const replyTarget = replyingTo
        setReplyingTo(null)

        const optimisticMsg = {
            id: tempId,
            content,
            messageType: 'TEXT',
            sender: { id: userId, fullName: user?.fullName, profilePhotoUrl: user?.profilePhotoUrl },
            createdAt: new Date().toISOString(),
            isPinned: false,
            isDeleted: false,
            reactions: {},
            replyTo: replyTarget ? {
                id: replyTarget.id,
                senderName: replyTarget.sender?.fullName,
                content: replyTarget.content,
                fileName: replyTarget.fileName,
            } : null,
            _optimistic: true,
        }
        setMessages(prev => [...prev, optimisticMsg])

        try {
            const res = await api.post(`/chat/conversations/${selected.id}/messages`, {
                content, messageType: 'TEXT',
                mentionedUserIds: mentionedIds.length ? mentionedIds : null,
                replyToMessageId: replyTarget?.id || null,
            })
            // Replace temp message with real one from server
            const realMsg = res.data?.data
            if (realMsg) {
                setMessages(prev => prev.map(m => m.id === tempId ? realMsg : m))
            } else {
                // Server didn't return the message — STOMP will deliver it, remove temp
                setMessages(prev => prev.filter(m => m.id !== tempId))
            }
            // Update conversation list (last message preview)
            setConversations(prev => {
                const conv = prev.find(c => c.id === selected.id)
                if (!conv) return prev
                return [
                    { ...conv, lastMessage: realMsg || optimisticMsg },
                    ...prev.filter(c => c.id !== selected.id)
                ]
            })
        } catch {
            // Rollback optimistic message on failure
            setMessages(prev => prev.filter(m => m.id !== tempId))
            toast.error('Failed to send message')
        } finally { setSending(false) }
    }

    // ── File / image upload ───────────────────────────────────────────────────

    const handleFileUpload = async e => {
        const files = Array.from(e.target.files || [])
        if (files.length > 0) setStagedFiles(prev => [...prev, ...files])
        e.target.value = ''
    }

    // ── Drag & drop ──────────────────────────────────────────────────────────

    const handleDragEnter = (e) => {
        e.preventDefault()
        dragCounter.current++
        if (e.dataTransfer.items?.length > 0) setIsDragging(true)
    }
    const handleDragLeave = (e) => {
        e.preventDefault()
        dragCounter.current--
        if (dragCounter.current === 0) setIsDragging(false)
    }
    const handleDragOver = (e) => { e.preventDefault() }
    const handleDrop = (e) => {
        e.preventDefault()
        dragCounter.current = 0
        setIsDragging(false)
        const files = Array.from(e.dataTransfer.files)
        if (files.length > 0) setStagedFiles(prev => [...prev, ...files])
    }

    // ── Clipboard paste (images / files) ────────────────────────────────────

    const handlePaste = (e) => {
        const items = Array.from(e.clipboardData?.items || [])
        const fileItems = items.filter(i => i.kind === 'file')
        if (fileItems.length === 0) return
        e.preventDefault()
        const files = fileItems.map(i => i.getAsFile()).filter(Boolean)
        if (files.length > 0) setStagedFiles(prev => [...prev, ...files])
    }

    // ── Actions ───────────────────────────────────────────────────────────────

    const handleStartChat = async targetId => {
        try {
            const res = await api.post(`/chat/conversations/direct/${targetId}`)
            await fetchConversations(); setSelected(res.data.data)
        } catch { toast.error('Failed to start conversation') }
    }

    const handleCreateGroup = async e => {
        e.preventDefault()
        if (!groupForm.name.trim() || groupForm.memberIds.length === 0) return
        setCreatingGroup(true)
        try {
            const res = await api.post('/chat/conversations/group', {
                name: groupForm.name.trim(),
                memberIds: groupForm.memberIds
            })
            await fetchConversations()
            setSelected(res.data.data)
            setShowGroupModal(false)
            setGroupForm({ name: '', memberIds: [] })
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to create group') }
        finally { setCreatingGroup(false) }
    }

    const handleDelete = async msgId => {
        try {
            await api.delete(`/chat/messages/${msgId}`)
            setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isDeleted: true, content: null } : m))
        } catch { toast.error('Cannot delete') }
    }

    const handlePin = async msgId => {
        try {
            const msg = messages.find(m => m.id === msgId)
            const endpoint = msg?.isPinned ? 'unpin' : 'pin'
            await api.patch(`/chat/messages/${msgId}/${endpoint}`)
            setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isPinned: !m.isPinned } : m))
            toast.success('Message pinned!')
        } catch {}
    }


    const handleReact = async (msgId, emoji) => {
        try {
            await api.post(`/chat/messages/${msgId}/react`, { emoji })
            setMessages(prev => prev.map(m => {
                if (m.id !== msgId) return m
                const reactions = { ...(m.reactions || {}) }
                const users = reactions[emoji] || []
                const myName = user?.fullName
                if (users.includes(myName)) {
                    // Toggle off
                    reactions[emoji] = users.filter(u => u !== myName)
                } else {
                    reactions[emoji] = [...users, myName]
                }
                return { ...m, reactions }
            }))
        } catch {} // silently fail — reactions are nice-to-have
    }

    // ── Schedule meeting from chat ───────────────────────────────────────────
    const [showCallLinkGen, setShowCallLinkGen] = useState(false)

    const [showSchedule, setShowSchedule] = useState(false)
    const [scheduleForm, setScheduleForm] = useState({ title: '', startTime: '', endTime: '', location: '', description: '' })
    const [scheduling, setScheduling] = useState(false)

    const handleScheduleMeeting = async e => {
        e.preventDefault()
        if (!selected) return
        setScheduling(true)
        try {
            // Build participant list from conversation
            const participantIds = (selected.participants || [])
                .map(p => p.user?.id || p.id)
                .filter(Boolean)
            await api.post('/calendar/events', {
                ...scheduleForm,
                participantIds,
                fromConversationId: selected.id,
            })
            toast.success('Meeting scheduled!')
            setShowSchedule(false)
            setScheduleForm({ title: '', startTime: '', endTime: '', location: '', description: '' })
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to schedule meeting') }
        finally { setScheduling(false) }
    }

    // ── Conversation actions ─────────────────────────────────────────────────
    const handleMute = async (convId) => {
        try {
            await api.patch(`/chat/conversations/${convId}/mute`)
            toast.success('Conversation muted/unmuted')
            setContextMenu(null)
        } catch { toast.error('Failed') }
    }

    const handleArchive = async (convId) => {
        try {
            await api.patch(`/chat/conversations/${convId}/archive`)
            toast.success('Conversation archived')
            setConversations(prev => prev.filter(c => c.id !== convId))
            if (selected?.id === convId) setSelected(null)
            setContextMenu(null)
        } catch { toast.error('Failed') }
    }

    const handleDeleteConversation = async (convId) => {
        if (!window.confirm('Delete this conversation permanently? All messages will be lost.')) return
        try {
            await api.delete(`/chat/conversations/${convId}`)
            toast.success('Conversation deleted')
            setConversations(prev => prev.filter(c => c.id !== convId))
            if (selected?.id === convId) setSelected(null)
            setContextMenu(null)
        } catch { toast.error('Failed to delete conversation') }
    }

    const handleRenameGroup = async () => {
        if (!groupEditName.trim() || !selected) return
        setGroupEditSaving(true)
        try {
            const res = await api.patch(`/chat/conversations/${selected.id}/name`, { name: groupEditName.trim() })
            const updated = res.data.data
            setConversations(prev => prev.map(c => c.id === selected.id ? { ...c, name: updated?.name || groupEditName.trim() } : c))
            setSelected(prev => prev ? { ...prev, name: updated?.name || groupEditName.trim() } : prev)
            toast.success('Group renamed')
            setShowGroupEdit(false)
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to rename') }
        finally { setGroupEditSaving(false) }
    }

    const handleAddGroupMember = async (uid) => {
        if (!selected) return
        setGroupAddSaving(true)
        try {
            await api.patch(`/chat/conversations/${selected.id}/members`, { addUserIds: [uid], removeUserIds: [] })
            const addedUser = users.find(u => u.id === uid)
            if (addedUser) setSelected(prev => prev ? { ...prev, participants: [...(prev.participants || []), addedUser] } : prev)
            toast.success('Member added')
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to add member') }
        finally { setGroupAddSaving(false) }
    }

    const handleRemoveGroupMember = async (uid) => {
        if (!selected || !window.confirm('Remove this member from the group?')) return
        try {
            await api.patch(`/chat/conversations/${selected.id}/members`, { addUserIds: [], removeUserIds: [uid] })
            setSelected(prev => prev ? { ...prev, participants: prev.participants?.filter(p => p.id !== uid) } : prev)
            toast.success('Member removed')
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to remove member') }
    }

    // WhatsApp-style time formatter
    const fmtConvTime = (dateStr) => {
        if (!dateStr) return ''
        const d = new Date(dateStr)
        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const yesterdayStart = new Date(todayStart - 86400000)
        if (d >= todayStart) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        if (d >= yesterdayStart) return 'Yesterday'
        const weekAgo = new Date(todayStart - 6 * 86400000)
        if (d >= weekAgo) return d.toLocaleDateString([], { weekday: 'short' })
        return d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' })
    }

    const getConvName   = conv => conv.name || conv.participants?.find(p => p.id !== userId)?.fullName || 'Unknown'
    const getConvInit   = conv => getConvName(conv).charAt(0).toUpperCase()
    const getOther      = conv => conv.participants?.find(p => String(p.id) !== String(userId))
    const getPresence   = (id, p) => onlineUsers[id] || p?.presenceStatus || 'OFFLINE'
    const filtered      = conversations.filter(c => getConvName(c).toLowerCase().includes(search.toLowerCase()))

    return (
        <div ref={pageRef} className="flex h-full" style={{ background: 'var(--bg-primary)' }}>

            {/* ── Sidebar ─────────────────────────────────────────────────── */}
            <div className={`border-r flex flex-col flex-shrink-0 ${isMobile ? selected ? 'hidden' : 'w-full' : 'w-80'}`}
                 style={{ background: 'var(--sidebar-bg)', borderColor: 'var(--border-primary)' }}>
                <div className="p-4" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{t('chat.title')}</h2>
                        <button onClick={() => setShowGroupModal(true)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30 transition-all"
                                title="New Group Chat">
                            <Users className="w-3.5 h-3.5" /> Group
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                        <input type="text" placeholder={t('chat.search')} value={search} onChange={e => setSearch(e.target.value)}
                               className="w-full rounded-xl py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                               style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }} />
                    </div>
                </div>

                {/* New conversation search */}
                <div className="p-3 new-chat-search" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                    <div className="relative">
                        <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                        <input type="text" placeholder="Search people..."
                               value={newChatSearch}
                               onChange={e => { setNewChatSearch(e.target.value); setShowNewChat(true) }}
                               onFocus={() => setShowNewChat(true)}
                               className="w-full rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                               style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }} />
                        {newChatSearch && (
                            <button onClick={() => { setNewChatSearch(''); setShowNewChat(false) }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                    {showNewChat && newChatSearch && (
                        <div className="mt-1 rounded-xl overflow-hidden shadow-xl border"
                             style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                            {users
                                .filter(u => u.fullName?.toLowerCase().includes(newChatSearch.toLowerCase()))
                                .slice(0, 6)
                                .map(u => {
                                    const s = onlineUsers[u.id] || u.presenceStatus || 'OFFLINE'
                                    return (
                                        <button key={u.id}
                                                onClick={() => { handleStartChat(u.id); setNewChatSearch(''); setShowNewChat(false) }}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all hover:bg-[var(--bg-card-hover)]">
                                            <div className="relative flex-shrink-0">
                                                {u.profilePhotoUrl ? (
                                                    <img src={getAvatarUrl(u)} className="w-8 h-8 rounded-full object-cover" alt={u.fullName} />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xs">
                                                        {u.fullName?.charAt(0)}
                                                    </div>
                                                )}
                                                <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 ${PRESENCE_DOT[s] || PRESENCE_DOT.OFFLINE}`}
                                                     style={{ borderColor: 'var(--bg-secondary)' }} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{u.fullName}</p>
                                                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{u.role?.toLowerCase()}</p>
                                            </div>
                                            <span className="text-xs text-blue-400 flex-shrink-0">Start chat</span>
                                        </button>
                                    )
                                })
                            }
                            {users.filter(u => u.fullName?.toLowerCase().includes(newChatSearch.toLowerCase())).length === 0 && (
                                <div className="px-4 py-3 text-xs text-center" style={{ color: 'var(--text-muted)' }}>No users found</div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin w-5 h-5 text-blue-500" /></div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">{t('chat.noConversations')}</p>
                        </div>
                    ) : filtered.map(conv => {
                        const other      = getOther(conv)
                        const presence   = conv.type === 'DIRECT' ? getPresence(other?.id, other) : null
                        const isSelected = selected?.id === conv.id
                        const hasUnread  = conv.unreadCount > 0
                        const lastMsgTime = conv.lastMessage?.createdAt ? fmtConvTime(conv.lastMessage.createdAt) : ''

                        const lastMsgText = conv.lastMessage?.isDeleted
                            ? '🗑 Message deleted'
                            : conv.lastMessage?.messageType === 'IMAGE' ? '📷 Photo'
                                : conv.lastMessage?.messageType === 'FILE'  ? '📎 File'
                                    : conv.lastMessage?.content || ''

                        const lastSenderPrefix = conv.lastMessage && conv.type === 'GROUP'
                            ? (conv.lastMessage.sender?.id === Number(userId) ? 'You: ' : `${conv.lastMessage.sender?.fullName?.split(' ')[0]}: `)
                            : (conv.lastMessage?.sender?.id === Number(userId) ? 'You: ' : '')

                        return (
                            <div key={conv.id} className="relative group/conv"
                                 style={{ borderBottom: '1px solid var(--border-primary)' }}>
                                <button
                                    onClick={() => { setSelected(conv); setShowMembers(false) }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all"
                                    style={{ background: isSelected ? 'var(--bg-card-hover)' : 'transparent' }}
                                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-card-hover)' }}
                                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}>

                                    {/* Avatar */}
                                    <div className="relative flex-shrink-0">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-base font-bold shadow-sm ${
                                            conv.type === 'GROUP'
                                                ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                                                : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                                        }`}>
                                            {other?.profilePhotoUrl && conv.type === 'DIRECT'
                                                ? <img src={getAvatarUrl(other)} className="w-12 h-12 rounded-full object-cover" alt={other.fullName} />
                                                : getConvInit(conv)}
                                        </div>
                                        {/* Presence dot */}
                                        {conv.type === 'DIRECT' && (
                                            <div className={`absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full border-2 ${PRESENCE_DOT[presence] || PRESENCE_DOT.OFFLINE}`}
                                                 style={{ borderColor: 'var(--sidebar-bg)' }} />
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        {/* Row 1: name + time */}
                                        <div className="flex items-baseline justify-between gap-2 mb-0.5">
                                            <p className={`text-sm truncate leading-snug ${hasUnread ? 'font-bold text-white' : 'font-medium'}`}
                                               style={{ color: hasUnread ? 'white' : 'var(--text-primary)' }}>
                                                {getConvName(conv)}
                                            </p>
                                            <span className={`text-xs flex-shrink-0 ${hasUnread ? 'font-semibold text-blue-400' : ''}`}
                                                  style={{ color: hasUnread ? undefined : 'var(--text-muted)' }}>
                                                {lastMsgTime}
                                            </span>
                                        </div>
                                        {/* Row 2: last message + unread badge */}
                                        <div className="flex items-center gap-1.5">
                                            <p className={`text-xs truncate flex-1 ${hasUnread ? 'text-slate-200' : ''}`}
                                               style={{ color: hasUnread ? undefined : 'var(--text-muted)' }}>
                                                {lastMsgText
                                                    ? <>{lastSenderPrefix && <span className="opacity-70">{lastSenderPrefix}</span>}{lastMsgText}</>
                                                    : <span className="italic opacity-50">No messages yet</span>
                                                }
                                            </p>
                                            {hasUnread && (
                                                <div className="min-w-[20px] h-5 px-1.5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                                                    <span className="text-white text-[10px] font-bold leading-none">
                                                        {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                                                    </span>
                                                </div>
                                            )}
                                            {conv.isMuted && !hasUnread && (
                                                <BellOff className="w-3 h-3 opacity-40 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                                            )}
                                        </div>
                                    </div>
                                </button>

                                {/* 3-dot menu button — always subtly visible */}
                                <button
                                    onClick={e => { e.stopPropagation(); setContextMenu(contextMenu?.convId === conv.id ? null : { convId: conv.id }) }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg opacity-0 group-hover/conv:opacity-100 transition-all"
                                    style={{ color: 'var(--text-muted)', background: isSelected ? 'rgba(255,255,255,0.05)' : undefined }}>
                                    <MoreVertical className="w-3.5 h-3.5" />
                                </button>

                                {/* Dropdown */}
                                {contextMenu?.convId === conv.id && (
                                    <div className="absolute right-2 top-14 z-50 rounded-xl shadow-2xl overflow-hidden w-48"
                                         style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
                                         onMouseLeave={() => setContextMenu(null)}>
                                        <button onClick={() => handleMute(conv.id)}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all text-left hover:bg-[var(--bg-card-hover)]"
                                                style={{ color: 'var(--text-secondary)' }}>
                                            <BellOff className="w-3.5 h-3.5 opacity-60" /> Mute / Unmute
                                        </button>
                                        {canManageConv(conv) && (
                                            <button onClick={() => handleArchive(conv.id)}
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all text-left hover:bg-amber-500/10 hover:text-amber-400"
                                                    style={{ color: 'var(--text-secondary)' }}>
                                                <Archive className="w-3.5 h-3.5 opacity-60" /> Archive
                                            </button>
                                        )}
                                        {canManageConv(conv) && (
                                            <>
                                                <div style={{ borderTop: '1px solid var(--border-primary)' }} />
                                                <button onClick={() => handleDeleteConversation(conv.id)}
                                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 transition-all text-left hover:bg-red-500/10">
                                                    <Trash2 className="w-3.5 h-3.5" /> Delete permanently
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                <div className="p-3" style={{ borderTop: '1px solid var(--border-primary)' }}>
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <Languages className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Translate to: <span className="font-medium uppercase" style={{ color: 'var(--text-secondary)' }}>{LANG_CODE[targetLang] || 'EN'}</span></span>
                    </div>
                </div>
            </div>

            {/* ── Main Chat ──────────────────────────────────────────────────── */}
            {selected ? (
                <div className="flex-1 flex flex-col overflow-hidden relative"
                     onDragEnter={handleDragEnter}
                     onDragLeave={handleDragLeave}
                     onDragOver={handleDragOver}
                     onDrop={handleDrop}>

                    {/* Drop overlay */}
                    {isDragging && (
                        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none"
                             style={{ background: 'rgba(37,99,235,0.12)', border: '2px dashed #3b82f6', borderRadius: '0' }}>
                            <Upload className="w-14 h-14 text-blue-400 mb-3" />
                            <p className="text-blue-300 text-lg font-semibold">Drop files to send</p>
                            <p className="text-blue-400/60 text-sm mt-1">Images, PDFs, documents…</p>
                        </div>
                    )}
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-4 flex-shrink-0"
                         style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--header-bg)' }}>
                        <div className="flex items-center gap-3">
                            {isMobile && (
                                <button onClick={() => setSelected(null)}
                                        className="p-1.5 rounded-xl transition-all hover:bg-[var(--bg-card-hover)]" style={{ color: 'var(--text-secondary)' }}>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                            )}
                            {/*
                              Whole "avatar + name + presence" block is now a
                              button that opens the shared-files modal — same
                              affordance as mobile (tap the title).
                            */}
                            <button
                              onClick={() => setShowSharedFiles(true)}
                              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                              title="Show shared files"
                            >
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${selected.type==='GROUP'?'bg-gradient-to-br from-emerald-500 to-emerald-700':'bg-gradient-to-br from-blue-500 to-blue-700'}`}>
                                    {getOther(selected)?.profilePhotoUrl && selected.type === 'DIRECT' ? (
                                        <img src={getAvatarUrl(getOther(selected))} className="w-9 h-9 rounded-full object-cover" alt="" />
                                    ) : getConvInit(selected)}
                                </div>
                                <div className="text-left">
                                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{getConvName(selected)}</p>
                                    <p className="text-xs">
                                        {selected.type === 'GROUP' ? (
                                            <span style={{ color: 'var(--text-secondary)' }}>{selected.participants?.length || 0} members</span>
                                        ) : (() => {
                                            const other = getOther(selected)
                                            const s     = getPresence(other?.id, other)
                                            return <span className={PRESENCE_COLOR[s] || PRESENCE_COLOR.OFFLINE}>{s.charAt(0)+s.slice(1).toLowerCase()}</span>
                                        })()}
                                    </p>
                                </div>
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => joinVoiceChannel('CONVERSATION', null, selected?.id, 'Voice', 'audio')}
                                    className="p-2 rounded-xl transition-all text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10" title="Join voice channel">
                                <Volume2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => joinVoiceChannel('CONVERSATION', null, selected?.id, 'Voice', 'video')}
                                    className="p-2 rounded-xl transition-all text-slate-400 hover:text-blue-400 hover:bg-blue-400/10" title="Join video channel">
                                <Video className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setShowOriginal(v => !v)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition-all ${showOriginal ? 'bg-amber-600/20 border-amber-500/40 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                                style={{ background: showOriginal ? undefined : 'var(--bg-card)' }}
                                title={showOriginal ? 'Show translations' : 'Show original messages'}>
                                <Languages className="w-3.5 h-3.5" />
                                <span className="text-xs font-semibold">{showOriginal ? 'Original' : 'Translated'}</span>
                            </button>
                            <button onClick={() => setShowSchedule(true)}
                                    className="p-2 rounded-xl transition-all text-slate-400 hover:text-purple-400 hover:bg-purple-400/10" title="Schedule meeting">
                                <CalendarPlus className="w-4 h-4" />
                            </button>
                            <button onClick={() => setShowCallLinkGen(true)}
                                    className="p-2 rounded-xl transition-all text-slate-400 hover:text-green-400 hover:bg-green-400/10" title="Share call link">
                                <LinkIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => setShowMembers(v => !v)}
                                    className={`p-2 rounded-xl transition-all ${showMembers ? 'text-blue-400 bg-blue-400/10' : 'text-slate-400 hover:text-blue-400 hover:bg-blue-400/10'}`}
                                    title="Members">
                                <Users className="w-4 h-4" />
                            </button>
                            <AiSummaryButton messages={messages} convName={getConvName(selected)} />
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-1">
                        {messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>
                                <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
                                <p>No messages yet</p>
                            </div>
                        ) : (() => {
                            // Determine which VOICE_CALL_START messages have a matching END after them
                            // so we can hide those cards (call already finished)
                            const endedCallIds = new Set()
                            const pending = []  // FIFO queue of VOICE_CALL_START message IDs
                            for (const m of messages) {
                                if (m.messageType === 'VOICE_CALL_START') pending.push(m.id)
                                else if (m.messageType === 'VOICE_CALL_END' && pending.length > 0) endedCallIds.add(pending.shift())
                            }
                            return messages.map((msg, idx) => {
                                const msgDate = msg.createdAt ? new Date(msg.createdAt).toDateString() : null
                                const prevDate = idx > 0 && messages[idx-1].createdAt ? new Date(messages[idx-1].createdAt).toDateString() : null
                                const showDateSep = msgDate && msgDate !== prevDate
                                return (
                                    <div key={msg.id}>
                                        {showDateSep && <DateSeparator date={msg.createdAt} />}
                                        <MessageBubble msg={msg}
                                                       isOwn={String(msg.sender?.id) === String(userId)}
                                                       targetLang={targetLang}
                                                       showOriginalGlobal={showOriginal}
                                                       readBy={readBy[msg.id] || []}
                                                       allUsers={[...users, ...(selected.participants || [])]}
                                                       conversationId={selected?.id}
                                                       callEnded={endedCallIds.has(msg.id)}
                                                       onDelete={handleDelete}
                                                       onPin={handlePin}
                                                       onReact={handleReact}
                                                       onShowProfile={setProfileUser}
                                                       onReply={setReplyingTo}
                                        />
                                    </div>
                                )
                            })
                        })()}
                        <div ref={bottomRef} />
                    </div>

                    {/* Typing indicator */}
                    {typingUsers.length > 0 && (
                        <div className="px-6 py-1.5 flex items-center gap-2 flex-shrink-0">
                            <div className="flex gap-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] animate-bounce" style={{animationDelay:'0ms'}} />
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] animate-bounce" style={{animationDelay:'150ms'}} />
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] animate-bounce" style={{animationDelay:'300ms'}} />
                            </div>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {typingUsers.length === 1
                                    ? `${typingUsers[0].fullName} is typing...`
                                    : `${typingUsers.map(u => u.fullName).join(', ')} are typing...`}
                            </span>
                        </div>
                    )}

                    {/* Input area */}
                    <div className="px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border-primary)' }}>
                        {mentionedIds.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                                {mentionedIds.map(id => {
                                    const u = [...users, ...(selected.participants||[])].find(u => u.id === id)
                                    return u ? (
                                        <span key={id} className="flex items-center gap-1 bg-blue-600/20 text-blue-300 text-xs px-2 py-0.5 rounded-full">
                                            @{u.fullName}
                                            <button onClick={() => setMentionedIds(prev => prev.filter(i => i !== id))} className="hover:text-red-400">×</button>
                                        </span>
                                    ) : null
                                })}
                            </div>
                        )}

                        {replyingTo && (
                            <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl border"
                                 style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                                <Reply className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold text-blue-400">
                                        Replying to {replyingTo.sender?.fullName || 'message'}
                                    </div>
                                    <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                                        {replyingTo.content || replyingTo.fileName || '(file)'}
                                    </div>
                                </div>
                                <button onClick={() => setReplyingTo(null)}
                                        className="p-1 rounded-lg text-slate-400 hover:text-white transition-all">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {stagedFiles.length > 0 && (
                            <div className="flex flex-col gap-1 mb-2">
                                {stagedFiles.map((file, idx) => (
                                    <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-xl border"
                                         style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                                        <Paperclip className="w-4 h-4 flex-shrink-0 text-blue-400" />
                                        <span className="text-sm flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{file.name}</span>
                                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                            {(file.size / 1024).toFixed(0)} KB
                                        </span>
                                        <button onClick={() => setStagedFiles(prev => prev.filter((_, i) => i !== idx))}
                                                className="p-0.5 rounded hover:text-red-400 transition-colors"
                                                style={{ color: 'var(--text-muted)' }}>
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {showMentions && (
                            <div className="mb-2 rounded-xl overflow-hidden shadow-xl border"
                                 style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                                {mentionResults.map((u, i) => (
                                    <button key={u.id} onClick={() => insertMention(u)}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all"
                                            style={{ background: i === mentionCursorAt ? 'rgba(37,99,235,0.2)' : 'transparent' }}>
                                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                            {u.fullName.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{u.fullName}</p>
                                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{u.role?.toLowerCase()}</p>
                                        </div>
                                        <AtSign className="w-3.5 h-3.5 ml-auto" style={{ color: 'var(--text-muted)' }} />
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="flex items-end gap-3">
                            <input ref={fileRef} type="file" className="hidden" onChange={handleFileUpload} multiple
                                   accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.csv" />
                            <button onClick={() => fileRef.current?.click()} disabled={uploading}
                                    className="p-2.5 rounded-xl text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 transition-all flex-shrink-0 border"
                                    style={{ borderColor: 'var(--border-primary)' }} title="Attach file">
                                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                            </button>

                            <div className="flex-1 relative">
                                <div className="rounded-2xl px-4 py-3 border focus-within:border-blue-500/50 transition-colors"
                                     style={{ background: 'var(--bg-card)', borderColor: 'var(--border-input)' }}>
                                    <textarea
                                        ref={inputRef}
                                        rows={1}
                                        value={input}
                                        onChange={handleInputChange}
                                        onKeyDown={handleKeyDown}
                                        onPaste={handlePaste}
                                        placeholder={`${t('chat.placeholder')} — type @ to mention`}
                                        className="w-full bg-transparent text-sm resize-none focus:outline-none"
                                        style={{ color: 'var(--text-primary)', maxHeight: '120px' }}
                                    />
                                </div>
                            </div>

                            <button onClick={handleSend} disabled={(!input.trim() && stagedFiles.length === 0) || sending}
                                    className="w-10 h-10 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:bg-[var(--bg-card)] disabled:cursor-not-allowed flex items-center justify-center transition-all flex-shrink-0 shadow-lg shadow-blue-600/20">
                                {sending ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
                            </button>
                        </div>
                    </div>

                    {/* Members panel */}
                    {showMembers && (
                        <div className="absolute right-0 top-0 bottom-0 w-64 z-30 flex flex-col border-l overflow-hidden"
                             style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
                                 style={{ borderBottom: '1px solid var(--border-primary)' }}>
                                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                    Members ({selected.participants?.length || 0})
                                </span>
                                <div className="flex items-center gap-1">
                                    {selected.type === 'GROUP' && canManageConv(selected) && (
                                        <button onClick={() => { setGroupEditName(selected.name || ''); setShowGroupEdit(v => !v) }}
                                                className="p-1 rounded-lg hover:bg-[var(--bg-card-hover)] transition-all"
                                                style={{ color: 'var(--text-muted)' }} title="Edit group">
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    <button onClick={() => setShowMembers(false)}
                                            className="p-1 rounded-lg hover:bg-[var(--bg-card-hover)] transition-all"
                                            style={{ color: 'var(--text-muted)' }}>
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Group edit panel */}
                            {showGroupEdit && selected.type === 'GROUP' && canManageConv(selected) && (
                                <div className="px-4 py-3 space-y-3 flex-shrink-0"
                                     style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-card)' }}>
                                    {/* Rename */}
                                    <div className="flex gap-2">
                                        <input value={groupEditName} onChange={e => setGroupEditName(e.target.value)}
                                               placeholder="Group name"
                                               className="flex-1 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                               style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }} />
                                        <button onClick={handleRenameGroup} disabled={groupEditSaving || !groupEditName.trim()}
                                                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium transition-all">
                                            {groupEditSaving ? '…' : 'Save'}
                                        </button>
                                    </div>
                                    {/* Add member */}
                                    <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>Add member</p>
                                        <input value={groupAddSearch} onChange={e => setGroupAddSearch(e.target.value)}
                                               placeholder="Search users…"
                                               className="w-full text-xs rounded-lg px-3 py-1.5 mb-1 focus:outline-none"
                                               style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }} />
                                        <div className="max-h-28 overflow-y-auto space-y-0.5">
                                            {users.filter(u =>
                                                u.fullName?.toLowerCase().includes(groupAddSearch.toLowerCase()) &&
                                                !selected.participants?.find(p => String(p.id) === String(u.id))
                                            ).slice(0, 5).map(u => (
                                                <button key={u.id} disabled={groupAddSaving}
                                                        onClick={() => handleAddGroupMember(u.id)}
                                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs hover:bg-emerald-500/10 transition-all disabled:opacity-50">
                                                    <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                                                        {u.fullName?.charAt(0)}
                                                    </div>
                                                    <span style={{ color: 'var(--text-primary)' }}>{u.fullName}</span>
                                                    <span className="ml-auto text-emerald-400">+</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto py-2">
                                {(selected.participants || []).map(p => {
                                    const presence = onlineUsers[p.id] || p.presenceStatus || 'OFFLINE'
                                    const canRemove = selected.type === 'GROUP' && canManageConv(selected) && String(p.id) !== String(userId)
                                    return (
                                        <div key={p.id}
                                             className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-card-hover)] transition-all group">
                                            <button onClick={() => setProfileUser(p)} className="flex items-center gap-3 flex-1 text-left min-w-0">
                                                <div className="relative flex-shrink-0">
                                                    {p.profilePhotoUrl ? (
                                                        <img src={getAvatarUrl(p)} className="w-8 h-8 rounded-full object-cover" alt="" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold">
                                                            {p.fullName?.charAt(0)}
                                                        </div>
                                                    )}
                                                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-secondary)] ${PRESENCE_DOT[presence] || PRESENCE_DOT.OFFLINE}`} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                                        {p.fullName}
                                                        {String(p.id) === String(userId) && <span className="ml-1 text-xs text-blue-400">(you)</span>}
                                                        {String(p.id) === String(selected.createdByUserId) && <span className="ml-1 text-[10px] text-amber-400">creator</span>}
                                                    </p>
                                                    <p className="text-xs truncate capitalize" style={{ color: 'var(--text-muted)' }}>
                                                        {p.role?.toLowerCase().replace('_', ' ')}
                                                    </p>
                                                </div>
                                            </button>
                                            {canRemove && (
                                                <button onClick={() => handleRemoveGroupMember(p.id)}
                                                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
                                                        title="Remove from group">
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                !isMobile && (
                    <div className="flex-1 flex flex-col items-center justify-center" style={{ color: 'var(--text-muted)' }}>
                        <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
                        <p className="text-lg font-medium">{t('chat.selectConversation')}</p>
                        <p className="text-sm mt-1">Choose a conversation or start a new one</p>
                    </div>
                )
            )}

            {/* Shared Files Modal — lists every FILE/IMAGE in the conversation */}
            {showSharedFiles && selected && (
                <SharedFilesModal
                    messages={messages}
                    convName={getConvName(selected)}
                    onClose={() => setShowSharedFiles(false)}
                />
            )}

            {/* Schedule Meeting Modal */}
            {showSchedule && selected && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between p-6 border-b border-[var(--border-primary)]">
                            <h2 className="text-base font-semibold text-white flex items-center gap-2">
                                <CalendarPlus className="w-4 h-4 text-purple-400" /> Schedule Meeting
                            </h2>
                            <button onClick={() => setShowSchedule(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleScheduleMeeting} className="p-6 space-y-4">
                            <div className="p-3 bg-purple-600/10 border border-purple-500/20 rounded-xl text-xs text-purple-300">
                                Participants: {(selected.participants || []).map(p => p.user?.fullName || p.fullName).filter(Boolean).join(', ') || 'All conversation members'}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Title *</label>
                                <input required value={scheduleForm.title} onChange={e => setScheduleForm({...scheduleForm, title: e.target.value})}
                                       placeholder="Meeting title..."
                                       className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl py-2.5 px-4 text-white placeholder-[var(--text-placeholder)] focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Start *</label>
                                    <input required type="datetime-local" value={scheduleForm.startTime} onChange={e => setScheduleForm({...scheduleForm, startTime: e.target.value})}
                                           className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">End *</label>
                                    <input required type="datetime-local" value={scheduleForm.endTime} onChange={e => setScheduleForm({...scheduleForm, endTime: e.target.value})}
                                           className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Location</label>
                                <input value={scheduleForm.location} onChange={e => setScheduleForm({...scheduleForm, location: e.target.value})}
                                       placeholder="Online / Room 101..."
                                       className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl py-2.5 px-4 text-white placeholder-[var(--text-placeholder)] focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Description</label>
                                <textarea rows={2} value={scheduleForm.description} onChange={e => setScheduleForm({...scheduleForm, description: e.target.value})}
                                          placeholder="Optional agenda..."
                                          className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl py-2.5 px-4 text-white placeholder-[var(--text-placeholder)] focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm resize-none" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowSchedule(false)}
                                        className="flex-1 py-2.5 rounded-xl border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm transition-all">Cancel</button>
                                <button type="submit" disabled={scheduling}
                                        className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-white font-medium text-sm transition-all flex items-center justify-center gap-2">
                                    {scheduling ? <><Loader2 className="w-4 h-4 animate-spin" />Scheduling...</> : 'Schedule'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}


            {profileUser && (
                <UserProfileModal
                    user={profileUser}
                    onClose={() => setProfileUser(null)}
                    onMessage={async (u) => {
                        setProfileUser(null)
                        try {
                            const res = await api.post(`/chat/conversations/direct/${u.id}`)
                            const conv = res.data.data
                            if (conv) {
                                setConversations(prev => prev.find(c => c.id === conv.id) ? prev : [conv, ...prev])
                                setSelected(conv)
                            }
                        } catch { toast.error('Could not open conversation') }
                    }}
                    onVoiceCall={async (u) => {
                        setProfileUser(null)
                        try {
                            const res = await api.post(`/chat/conversations/direct/${u.id}`)
                            const conv = res.data.data
                            if (conv) {
                                setConversations(prev => prev.find(c => c.id === conv.id) ? prev : [conv, ...prev])
                                setSelected(conv)
                                joinVoiceChannel('CONVERSATION', null, conv.id, `Call with ${u.fullName || u.displayName}`, 'audio')
                            }
                        } catch { toast.error('Could not start call') }
                    }}
                    onVideoCall={async (u) => {
                        setProfileUser(null)
                        try {
                            const res = await api.post(`/chat/conversations/direct/${u.id}`)
                            const conv = res.data.data
                            if (conv) {
                                setConversations(prev => prev.find(c => c.id === conv.id) ? prev : [conv, ...prev])
                                setSelected(conv)
                                joinVoiceChannel('CONVERSATION', null, conv.id, `Call with ${u.fullName || u.displayName}`, 'video')
                            }
                        } catch { toast.error('Could not start video call') }
                    }}
                />
            )}

            {showCallLinkGen && (
                <CallLinkGenerator
                    onClose={() => setShowCallLinkGen(false)}
                    onSend={selected ? async (linkId, mode) => {
                        // Send a special VOICE_INVITE message — no URL, no /call/ page
                        await api.post(`/chat/conversations/${selected.id}/messages`, {
                            content: `__VOICE_INVITE__:${linkId}:${mode}`,
                            messageType: 'TEXT'
                        })
                    } : undefined}
                />
            )}

            {showGroupModal && (
                <GroupChatModal
                    users={users}
                    onClose={() => setShowGroupModal(false)}
                    onCreate={async ({ name, memberIds }) => {
                        setCreatingGroup(true)
                        try {
                            const res = await api.post('/chat/conversations/group', { name, memberIds })
                            await fetchConversations()
                            setSelected(res.data.data)
                            setShowGroupModal(false)
                            setGroupForm({ name: '', memberIds: [] })
                        } catch (err) { toast.error(err.response?.data?.message || 'Failed to create group') }
                        finally { setCreatingGroup(false) }
                    }}
                    creating={creatingGroup}
                />
            )}
        </div>
    )
}

// ─── Date Separator ──────────────────────────────────────────────────────────

function DateSeparator({ date }) {
    const d = new Date(date)
    const today = new Date()
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
    let label
    if (d.toDateString() === today.toDateString()) label = 'Today'
    else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday'
    else label = d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    return (
        <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px" style={{ background: 'var(--border-primary)' }} />
            <span className="text-xs px-3 py-1 rounded-full flex-shrink-0"
                  style={{ color: 'var(--text-muted)', background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
                {label}
            </span>
            <div className="flex-1 h-px" style={{ background: 'var(--border-primary)' }} />
        </div>
    )
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

const QUICK_EMOJIS = ['👍','❤️','😂','😮','😢','🔥']

function MessageBubble({ msg, isOwn, targetLang, showOriginalGlobal, readBy = [], allUsers = [], conversationId, callEnded, onDelete, onPin, onReact, onShowProfile, onReply }) {
    const [showActions, setShowActions] = useState(false)
    const [showEmojiPicker, setShowEmojiPicker] = useState(false)
    const [translation, setTranslation] = useState(null)

    // Auto-translate all non-own text messages automatically
    useEffect(() => {
        if (isOwn || !msg.content?.trim() || msg.messageType !== 'TEXT') return
        if (translation) return
        translateText(msg.content, targetLang)
            .then(t => { if (t !== msg.content) setTranslation(t) })
            .catch(() => {})
    }, [msg.id])

    // Voice channel start card — hide if the call has already ended
    if (msg.messageType === 'VOICE_CALL_START') {
        if (callEnded) return null
        let data = {}
        try { data = JSON.parse(msg.content) } catch {}
        return <VoiceCallStartCard data={data} conversationId={conversationId} />
    }

    // Voice channel end card
    if (msg.messageType === 'VOICE_CALL_END') {
        let data = {}
        try { data = JSON.parse(msg.content) } catch {}
        const isVideo = data.mode === 'video'
        return (
            <div className="flex w-full justify-center py-2">
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl border text-xs"
                     style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)', color: 'var(--text-muted)' }}>
                    {isVideo ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
                    <span>{isVideo ? 'Video' : 'Voice'} call ended{data.duration ? ` · ${data.duration}` : ''}</span>
                </div>
            </div>
        )
    }

    // System messages (call history, etc.) — centered, non-interactive
    if (msg.messageType === 'SYSTEM') return (
        <div className="flex w-full justify-center py-1.5">
            <span className="text-xs italic px-3 py-1 rounded-full"
                  style={{ color: 'var(--text-muted)', background: 'var(--bg-card)' }}>
                {msg.content}
            </span>
        </div>
    )

    if (msg.isDeleted) return (
        <div className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'} py-0.5`}>
            <p className="text-xs italic px-4 py-1.5" style={{ color: 'var(--text-muted)' }}>Message deleted</p>
        </div>
    )

    const langLabel = LANG_CODE[targetLang]?.toUpperCase() || 'EN'

    const renderContent = text => {
        if (!text) return null
        const parts = text.split(/(@\S+)/g)
        return parts.map((part, i) =>
            part.startsWith('@') ? (
                <span key={i} className="text-blue-300 font-medium">{part}</span>
            ) : part
        )
    }

    const isMedia = msg.messageType === 'IMAGE' || msg.messageType === 'FILE'

    // Detect call link card (e.g. http://host/call/abc123 or just /call/abc123)
    const voiceInviteMatch = msg.content?.match(/^__VOICE_INVITE__:([a-zA-Z0-9_-]+):(\w+)$/)
    const callLinkId       = voiceInviteMatch?.[1]
    const callLinkMode     = voiceInviteMatch?.[2] || 'audio'
    const isCallLink       = !isMedia && !!callLinkId

    return (
        <div className={`flex w-full py-0.5 ${isOwn ? 'justify-end' : 'justify-start'}`}
             onMouseEnter={() => setShowActions(true)}
             onMouseLeave={() => setShowActions(false)}>

            {!isOwn && (
                <button onClick={() => onShowProfile?.(msg.sender)}
                        className="w-7 h-7 rounded-full bg-blue-600/30 flex items-center justify-center flex-shrink-0 mt-1 mr-2 hover:ring-2 hover:ring-blue-400/50 transition-all">
                    {msg.sender?.profilePhotoUrl ? (
                        <img src={getAvatarUrl(msg.sender)} className="w-7 h-7 rounded-full object-cover" alt="" />
                    ) : (
                        <span className="text-blue-400 text-xs font-bold">{msg.sender?.fullName?.charAt(0)}</span>
                    )}
                </button>
            )}

            <div className={`flex flex-col gap-0.5 max-w-xs lg:max-w-md ${isOwn ? 'items-end' : 'items-start'}`}>
                {!isOwn && (
                    <button onClick={() => onShowProfile?.(msg.sender)}
                            className="text-xs px-1 mb-0.5 hover:text-blue-300 transition-colors text-left"
                            style={{ color: 'var(--text-muted)' }}>
                        {msg.sender?.fullName}
                    </button>
                )}

                <div className={`px-4 py-2.5 rounded-2xl text-sm ${isOwn ? 'bg-blue-600 text-white rounded-tr-sm' : 'rounded-tl-sm'}`}
                     style={isOwn ? {} : { background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                    {msg.isPinned && <span className="text-xs opacity-60 block mb-1">📌 Pinned</span>}

                    {/* Quoted message this one replies to */}
                    {msg.replyTo && (
                        <div className={`mb-1.5 pl-2 py-1 border-l-2 rounded-r text-xs ${isOwn ? 'border-white/50' : 'border-blue-400'}`}
                             style={isOwn ? { background: 'rgba(255,255,255,0.12)' } : { background: 'var(--bg-secondary)' }}>
                            <div className={`font-semibold ${isOwn ? 'text-white/90' : 'text-blue-400'}`}>
                                {msg.replyTo.senderName || msg.replyTo.sender?.fullName || 'Someone'}
                            </div>
                            <div className={`truncate ${isOwn ? 'text-white/70' : ''}`} style={isOwn ? {} : { color: 'var(--text-muted)' }}>
                                {msg.replyTo.content || msg.replyTo.fileName || '(file)'}
                            </div>
                        </div>
                    )}

                    {isMedia ? (
                        msg.messageType === 'IMAGE' ? (
                            <AuthImage url={msg.fileUrl} fileName={msg.fileName} />
                        ) : (
                            <AuthFileLink url={msg.fileUrl} fileName={msg.fileName} fileSize={msg.fileSize} isOwn={isOwn} />
                        )
                    ) : isCallLink ? (
                        <CallLinkCard linkId={callLinkId} mode={callLinkMode} isOwn={isOwn} conversationId={conversationId} />
                    ) : (
                        <p className="whitespace-pre-wrap break-words">{renderContent(msg.content)}</p>
                    )}
                </div>

                {translation && !showOriginalGlobal && (
                    <div className={`px-3 py-2 rounded-xl text-xs max-w-full border ${isOwn ? 'bg-blue-500/20 border-blue-500/30 text-blue-100' : 'border-slate-600/50 text-slate-200'}`}
                         style={isOwn ? {} : { background: 'var(--bg-card)' }}>
                        <div className="flex items-center gap-1.5 mb-1 opacity-70">
                            <Languages className="w-3 h-3" />
                            <span className="font-semibold uppercase">{langLabel}</span>
                        </div>
                        <p className="leading-relaxed">{translation}</p>
                    </div>
                )}

                {/* Emoji reactions */}
                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className={`flex flex-wrap gap-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        {Object.entries(msg.reactions).map(([emoji, users]) =>
                                users.length > 0 && (
                                    <button key={emoji}
                                            onClick={() => onReact(msg.id, emoji)}
                                            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all hover:scale-105"
                                            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
                                            title={users.join(', ')}>
                                        {emoji} <span>{users.length}</span>
                                    </button>
                                )
                        )}
                    </div>
                )}

                <div className={`flex items-center gap-1.5 px-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(msg.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
                    {isOwn && (
                        <>
                            <span title={readBy.length === 0 ? 'Sent' : `Read by: ${readBy.map(r=>r.userFullName).join(', ')}`}>
                                {readBy.length === 0 ? (
                                    <svg className="w-3.5 h-3.5 text-slate-600" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/></svg>
                                ) : (
                                    <svg className="w-4.5 h-3.5 text-blue-400" viewBox="0 0 22 16" fill="currentColor"><path d="M1.78 8.22a.75.75 0 0 1 1.06-1.06L6 10.44l6.72-6.72a.75.75 0 0 1 1.06 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L1.78 8.22z"/><path d="M8.78 8.22a.75.75 0 0 1 1.06-1.06L13 10.44l6.72-6.72a.75.75 0 0 1 1.06 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L8.78 8.22z"/></svg>
                                )}
                            </span>
                            {readBy.length > 0 && (
                                <div className="flex -space-x-1">
                                    {readBy.slice(0,3).map((r,i) => (
                                        <div key={i} title={r.userFullName} className="w-3.5 h-3.5 rounded-full bg-blue-500 border border-slate-900 flex items-center justify-center">
                                            <span className="text-white leading-none" style={{fontSize:'7px',fontWeight:700}}>{r.userFullName?.charAt(0)}</span>
                                        </div>
                                    ))}
                                    {readBy.length > 3 && <div className="w-3.5 h-3.5 rounded-full bg-slate-600 border border-slate-900 flex items-center justify-center"><span className="text-slate-300" style={{fontSize:'7px'}}>+{readBy.length-3}</span></div>}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {showActions && !isMedia && (
                <div className={`flex items-center gap-1 self-center ${isOwn ? 'mr-2 order-first' : 'ml-2'}`}>
                    <div className="relative">
                        <button onClick={() => setShowEmojiPicker(v => !v)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 transition-all"
                                style={{ background: 'var(--bg-card)' }} title="React">
                            😊
                        </button>
                        {showEmojiPicker && (
                            <div className={`absolute bottom-8 flex gap-1 p-2 rounded-xl shadow-2xl border z-50 ${isOwn ? 'right-0' : 'left-0'}`}
                                 style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                                {QUICK_EMOJIS.map(emoji => (
                                    <button key={emoji}
                                            onClick={() => { onReact(msg.id, emoji); setShowEmojiPicker(false) }}
                                            className="text-lg hover:scale-125 transition-transform p-0.5">
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <button onClick={() => onReply?.(msg)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 transition-all"
                            style={{ background: 'var(--bg-card)' }} title="Reply">
                        <Reply className="w-3 h-3" />
                    </button>
                    <button onClick={() => onPin(msg.id)}
                            className={`p-1.5 rounded-lg transition-all ${msg.isPinned ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-white'}`}
                            style={{ background: msg.isPinned ? undefined : 'var(--bg-card)' }}
                            title={msg.isPinned ? 'Unpin' : 'Pin'}>
                        <Pin className="w-3 h-3" />
                    </button>
                    {isOwn && (
                        <button onClick={() => onDelete(msg.id)}
                                className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all"
                                style={{ background: 'var(--bg-card)' }} title="Delete">
                            <Trash2 className="w-3 h-3" />
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}


// ─── AI Summary Button ────────────────────────────────────────────────────────

function AiSummaryButton({ messages, convName }) {
    const [loading,  setLoading]  = useState(false)
    const [summary,  setSummary]  = useState(null)
    const [showPanel, setShowPanel] = useState(false)

    const handleSummarize = async () => {
        if (loading) return
        const textMessages = messages
            .filter(m => !m.isDeleted && m.messageType === 'TEXT' && m.content)
            .slice(-30)  // last 30 messages
        if (textMessages.length === 0) { return }

        setLoading(true)
        setShowPanel(true)
        setSummary(null)

        try {
            const token = localStorage.getItem('token') ||
                JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.token
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    messages: [{
                        role: 'user',
                        content: `Summarize this conversation from "${convName}" in 3-5 bullet points. Be concise and focus on key decisions, action items, and important information. Messages:\n\n${
                            textMessages.map(m => `${m.sender?.fullName}: ${m.content}`).join('\n')
                        }\n\nRespond ONLY with bullet points, no preamble.`
                    }]
                })
            })
            const data = await response.json()
            setSummary(data.content?.[0]?.text || 'Could not generate summary.')
        } catch {
            setSummary('Failed to generate summary. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <button onClick={handleSummarize}
                    className="p-2 rounded-xl transition-all text-slate-400 hover:text-purple-400 hover:bg-purple-400/10"
                    title="AI Summary">
                <Sparkles className="w-4 h-4" />
            </button>

            {showPanel && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                     onClick={() => setShowPanel(false)}>
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl"
                         onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-slate-700">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-purple-400" />
                                <h3 className="font-semibold text-white text-sm">AI Summary</h3>
                                <span className="text-xs text-slate-400 truncate max-w-32">{convName}</span>
                            </div>
                            <button onClick={() => setShowPanel(false)} className="text-slate-400 hover:text-white">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-5 min-h-24">
                            {loading ? (
                                <div className="flex items-center gap-3 text-slate-400">
                                    <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                                    <span className="text-sm">Analyzing conversation...</span>
                                </div>
                            ) : (
                                <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                                    {summary}
                                </div>
                            )}
                        </div>
                        <div className="px-5 pb-5">
                            <button onClick={handleSummarize}
                                    className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
                                ↻ Regenerate
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

// ─── Auth-aware Image (loads via fetch + Authorization header → Blob URL) ────

function AuthImage({ url, fileName }) {
    const src = useAuthImage(url)
    const handleClick = () => {
        if (src) window.dispatchEvent(new CustomEvent('preview-img', { detail: src }))
    }
    return (
        <div className="block cursor-zoom-in" onClick={handleClick}>
            {src
                ? <img src={src} alt={fileName}
                       className="rounded-xl object-cover hover:opacity-90 transition-opacity cursor-zoom-in"
                       style={{ maxWidth: '320px', maxHeight: '320px', width: '100%', display: 'block' }} />
                : <div className="rounded-xl bg-slate-700/40 animate-pulse"
                       style={{ width: '200px', height: '150px' }} />
            }
        </div>
    )
}

// ─── Auth-aware File Download ──────────────────────────────────────────────────

function AuthFileLink({ url, fileName, fileSize, isOwn }) {
    const handleDownload = async () => {
        if (!url) return
        const token = JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.token
            || localStorage.getItem('token')
        const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        if (!r.ok) return
        const blob = await r.blob()
        const a    = document.createElement('a')
        a.href     = URL.createObjectURL(blob)
        a.download = fileName || 'file'
        document.body.appendChild(a); a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(a.href)
    }
    return (
        <button onClick={handleDownload}
                className="flex items-center gap-2 hover:opacity-90 transition-opacity text-left">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isOwn ? 'bg-white/20' : 'bg-blue-600/30'}`}>
                <Paperclip className="w-4 h-4" />
            </div>
            <div className="min-w-0">
                <p className="text-sm font-medium truncate">{fileName || 'File'}</p>
                {fileSize && <p className="text-xs opacity-70">{(fileSize / 1024).toFixed(1)} KB</p>}
            </div>
        </button>
    )
}

// ─── Call Link Card ───────────────────────────────────────────────────────────

function CallLinkCard({ linkId, mode, isOwn, conversationId }) {
    const [joining, setJoining] = useState(false)
    const { joinChannel: joinVoiceChannel } = useVoiceStore()

    const isVideo = mode === 'video'

    const handleJoin = async () => {
        if (!conversationId) { toast.error('Cannot join: no conversation'); return }
        setJoining(true)
        try {
            // `linkId` IS the SFU roomId for this card. Passing it as
            // roomIdOverride makes the backend look up the existing channel
            // by roomId instead of creating a new one.
            await joinVoiceChannel(
                'CONVERSATION',
                null,
                conversationId,
                isVideo ? 'Video Call' : 'Voice Call',
                mode || 'audio',
                linkId,
            )
            toast.success(`Joined ${isVideo ? 'video' : 'voice'} channel!`)
        } catch (e) {
            toast.error(e.message || 'Failed to join')
        } finally {
            setJoining(false)
        }
    }

    return (
        <div className={`rounded-xl border p-3 min-w-[200px] ${isOwn ? 'bg-blue-500/20 border-blue-400/30' : 'border-slate-600/50'}`}
             style={isOwn ? {} : { background: 'var(--bg-secondary)' }}>
            <div className="flex items-center gap-2 mb-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isVideo ? 'bg-blue-600/30' : 'bg-emerald-600/30'}`}>
                    {isVideo
                        ? <Video className="w-4 h-4 text-blue-400" />
                        : <Phone className="w-4 h-4 text-emerald-400" />
                    }
                </div>
                <div>
                    <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {isVideo ? 'Video Call' : 'Voice Call'} Invite
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        Click to join the voice channel
                    </p>
                </div>
            </div>
            <button
                onClick={handleJoin}
                disabled={joining}
                className={`w-full py-1.5 rounded-lg text-xs font-semibold text-white transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 ${
                    isVideo ? 'bg-blue-600 hover:bg-blue-500' : 'bg-emerald-600 hover:bg-emerald-500'
                }`}>
                {joining
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : isVideo ? <Video className="w-3 h-3" /> : <Phone className="w-3 h-3" />
                }
                {joining ? 'Joining...' : `Join ${isVideo ? 'Video' : 'Voice'} Channel`}
            </button>
        </div>
    )
}

// ─── Voice Call Start Card ────────────────────────────────────────────────────

function VoiceCallStartCard({ data, conversationId }) {
    const [joining, setJoining] = useState(false)
    const { joinChannel: joinVoiceChannel } = useVoiceStore()

    const isVideo = data.mode === 'video'
    const convId  = data.conversationId || conversationId

    const handleJoin = async () => {
        setJoining(true)
        try {
            // CRITICAL: pass `data.roomId` as the 6th arg (roomIdOverride).
            // Without it the store sends the channel *name* and the backend
            // creates a brand-new channel instead of joining the existing
            // one — which is exactly what was happening before this fix.
            await joinVoiceChannel(
                'CONVERSATION', null, convId,
                data.channelName || 'Voice', data.mode || 'audio',
                data.roomId,
            )
        } catch (e) {
            toast.error(e.message || 'Failed to join')
        } finally {
            setJoining(false)
        }
    }

    return (
        <div className="flex w-full justify-center py-2">
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl border"
                 style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isVideo ? 'bg-blue-600/30' : 'bg-emerald-600/30'}`}>
                    {isVideo ? <Video className="w-4 h-4 text-blue-400" /> : <Phone className="w-4 h-4 text-emerald-400" />}
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {isVideo ? 'Video' : 'Voice'} channel opened
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {data.channelName || 'Voice'}
                    </p>
                </div>
                <button
                    onClick={handleJoin}
                    disabled={joining}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-60 ${isVideo ? 'bg-blue-600 hover:bg-blue-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
                    {joining ? <Loader2 className="w-3 h-3 animate-spin" /> : (isVideo ? <Video className="w-3 h-3" /> : <Phone className="w-3 h-3" />)}
                    {joining ? 'Joining…' : 'Join'}
                </button>
            </div>
        </div>
    )
}

// ─── Group Chat Creation Modal ────────────────────────────────────────────────

function GroupChatModal({ users, onClose, onCreate, creating }) {
    const [name, setName]         = useState('')
    const [search, setSearch]     = useState('')
    const [selected, setSelected] = useState([]) // user objects

    const toggle = u => {
        setSelected(prev =>
            prev.find(x => x.id === u.id) ? prev.filter(x => x.id !== u.id) : [...prev, u]
        )
    }

    const filtered = users.filter(u => u.fullName?.toLowerCase().includes(search.toLowerCase()))

    const handleSubmit = e => {
        e.preventDefault()
        if (!name.trim() || selected.length === 0) return
        onCreate({ name, memberIds: selected.map(u => u.id) })
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="rounded-2xl w-full max-w-md shadow-2xl border"
                 style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                    <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <Users className="w-4 h-4 text-emerald-400" /> New Group Chat
                    </h2>
                    <button onClick={onClose} style={{ color: 'var(--text-secondary)' }}><X className="w-5 h-5" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Group Name *</label>
                        <input required value={name} onChange={e => setName(e.target.value)}
                               placeholder="e.g. Design Team"
                               className="w-full rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                               style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }} />
                    </div>

                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                            Add Members * ({selected.length} selected)
                        </label>
                        <input value={search} onChange={e => setSearch(e.target.value)}
                               placeholder="Search members..."
                               className="w-full rounded-xl py-2 px-3 text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                               style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }} />
                        <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl border" style={{ borderColor: 'var(--border-primary)' }}>
                            {filtered.map(u => {
                                const isSel = selected.find(x => x.id === u.id)
                                return (
                                    <button type="button" key={u.id} onClick={() => toggle(u)}
                                            className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-all ${isSel ? 'bg-emerald-600/20' : 'hover:bg-slate-700/40'}`}>
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${isSel ? 'bg-emerald-600' : 'bg-slate-600'}`}>
                                            {u.fullName?.charAt(0)}
                                        </div>
                                        <span className="text-sm flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{u.fullName}</span>
                                        {isSel && <span className="text-emerald-400 text-xs">✓</span>}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-1">
                        <button type="button" onClick={onClose}
                                className="flex-1 py-2.5 rounded-xl border text-sm transition-all"
                                style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>Cancel</button>
                        <button type="submit" disabled={creating || !name.trim() || selected.length === 0}
                                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 disabled:opacity-50 text-white font-medium text-sm transition-all flex items-center justify-center gap-2">
                            {creating ? <><Loader2 className="w-4 h-4 animate-spin" />Creating...</> : 'Create Group'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared-files modal — opens when the user clicks the conversation title /
// avatar. Lists every FILE / IMAGE message currently loaded, with download
// links. No extra API call: filters the existing `messages` state so older
// files only appear once they've been paged in by chat scroll, matching the
// mobile sheet's behaviour.
function SharedFilesModal({ messages, convName, onClose }) {
    const files = (messages || []).filter(m => m && (m.messageType === 'FILE' || m.messageType === 'IMAGE') && (m.fileUrl || m.fileName))
    const fileMeta = (name) => {
        const ext = String(name || '').split('.').pop()?.toLowerCase()
        if (['png','jpg','jpeg','gif','webp','bmp','heic','heif'].includes(ext)) return { color: 'text-emerald-400 bg-emerald-500/15', label: ext?.toUpperCase() }
        if (ext === 'pdf')                                                       return { color: 'text-red-400 bg-red-500/15',         label: 'PDF' }
        if (['doc','docx'].includes(ext))                                        return { color: 'text-blue-400 bg-blue-500/15',       label: ext?.toUpperCase() }
        if (['xls','xlsx','csv'].includes(ext))                                  return { color: 'text-green-400 bg-green-500/15',     label: ext?.toUpperCase() }
        if (['ppt','pptx'].includes(ext))                                        return { color: 'text-orange-400 bg-orange-500/15',   label: ext?.toUpperCase() }
        if (['zip','rar','7z','tar','gz'].includes(ext))                         return { color: 'text-purple-400 bg-purple-500/15',   label: ext?.toUpperCase() }
        if (['mp4','mov','webm','avi','mkv'].includes(ext))                      return { color: 'text-pink-400 bg-pink-500/15',       label: ext?.toUpperCase() }
        if (['mp3','wav','m4a','ogg','flac'].includes(ext))                      return { color: 'text-amber-400 bg-amber-500/15',     label: ext?.toUpperCase() }
        return { color: 'text-slate-400 bg-slate-500/15', label: (ext || 'FILE').toUpperCase() }
    }
    const formatBytes = (n) => {
        if (!n) return ''
        if (n < 1024) return `${n} B`
        if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
        return `${(n / 1024 / 1024).toFixed(1)} MB`
    }
    const formatTime = (ts) => {
        if (!ts) return ''
        const d = new Date(ts)
        return d.toLocaleDateString() + ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="rounded-2xl w-full max-w-lg shadow-2xl border max-h-[80vh] flex flex-col"
                 style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                <div className="flex items-center justify-between p-5"
                     style={{ borderBottom: '1px solid var(--border-primary)' }}>
                    <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <FolderOpen className="w-4 h-4 text-blue-400" />
                        Shared files in {convName} ({files.length})
                    </h2>
                    <button onClick={onClose} style={{ color: 'var(--text-secondary)' }}>
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="overflow-y-auto p-3">
                    {files.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <FolderOpen className="w-12 h-12 mb-3 opacity-25" style={{ color: 'var(--text-muted)' }} />
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No files shared in this conversation yet.</p>
                        </div>
                    ) : (
                        <ul className="space-y-1">
                            {files.slice().reverse().map(m => {
                                const meta = fileMeta(m.fileName)
                                return (
                                    <li key={m.id}>
                                        <a
                                            href={m.fileUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--bg-card-hover)] transition-all group"
                                        >
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-bold ${meta.color}`}>
                                                {meta.label.slice(0, 4)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                                                    {m.fileName || 'attachment'}
                                                </p>
                                                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                                                    {(m.sender?.fullName || m.sender?.name || '—')}
                                                    {' · '}{formatTime(m.createdAt)}
                                                    {m.fileSize ? ` · ${formatBytes(m.fileSize)}` : ''}
                                                </p>
                                            </div>
                                            <Download className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-secondary)' }} />
                                        </a>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    )
}
