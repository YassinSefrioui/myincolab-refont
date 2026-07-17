import { useEffect, useState } from 'react'
import { X, Download, ExternalLink, File, FileText, Image, Film, Music, AlertCircle, Loader2 } from 'lucide-react'
import api from '../api/axios'

const getFileType = (mimeType, fileName) => {
    if (!mimeType && !fileName) return 'other'
    const mime = (mimeType || '').toLowerCase()
    const name = (fileName || '').toLowerCase()
    if (mime.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg|bmp)$/.test(name)) return 'image'
    if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
    if (mime.startsWith('video/') || /\.(mp4|webm|ogg|mov|avi)$/.test(name)) return 'video'
    if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac)$/.test(name)) return 'audio'
    if (mime.startsWith('text/') || /\.(txt|md|csv|json|xml|yaml|yml|js|jsx|ts|tsx|html|css)$/.test(name)) return 'text'
    return 'other'
}

export default function FilePreviewModal({ file, onClose }) {
    const [blobUrl, setBlobUrl] = useState(null)
    const [textContent, setTextContent] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const fileType = getFileType(file?.mimeType, file?.originalName || file?.name)
    const fileName = file?.originalName || file?.name || 'File'

    useEffect(() => {
        if (!file?.id) return
        let objectUrl = null

        const load = async () => {
            try {
                setLoading(true)
                setError(null)
                const res = await api.get(`/files/${file.id}/download`, { responseType: 'blob' })
                objectUrl = URL.createObjectURL(res.data)

                if (fileType === 'text') {
                    const text = await res.data.text()
                    setTextContent(text)
                } else {
                    setBlobUrl(objectUrl)
                }
            } catch (e) {
                setError('Failed to load file preview.')
            } finally {
                setLoading(false)
            }
        }

        load()
        return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
    }, [file?.id, fileType])

    const handleDownload = async () => {
        try {
            const res = await api.get(`/files/${file.id}/download`, { responseType: 'blob' })
            const url = URL.createObjectURL(res.data)
            const a = document.createElement('a')
            a.href = url; a.download = fileName; a.click()
            URL.revokeObjectURL(url)
        } catch {
            // ignore
        }
    }

    const FileIcon = fileType === 'image' ? Image
        : fileType === 'pdf' ? FileText
        : fileType === 'video' ? Film
        : fileType === 'audio' ? Music
        : File

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col z-[200]"
             onClick={e => e.target === e.currentTarget && onClose()}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 bg-slate-900/95 border-b border-slate-700/50 flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    <FileIcon className="w-5 h-5 text-blue-400 flex-shrink-0" />
                    <span className="text-white font-medium truncate">{fileName}</span>
                    {file?.mimeType && (
                        <span className="text-slate-400 text-xs flex-shrink-0">{file.mimeType}</span>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    <button onClick={handleDownload}
                            title="Download"
                            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all">
                        <Download className="w-4 h-4" />
                    </button>
                    <button onClick={onClose}
                            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className={`flex-1 overflow-auto flex items-center justify-center ${fileType === 'pdf' ? 'p-0' : 'p-4'}`}>
                {loading ? (
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <span className="text-sm">Loading preview…</span>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center gap-3 text-red-400">
                        <AlertCircle className="w-8 h-8" />
                        <span className="text-sm">{error}</span>
                        <button onClick={handleDownload}
                                className="mt-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm transition-all flex items-center gap-2">
                            <Download className="w-4 h-4" /> Download instead
                        </button>
                    </div>
                ) : fileType === 'image' && blobUrl ? (
                    <img src={blobUrl} alt={fileName}
                         className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
                ) : fileType === 'pdf' && blobUrl ? (
                    <iframe src={blobUrl} title={fileName}
                            className="w-full h-full"
                            style={{ display: 'block', border: 'none' }} />
                ) : fileType === 'video' && blobUrl ? (
                    <video src={blobUrl} controls
                           className="max-w-full max-h-full rounded-lg shadow-2xl"
                           style={{ maxHeight: '75vh' }}>
                        Your browser does not support video playback.
                    </video>
                ) : fileType === 'audio' && blobUrl ? (
                    <div className="flex flex-col items-center gap-6 p-8">
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl">
                            <Music className="w-10 h-10 text-white" />
                        </div>
                        <p className="text-white font-medium">{fileName}</p>
                        <audio src={blobUrl} controls className="w-80" />
                    </div>
                ) : fileType === 'text' && textContent !== null ? (
                    <div className="w-full max-w-4xl bg-slate-900 rounded-xl border border-slate-700/50 overflow-auto"
                         style={{ maxHeight: '75vh' }}>
                        <pre className="p-6 text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-mono">
                            {textContent}
                        </pre>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4 text-slate-400">
                        <div className="w-20 h-20 rounded-2xl bg-slate-700/50 flex items-center justify-center">
                            <File className="w-10 h-10 text-slate-500" />
                        </div>
                        <p className="text-sm">No preview available for this file type.</p>
                        <button onClick={handleDownload}
                                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm transition-all flex items-center gap-2">
                            <Download className="w-4 h-4" /> Download
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
