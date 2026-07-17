import { useState, useEffect } from 'react'
import { X, Link, Copy, Check, Phone, Video, Loader2, Trash2, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CallLinkGenerator({ onClose, onSend }) {
    const [mode, setMode]               = useState('audio')
    const [expiryHours, setExpiryHours] = useState(24)
    const [generatedUrl, setGeneratedUrl] = useState('')
    const [linkId, setLinkId]           = useState('')
    const [loading, setLoading]         = useState(false)
    const [copied, setCopied]           = useState(false)
    const [sending, setSending]         = useState(false)

    const [myLinks, setMyLinks]         = useState([])
    const [loadingLinks, setLoadingLinks] = useState(false)
    const [revoking, setRevoking]       = useState(null)   // linkId being revoked
    const [copiedId, setCopiedId]       = useState(null)   // which existing link was copied

    const getToken = () =>
        localStorage.getItem('token') ||
        JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.token

    const fetchMyLinks = async () => {
        setLoadingLinks(true)
        try {
            const r = await fetch('/api/call-links', {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            const d = await r.json()
            setMyLinks(d.data || [])
        } catch {}
        finally { setLoadingLinks(false) }
    }

    useEffect(() => { fetchMyLinks() }, [])

    const handleRevoke = async (id) => {
        setRevoking(id)
        try {
            const r = await fetch(`/api/call-links/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            if (!r.ok) throw new Error()
            toast.success('Link revoked')
            setMyLinks(prev => prev.filter(l => l.linkId !== id))
            if (linkId === id) { setGeneratedUrl(''); setLinkId('') }
        } catch { toast.error('Failed to revoke link') }
        finally { setRevoking(null) }
    }

    const handleCopyExisting = (url, id) => {
        navigator.clipboard.writeText(url).then(() => {
            setCopiedId(id)
            setTimeout(() => setCopiedId(null), 2000)
            toast.success('Link copied!')
        })
    }

    const handleGenerate = async () => {
        setLoading(true)
        try {
            const r = await fetch('/api/call-links', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({ mode, expiryHours })
            })
            const d = await r.json()
            if (!d.success) throw new Error(d.message || 'Failed to generate link')
            setLinkId(d.data.linkId)
            setGeneratedUrl(`${window.location.origin}/call/${d.data.linkId}`)
            // Refresh the existing links list so the new one appears immediately
            fetchMyLinks()
        } catch (e) {
            toast.error(e.message || 'Failed to generate link')
        } finally {
            setLoading(false)
        }
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(generatedUrl).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
            toast.success('Link copied!')
        })
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl">
                <div className="flex items-center justify-between p-5 border-b border-slate-700">
                    <div className="flex items-center gap-2">
                        <Link className="w-4 h-4 text-blue-400" />
                        <h2 className="text-sm font-semibold text-white">Generate Call Link</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {/* Call type */}
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-2">Call type</label>
                        <div className="flex gap-2">
                            <button onClick={() => setMode('audio')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                                        mode === 'audio'
                                            ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400'
                                            : 'border-slate-600/50 text-slate-400 hover:text-white hover:border-slate-500'
                                    }`}>
                                <Phone className="w-3.5 h-3.5" /> Audio
                            </button>
                            <button onClick={() => setMode('video')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                                        mode === 'video'
                                            ? 'bg-blue-600/20 border-blue-500/50 text-blue-400'
                                            : 'border-slate-600/50 text-slate-400 hover:text-white hover:border-slate-500'
                                    }`}>
                                <Video className="w-3.5 h-3.5" /> Video
                            </button>
                        </div>
                    </div>

                    {/* Expiry */}
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-2">Link expires in</label>
                        <div className="grid grid-cols-4 gap-1.5">
                            {[1, 4, 24, 168].map(h => (
                                <button key={h} onClick={() => setExpiryHours(h)}
                                        className={`py-2 rounded-lg text-xs font-medium transition-all ${
                                            expiryHours === h
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-600'
                                        }`}>
                                    {h === 168 ? '7d' : h === 24 ? '24h' : `${h}h`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {!generatedUrl ? (
                        <button onClick={handleGenerate} disabled={loading}
                                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-medium text-sm transition-all flex items-center justify-center gap-2">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
                            {loading ? 'Generating...' : 'Generate Link'}
                        </button>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 p-3 bg-slate-900/50 border border-slate-600/50 rounded-xl">
                                <span className="flex-1 text-xs text-blue-300 font-mono truncate">{generatedUrl}</span>
                                <button onClick={handleCopy}
                                        className="flex-shrink-0 p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-all">
                                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                            </div>
                            {onSend && (
                                <button onClick={async () => {
                                    setSending(true)
                                    try { await onSend(linkId, mode); onClose() }
                                    finally { setSending(false) }
                                }} disabled={sending}
                                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-medium text-xs transition-all flex items-center justify-center gap-2">
                                    {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                    {sending ? 'Sending...' : 'Send to Chat'}
                                </button>
                            )}
                            <button onClick={() => { setGeneratedUrl(''); setLinkId('') }}
                                    className="w-full py-2 text-xs text-slate-400 hover:text-white transition-colors">
                                ↻ Generate another
                            </button>
                        </div>
                    )}
                </div>

                {/* My existing active links */}
                <div className="border-t border-slate-700/60 pt-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">My active links</span>
                        <button onClick={fetchMyLinks} disabled={loadingLinks}
                                className="text-slate-500 hover:text-slate-300 transition-colors">
                            <RefreshCw className={`w-3.5 h-3.5 ${loadingLinks ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    {loadingLinks && myLinks.length === 0 ? (
                        <div className="flex items-center justify-center py-3">
                            <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                        </div>
                    ) : myLinks.length === 0 ? (
                        <p className="text-xs text-slate-600 py-2 text-center">No active links</p>
                    ) : (
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                            {myLinks.map(link => {
                                const url = `${window.location.origin}/call/${link.linkId}`
                                const isAudio = link.mode === 'audio'
                                return (
                                    <div key={link.linkId}
                                         className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/50 border border-slate-700/50">
                                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${isAudio ? 'bg-emerald-900/40 text-emerald-400' : 'bg-blue-900/40 text-blue-400'}`}>
                                            {isAudio ? '🎙' : '🎥'}
                                        </span>
                                        <span className="flex-1 text-xs text-slate-400 font-mono truncate">{link.linkId}</span>
                                        <button onClick={() => handleCopyExisting(url, link.linkId)}
                                                className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-600/60 text-slate-400 hover:text-white transition-all">
                                            {copiedId === link.linkId
                                                ? <Check className="w-3 h-3 text-emerald-400" />
                                                : <Copy className="w-3 h-3" />}
                                        </button>
                                        <button onClick={() => handleRevoke(link.linkId)}
                                                disabled={revoking === link.linkId}
                                                className="p-1.5 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 transition-all disabled:opacity-50">
                                            {revoking === link.linkId
                                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                                : <Trash2 className="w-3 h-3" />}
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
