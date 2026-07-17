import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Send, Loader2, Sparkles, Trash2, User, ChevronDown, GripHorizontal, Zap, FolderOpen, Users } from 'lucide-react'
import DOMPurify from 'dompurify'
import api from '../api/axios'
import useAuthStore from '../store/authStore'

// ─── Markdown renderer ────────────────────────────────────────────────────────
function renderMd(text) {
    let html = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    html = html.replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>')
    html = html.replace(/\*(.+?)\*/g,          '<em>$1</em>')
    html = html.replace(/`([^`]+)`/g,          '<code class="bg-slate-700/60 px-1 py-0.5 rounded text-blue-300 text-xs">$1</code>')
    html = html.replace(/^### (.+)$/gm,        '<p class="font-bold text-white mt-2 mb-1">$1</p>')
    html = html.replace(/^## (.+)$/gm,         '<p class="font-bold text-white text-base mt-3 mb-1">$1</p>')
    html = html.replace(/^# (.+)$/gm,          '<p class="font-bold text-white text-lg mt-3 mb-1">$1</p>')
    html = html.replace(/^[•\-\*] (.+)$/gm,   '<li class="ml-4 list-disc text-slate-300">$1</li>')
    html = html.replace(/(<li[\s\S]+?<\/li>\n?)+/g, m => `<ul class="space-y-0.5 my-1">${m}</ul>`)
    html = html.replace(/\n/g, '<br />')
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['strong','em','code','p','ul','li','br'],
        ALLOWED_ATTR: ['class'],
    })
}

// ─── Suggestion detection ─────────────────────────────────────────────────────
function computeSuggestions(text, projects, users) {
    if (!text || text.length < 2) return []
    const trimmed = text.trimEnd()
    const words   = trimmed.split(/\s+/)
    const hits    = []
    const seen    = new Set()

    // Try matching last 1–4 words against known project/user names
    for (let n = 1; n <= Math.min(4, words.length); n++) {
        const partial     = words.slice(-n).join(' ')
        const partialLow  = partial.toLowerCase()
        if (partial.length < 2) continue

        for (const p of projects) {
            const low = p.name.toLowerCase()
            if (low.startsWith(partialLow) && low !== partialLow && !seen.has('p' + p.id)) {
                hits.push({ type: 'project', label: p.name, icon: '📁', partial, nWords: n })
                seen.add('p' + p.id)
            }
        }
        for (const u of users) {
            const low = u.fullName.toLowerCase()
            if (low.startsWith(partialLow) && low !== partialLow && !seen.has('u' + u.id)) {
                hits.push({ type: 'user', label: u.fullName, icon: '👤', partial, nWords: n })
                seen.add('u' + u.id)
            }
        }
    }

    // Most specific match first (more words matched = better)
    hits.sort((a, b) => b.nWords - a.nWords)
    return hits.slice(0, 6)
}

function applySuggestion(currentInput, suggestion) {
    const words    = currentInput.trimEnd().split(/\s+/)
    const newWords = words.slice(0, words.length - suggestion.nWords)
    newWords.push(suggestion.label)
    return newWords.join(' ') + ' '
}

// ─── Panel size / position ────────────────────────────────────────────────────
const PANEL_W    = 420
const PANEL_H    = 620
const PANEL_H_MIN = 56

function defaultPos() {
    return { x: window.innerWidth - PANEL_W - 24, y: window.innerHeight - PANEL_H - 24 }
}
function loadPos() {
    try {
        const s = localStorage.getItem('ai-panel-pos')
        if (!s) return defaultPos()
        const p = JSON.parse(s)
        return {
            x: Math.max(0, Math.min(window.innerWidth  - PANEL_W,    p.x)),
            y: Math.max(0, Math.min(window.innerHeight - PANEL_H_MIN, p.y)),
        }
    } catch { return defaultPos() }
}

const ROLE_COLOR = {
    SUPER_ADMIN: '#f59e0b', ADMIN: '#ef4444', MANAGER: '#8b5cf6',
    EMPLOYEE: '#3b82f6',    GUEST: '#6b7280',
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AIAssistantPanel({ onClose }) {
    const { user }    = useAuthStore()
    const navigate    = useNavigate()
    const role        = user?.role || 'EMPLOYEE'
    const canCreate   = ['MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(role)
    const roleColor   = ROLE_COLOR[role] || '#3b82f6'

    const [messages,  setMessages]  = useState([{
        role: 'assistant',
        content: `Hey ${user?.fullName?.split(' ')[0] || 'there'} 👋 — I'm your INCO LAB assistant.\nI can answer questions about your projects and tasks${canCreate ? ', create tasks, projects, send messages' : ''}, and more. Just ask!`,
        ts: new Date(),
        isAction: false,
    }])
    const [input,     setInput]     = useState('')
    const [loading,   setLoading]   = useState(false)
    const [minimized, setMinimized] = useState(false)
    const [pos,       setPos]       = useState(loadPos)

    // ── Autocomplete data ─────────────────────────────────────────────────────
    const [acProjects, setAcProjects] = useState([])
    const [acUsers,    setAcUsers]    = useState([])
    const [suggIdx,    setSuggIdx]    = useState(-1)   // keyboard navigation

    useEffect(() => {
        api.get('/projects').then(r => setAcProjects(r.data.data || [])).catch(() => {})
        api.get('/users/search').then(r => setAcUsers(r.data.data || [])).catch(() => {})
    }, [])

    const suggestions = useMemo(
        () => computeSuggestions(input, acProjects, acUsers),
        [input, acProjects, acUsers]
    )

    // ── Drag ──────────────────────────────────────────────────────────────────
    const panelRef    = useRef(null)
    const dragRef     = useRef(null)
    const bottomRef   = useRef(null)
    const inputRef    = useRef(null)
    const historyRef  = useRef([])

    useEffect(() => {
        const onResize = () => setPos(prev => ({
            x: Math.max(0, Math.min(window.innerWidth  - PANEL_W,    prev.x)),
            y: Math.max(0, Math.min(window.innerHeight - PANEL_H_MIN, prev.y)),
        }))
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [])

    const onDragStart = useCallback(e => {
        if (e.target.closest('button, input, textarea')) return
        const r = panelRef.current?.getBoundingClientRect()
        if (!r) return
        dragRef.current = { ox: e.clientX - r.left, oy: e.clientY - r.top }

        const onMove = ev => {
            if (!dragRef.current || !panelRef.current) return
            const pH = minimized ? PANEL_H_MIN : PANEL_H
            const x  = Math.max(0, Math.min(window.innerWidth  - PANEL_W, ev.clientX - dragRef.current.ox))
            const y  = Math.max(0, Math.min(window.innerHeight - pH,       ev.clientY - dragRef.current.oy))
            const p  = { x, y }
            setPos(p)
            localStorage.setItem('ai-panel-pos', JSON.stringify(p))
        }
        const onUp = () => {
            dragRef.current = null
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup',   onUp)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup',   onUp)
        e.preventDefault()
    }, [minimized])

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, minimized])
    useEffect(() => { if (!minimized) setTimeout(() => inputRef.current?.focus(), 100) }, [minimized])

    // ── Send message ──────────────────────────────────────────────────────────
    const send = async () => {
        const text = input.trim()
        if (!text || loading) return
        setSuggIdx(-1)
        setInput('')
        if (inputRef.current) { inputRef.current.style.height = 'auto' }

        const userMsg = { role: 'user', content: text, ts: new Date(), isAction: false }
        setMessages(prev => [...prev, userMsg])
        historyRef.current = [...historyRef.current, { role: 'user', content: text }]
        if (historyRef.current.length > 40) historyRef.current = historyRef.current.slice(-40)

        setLoading(true)
        try {
            const res    = await api.post('/ai/assistant', { message: text, history: historyRef.current.slice(0, -1) })
            const reply  = res.data.text || 'No response received.'
            historyRef.current = [...historyRef.current, { role: 'assistant', content: reply }]

            // Detect if this was an action (tool execution) response
            const isAction = /created|sent|updated|marked|done!|task created|project created|message sent/i.test(reply)

            setMessages(prev => [...prev, { role: 'assistant', content: reply, ts: new Date(), isAction }])
        } catch (err) {
            const errMsg = err.response?.data?.error || 'Failed to reach AI. Please try again.'
            setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${errMsg}`, ts: new Date(), isError: true, isAction: false }])
        } finally {
            setLoading(false)
            setTimeout(() => inputRef.current?.focus(), 50)
        }
    }

    const clearConversation = () => {
        historyRef.current = []
        setMessages([{ role: 'assistant', content: 'Conversation cleared. What can I help you with?', ts: new Date(), isAction: false }])
    }

    const fmtTime = d => d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })

    const handleMinimize = () => {
        if (!minimized) {
            setPos(prev => {
                const p = { ...prev, y: Math.max(0, prev.y + (PANEL_H - PANEL_H_MIN)) }
                localStorage.setItem('ai-panel-pos', JSON.stringify(p))
                return p
            })
        } else {
            setPos(prev => {
                const p = { ...prev, y: Math.max(0, Math.min(window.innerHeight - PANEL_H, prev.y - (PANEL_H - PANEL_H_MIN))) }
                localStorage.setItem('ai-panel-pos', JSON.stringify(p))
                return p
            })
        }
        setMinimized(v => !v)
    }

    // ── Handle keyboard in input ──────────────────────────────────────────────
    const handleKeyDown = e => {
        if (suggestions.length > 0) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSuggIdx(i => Math.min(i + 1, suggestions.length - 1)) }
            if (e.key === 'ArrowUp')   { e.preventDefault(); setSuggIdx(i => Math.max(i - 1, -1)) }
            if (e.key === 'Tab' || (e.key === 'Enter' && suggIdx >= 0)) {
                e.preventDefault()
                const s = suggestions[suggIdx >= 0 ? suggIdx : 0]
                setInput(applySuggestion(input, s))
                setSuggIdx(-1)
                return
            }
            if (e.key === 'Escape') { setSuggIdx(-1); return }
        }
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
    }

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div
            ref={panelRef}
            style={{
                position: 'fixed', left: pos.x, top: pos.y,
                width: PANEL_W, height: minimized ? PANEL_H_MIN : PANEL_H,
                zIndex: 9000, display: 'flex', flexDirection: 'column',
                borderRadius: 16, overflow: 'hidden',
                boxShadow: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)',
                background: 'rgba(15,23,42,0.97)', backdropFilter: 'blur(20px)',
                border: '1px solid rgba(100,116,139,0.3)',
                transition: 'height 0.25s cubic-bezier(0.4,0,0.2,1)',
                userSelect: 'none',
            }}
        >
            {/* ── Header ──────────────────────────────────────────────────── */}
            <div onMouseDown={onDragStart} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', flexShrink: 0,
                borderBottom: minimized ? 'none' : '1px solid rgba(51,65,85,0.5)',
                background: 'linear-gradient(135deg, #1e3a5f 0%, #1e1b4b 100%)',
                cursor: 'grab',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <GripHorizontal size={14} style={{ color: 'rgba(148,163,184,0.5)', flexShrink: 0 }} />
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Sparkles size={15} style={{ color: '#60a5fa' }} />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>AI Assistant</p>
                            <span style={{ fontSize: 9, fontWeight: 700, color: roleColor, background: `${roleColor}22`, border: `1px solid ${roleColor}44`, borderRadius: 6, padding: '1px 5px', letterSpacing: '0.05em' }}>
                                {role.replace('_', ' ')}
                            </span>
                        </div>
                        <p style={{ margin: 0, fontSize: 11, color: 'rgba(147,197,253,0.7)', lineHeight: 1.2 }}>Powered by Claude · can take actions</p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 4 }} onMouseDown={e => e.stopPropagation()}>
                    {!minimized && (
                        <button onClick={clearConversation} title="Clear conversation"
                                style={{ padding: 6, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(148,163,184,0.7)', display: 'flex', alignItems: 'center' }}
                                onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                                onMouseLeave={e => e.currentTarget.style.color = 'rgba(148,163,184,0.7)'}>
                            <Trash2 size={14} />
                        </button>
                    )}
                    <button onClick={handleMinimize}
                            style={{ padding: 6, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(148,163,184,0.7)', display: 'flex', alignItems: 'center' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                            onMouseLeave={e => e.currentTarget.style.color = 'rgba(148,163,184,0.7)'}>
                        <ChevronDown size={16} style={{ transform: minimized ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>
                    <button onClick={onClose}
                            style={{ padding: 6, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(148,163,184,0.7)', display: 'flex', alignItems: 'center' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                            onMouseLeave={e => e.currentTarget.style.color = 'rgba(148,163,184,0.7)'}>
                        <X size={15} />
                    </button>
                </div>
            </div>

            {/* ── Body ────────────────────────────────────────────────────── */}
            {!minimized && (
                <>
                    {/* Messages */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 14, scrollbarWidth: 'thin', userSelect: 'text' }}>
                        {messages.map((msg, i) => (
                            <div key={i} style={{ display: 'flex', gap: 10, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                                <div style={{
                                    width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginTop: 2,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: msg.role === 'user' ? 'rgba(59,130,246,0.2)' : msg.isAction ? 'rgba(5,150,105,0.25)' : 'rgba(139,92,246,0.2)',
                                    border: `1px solid ${msg.role === 'user' ? 'rgba(59,130,246,0.3)' : msg.isAction ? 'rgba(16,185,129,0.4)' : 'rgba(139,92,246,0.3)'}`,
                                }}>
                                    {msg.role === 'user'
                                        ? <User     size={13} style={{ color: '#60a5fa' }} />
                                        : msg.isAction
                                            ? <Zap  size={13} style={{ color: '#34d399' }} />
                                            : <Sparkles size={13} style={{ color: '#a78bfa' }} />
                                    }
                                </div>

                                <div style={{ maxWidth: '84%', display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 4 }}>
                                    <div style={{
                                        borderRadius: 14, padding: '10px 14px', fontSize: 13, lineHeight: 1.55,
                                        borderTopRightRadius: msg.role === 'user' ? 4 : 14,
                                        borderTopLeftRadius:  msg.role === 'user' ? 14 : 4,
                                        background: msg.role === 'user'
                                            ? '#2563eb'
                                            : msg.isError
                                                ? 'rgba(127,29,29,0.4)'
                                                : msg.isAction
                                                    ? 'rgba(5,78,56,0.45)'
                                                    : 'rgba(30,41,59,0.8)',
                                        border: msg.role === 'user' ? 'none'
                                            : msg.isError   ? '1px solid rgba(239,68,68,0.3)'
                                            : msg.isAction  ? '1px solid rgba(16,185,129,0.35)'
                                            : '1px solid rgba(51,65,85,0.5)',
                                        color: msg.role === 'user' ? '#fff' : msg.isError ? '#fca5a5' : '#e2e8f0',
                                    }}>
                                        {msg.role === 'user'
                                            ? <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                                            : <span dangerouslySetInnerHTML={{ __html: renderMd(msg.content) }} />
                                        }
                                    </div>
                                    <span style={{ fontSize: 11, color: 'rgba(100,116,139,0.8)', padding: '0 4px' }}>{fmtTime(msg.ts)}</span>
                                </div>
                            </div>
                        ))}

                        {/* Typing indicator */}
                        {loading && (
                            <div style={{ display: 'flex', gap: 10 }}>
                                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Sparkles size={13} style={{ color: '#a78bfa' }} />
                                </div>
                                <div style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(51,65,85,0.5)', borderRadius: 14, borderTopLeftRadius: 4, padding: '12px 16px' }}>
                                    <div style={{ display: 'flex', gap: 5, alignItems: 'center', height: 16 }}>
                                        {[0,150,300].map(delay => (
                                            <div key={delay} style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa', animation: 'aiPanelBounce 1.2s ease-in-out infinite', animationDelay: `${delay}ms` }} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={bottomRef} />
                    </div>

                    {/* Quick-action preset chips */}
                    {canCreate && (
                        <div style={{ padding: '6px 14px 0', display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap' }}>
                            {[
                                { label: '➕ New project', text: 'Create a new project', bg: 'rgba(5,150,105,0.12)', border: 'rgba(16,185,129,0.25)', color: '#6ee7b7' },
                                { label: '✅ New task',    text: 'Create a new task',    bg: 'rgba(124,58,237,0.12)', border: 'rgba(139,92,246,0.25)', color: '#c4b5fd' },
                                { label: '🔴 Overdue',     text: 'Which of my tasks are overdue?', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)', color: '#fca5a5' },
                                { label: '💬 Send msg',    text: 'Send a message to',   bg: 'rgba(234,88,12,0.12)', border: 'rgba(249,115,22,0.25)', color: '#fdba74' },
                            ].map(({ label, text, bg, border, color }) => (
                                <button key={label}
                                        onClick={() => { setInput(text); setTimeout(() => inputRef.current?.focus(), 50) }}
                                        style={{ padding: '5px 10px', borderRadius: 8, background: bg, border: `1px solid ${border}`, color, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                                        onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.25)'}
                                        onMouseLeave={e => e.currentTarget.style.filter = ''}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* ── Input area ─────────────────────────────────────────── */}
                    <div style={{ padding: canCreate ? '6px 14px 14px' : '10px 14px 14px', flexShrink: 0, borderTop: '1px solid rgba(51,65,85,0.3)', userSelect: 'text', position: 'relative' }}>

                        {/* Suggestion dropdown */}
                        {suggestions.length > 0 && (
                            <div style={{
                                position: 'absolute', bottom: '100%', left: 14, right: 14, marginBottom: 4,
                                background: 'rgba(15,23,42,0.98)', border: '1px solid rgba(51,65,85,0.6)',
                                borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                                zIndex: 10,
                            }}>
                                <div style={{ padding: '5px 10px 3px', fontSize: 10, color: 'rgba(100,116,139,0.7)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                    Suggestions — Tab to complete
                                </div>
                                {suggestions.map((s, idx) => (
                                    <button key={idx}
                                            onMouseDown={e => { e.preventDefault(); setInput(applySuggestion(input, s)); setSuggIdx(-1); setTimeout(() => inputRef.current?.focus(), 30) }}
                                            style={{
                                                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                                padding: '8px 12px', textAlign: 'left', border: 'none', cursor: 'pointer',
                                                fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
                                                background: idx === suggIdx ? 'rgba(59,130,246,0.15)' : 'transparent',
                                                color: 'var(--text-primary, #e2e8f0)',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.1)' }}
                                            onMouseLeave={e => { e.currentTarget.style.background = idx === suggIdx ? 'rgba(59,130,246,0.15)' : 'transparent' }}>
                                        <span style={{ fontSize: 15 }}>{s.icon}</span>
                                        <span>{s.label}</span>
                                        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(100,116,139,0.6)', background: 'rgba(30,41,59,0.8)', padding: '2px 6px', borderRadius: 5 }}>
                                            {s.type}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                            <textarea
                                ref={inputRef}
                                rows={1}
                                value={input}
                                onChange={e => {
                                    setInput(e.target.value)
                                    setSuggIdx(-1)
                                    e.target.style.height = 'auto'
                                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                                }}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask anything or say 'create a task in [project]'…"
                                disabled={loading}
                                style={{
                                    flex: 1, background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(51,65,85,0.5)',
                                    borderRadius: 12, padding: '10px 14px', color: '#e2e8f0',
                                    fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'inherit',
                                    minHeight: 40, maxHeight: 120, opacity: loading ? 0.5 : 1,
                                    transition: 'border-color 0.15s',
                                }}
                                onFocus={e => e.target.style.borderColor = '#3b82f6'}
                                onBlur={e  => e.target.style.borderColor = 'rgba(51,65,85,0.5)'}
                            />
                            <button onClick={send} disabled={loading || !input.trim()}
                                    style={{
                                        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                                        background: loading || !input.trim() ? 'rgba(51,65,85,0.5)' : '#2563eb',
                                        border: 'none', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: '#fff', transition: 'background 0.15s',
                                        opacity: loading || !input.trim() ? 0.5 : 1,
                                    }}>
                                {loading ? <Loader2 size={16} style={{ animation: 'aiPanelSpin 1s linear infinite' }} /> : <Send size={16} />}
                            </button>
                        </div>
                        <p style={{ margin: '5px 0 0', fontSize: 10, color: 'rgba(100,116,139,0.55)', textAlign: 'center' }}>
                            Enter to send · Tab to autocomplete · Shift+Enter for newline
                        </p>
                    </div>
                </>
            )}

            <style>{`
                @keyframes aiPanelBounce { 0%,80%,100% { transform:translateY(0); opacity:0.4; } 40% { transform:translateY(-5px); opacity:1; } }
                @keyframes aiPanelSpin   { to { transform: rotate(360deg) } }
            `}</style>
        </div>
    )
}
