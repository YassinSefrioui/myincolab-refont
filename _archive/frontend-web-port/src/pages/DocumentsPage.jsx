import { useEffect, useState, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import {
    FileText, Search, Upload, Download, Star, Eye, X, Folder, FolderOpen,
    Loader2, Globe, Plus, ChevronRight, ChevronDown, MoreHorizontal,
    Trash2, Edit2, Lock, Unlock, ArrowLeft, RefreshCw, SlidersHorizontal,
    Calendar, HardDrive, Tag, FolderPlus, Archive, RotateCcw, FolderInput
} from 'lucide-react'
import gsap from 'gsap'
import api from '../api/axios'
import useAuthStore from '../store/authStore'
import toast from 'react-hot-toast'
import FilePreviewModal from '../components/FilePreviewModal'

// ─── Helper ───────────────────────────────────────────────────────────────────

const FILE_ICON = t => {
    if (!t) return '📄'
    if (t.includes('image'))  return '🖼️'
    if (t.includes('pdf'))    return '📕'
    if (t.includes('word') || t.includes('document')) return '📝'
    if (t.includes('sheet') || t.includes('excel'))   return '📊'
    if (t.includes('video'))  return '🎬'
    if (t.includes('zip') || t.includes('rar'))       return '🗜️'
    return '📄'
}

const FMT_SIZE = b => {
    if (!b) return '—'
    if (b < 1024)        return b + ' B'
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB'
    return (b / 1024 / 1024).toFixed(1) + ' MB'
}

const FILE_TYPE_OPTIONS = [
    { value: '',      label: 'All types' },
    { value: 'image', label: 'Images'    },
    { value: 'pdf',   label: 'PDF'       },
    { value: 'word',  label: 'Documents' },
    { value: 'sheet', label: 'Sheets'    },
    { value: 'video', label: 'Videos'    },
]

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
    const { user } = useAuthStore()
    const userId      = user?.id || user?.userId
    const isAdmin     = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
    const canCreateFolder = user?.role !== 'GUEST'
    const location = useLocation()

    const canManageFolder = (folder) => isAdmin || String(folder?.createdBy?.id) === String(userId)
    const canManageFile   = (file)   => isAdmin || String(file?.uploadedBy?.id) === String(userId) || String(file?.createdBy?.id) === String(userId)

    // Navigation folders
    const [breadcrumb, setBreadcrumb]   = useState([]) // [{id, name}]
    const [folders, setFolders]         = useState([])
    const [files, setFiles]             = useState([])
    const [loading, setLoading]         = useState(true)
    const [groups, setGroups]           = useState([])

    // UI
    const [selected, setSelected]       = useState(null)
    const [previewFile, setPreviewFile] = useState(null)
    const [highlightFileId, setHighlightFileId] = useState(null)
    const fileRowRefs = useRef({}) // map of fileId -> DOM element
    const [showNewFolder, setShowNewFolder] = useState(false)
    const [newFolderName, setNewFolderName] = useState('')
    const [creating, setCreating]       = useState(false)
    const [uploading, setUploading]     = useState(false)
    const [dragOver, setDragOver]       = useState(false)
    const [folderMenu, setFolderMenu]   = useState(null) // id of folder with open menu

    // Filtres avancés
    const [showFilters, setShowFilters] = useState(false)
    const [search, setSearch]           = useState('')
    const [searching, setSearching]     = useState(false)
    const [filters, setFilters]         = useState({
        type:    '',       // image, pdf, word, sheet, video
        source:  'all',    // all | public | projects | folder
        sizeMin: '',
        sizeMax: '',
        dateFrom:'',
        dateTo:  '',
    })
    const searchTimeout = useRef(null)
    const containerRef = useRef(null)

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.fromTo('.docs-header',
                { opacity: 0, y: -24, scale: 0.97 },
                { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'power3.out', clearProps: 'transform' }
            )
            gsap.fromTo('.docs-sidebar-item',
                { opacity: 0, x: -16 },
                { opacity: 1, x: 0, duration: 0.35, stagger: 0.05, delay: 0.1,
                    ease: 'power2.out', clearProps: 'transform' }
            )
            gsap.fromTo('.docs-file-card',
                { opacity: 0, y: 22, scale: 0.94, rotateX: 8 },
                { opacity: 1, y: 0, scale: 1, rotateX: 0, duration: 0.45, stagger: 0.05, delay: 0.15,
                    ease: 'back.out(1.2)', clearProps: 'transform' }
            )
            // Animate stat numbers
            document.querySelectorAll('.docs-stat-value').forEach(el => {
                const target = parseInt(el.textContent, 10) || 0
                if (target > 0) {
                    gsap.from(el, { textContent: 0, duration: 1, delay: 0.3, ease: 'power2.out', snap: { textContent: 1 } })
                }
            })
        }, containerRef)
        return () => ctx.revert()
    }, [])

    const currentFolderId = breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].id : null

    // ── Chargement ────────────────────────────────────────────────────────────

    const loadContent = useCallback(async (folderId = null) => {
        setLoading(true)
        try {
            if (folderId) {
                // Dans un dossier : charger sous-dossiers + fichiers du dossier
                const [subRes, fileRes] = await Promise.all([
                    api.get(`/folders/${folderId}/subfolders`),
                    api.get(`/folders/${folderId}/files`),
                ])
                setFolders(subRes.data.data || [])
                setFiles(fileRes.data.data || [])
            } else {
                // Racine : dossiers racine + fichiers sans dossier
                const [folderRes, fileRes] = await Promise.all([
                    api.get('/folders/root'),
                    api.get('/files/my-documents'),
                ])
                setFolders(folderRes.data.data || [])
                // Fichiers sans dossier seulement à la racine
                setFiles((fileRes.data.data || []).filter(f => !f.folderId))
            }
        } catch { toast.error('Failed to load content') }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { loadContent(currentFolderId) }, [currentFolderId])

    useEffect(() => {
        api.get('/groups').then(r => setGroups(r.data.data || [])).catch(() => {})
    }, [])

    // Deep-link from global search: highlight and scroll to a specific file
    useEffect(() => {
        if (!location.state?.highlightFileId && !location.state?.openFolderId) return
        if (location.state?.openFolderId) {
            setBreadcrumb([{ id: location.state.openFolderId, name: location.state.openFolderName || 'Folder' }])
        }
        if (location.state?.highlightFileId) {
            const fid = String(location.state.highlightFileId)
            setHighlightFileId(fid)
            setTimeout(() => {
                const el = fileRowRefs.current[fid]
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }, 400)
            setTimeout(() => setHighlightFileId(null), 3000)
        }
        window.history.replaceState({}, '', location.pathname)
    }, [location.state])

    // ── Recherche avec debounce ───────────────────────────────────────────────

    useEffect(() => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current)
        if (!search.trim()) { loadContent(currentFolderId); return }
        searchTimeout.current = setTimeout(async () => {
            setSearching(true)
            try {
                const [filesRes, foldersRes] = await Promise.allSettled([
                    api.get(`/files/my-documents/search?keyword=${encodeURIComponent(search)}`),
                    api.get(`/folders/search?keyword=${encodeURIComponent(search)}`),
                ])
                setFiles(filesRes.status === 'fulfilled' ? filesRes.value.data.data || [] : [])
                setFolders(foldersRes.status === 'fulfilled' ? foldersRes.value.data.data || [] : [])
            } catch {} finally { setSearching(false) }
        }, 400)
        return () => clearTimeout(searchTimeout.current)
    }, [search])

    // ── Navigation dossiers ───────────────────────────────────────────────────

    const openFolder = folder => {
        setBreadcrumb(prev => [...prev, { id: folder.id, name: folder.name }])
    }

    const goToBreadcrumb = index => {
        if (index === -1) { setBreadcrumb([]); return }
        setBreadcrumb(prev => prev.slice(0, index + 1))
    }

    // ── Actions dossiers ──────────────────────────────────────────────────────

    const handleCreateFolder = async e => {
        e.preventDefault(); if (!newFolderName.trim()) return
        setCreating(true)
        try {
            await api.post('/folders', { name: newFolderName, parentFolderId: currentFolderId })
            toast.success('Folder created!')
            setNewFolderName(''); setShowNewFolder(false)
            loadContent(currentFolderId)
        } catch { toast.error('Failed to create folder') }
        finally { setCreating(false) }
    }

    const handleDeleteFolder = async id => {
        if (!confirm('Delete this folder and all its contents?')) return
        try {
            await api.delete(`/folders/${id}`)
            toast.success('Folder deleted')
            loadContent(currentFolderId)
        } catch { toast.error('Failed to delete folder') }
    }

    const [showArchived, setShowArchived] = useState(false)
    const [renameModal, setRenameModal] = useState(null) // { id, name }
    const [moveModal, setMoveModal]     = useState(null) // { fileId, fileName }

    const handleRenameFolder = (folder) => {
        setRenameModal({ id: folder.id, name: folder.name })
    }

    const handleArchiveFolder = async id => {
        try { await api.patch(`/folders/${id}/archive`); toast.success('Folder archived'); loadContent(currentFolderId) }
        catch { toast.error('Failed to archive') }
    }

    const handleUnarchiveFolder = async id => {
        try { await api.patch(`/folders/${id}/unarchive`); toast.success('Folder unarchived'); loadContent(currentFolderId) }
        catch { toast.error('Failed to unarchive') }
    }

    const handleArchiveFile = async id => {
        try { await api.patch(`/files/${id}/archive`); toast.success('File archived'); loadContent(currentFolderId) }
        catch { toast.error('Failed to archive') }
    }

    const handleUnarchiveFile = async id => {
        try { await api.patch(`/files/${id}/unarchive`); toast.success('File unarchived'); loadContent(currentFolderId) }
        catch { toast.error('Failed to unarchive') }
    }

    const handleMoveFile = async (fileId, targetFolderId) => {
        try {
            await api.patch(`/folders/files/${fileId}/move`, { folderId: targetFolderId })
            toast.success('File moved!')
            setMoveModal(null)
            loadContent(currentFolderId)
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to move file') }
    }

    const [allUsers, setAllUsers]       = useState([])
    const [accessModal, setAccessModal] = useState(null) // { folderId, folderName, selectedGroups: [], selectedUsers: [] }

    useEffect(() => {
        api.get('/users/search').then(r => setAllUsers(r.data.data || [])).catch(() => {})
    }, [])

    const handleSetFolderGroups = (folder) => {
        const currentGroupIds = (folder.accessGroups || []).map(g => g.id)
        const currentUserIds  = (folder.accessUsers  || []).map(u => u.id)
        setAccessModal({
            folderId: folder.id,
            folderName: folder.name,
            selectedGroups: groups.filter(g => currentGroupIds.includes(g.id)),
            selectedUsers:  allUsers.filter(u => currentUserIds.includes(u.id)),
        })
    }

    // ── Actions fichiers ──────────────────────────────────────────────────────

    const handleUpload = async file => {
        if (!file) return
        if (file.size > 50 * 1024 * 1024) { toast.error('Max 50MB'); return }
        setUploading(true)
        const fd = new FormData()
        fd.append('file', file)
        // Pass folderId directly so the file is created in the right folder immediately
        if (currentFolderId) fd.append('folderId', currentFolderId)

        try {
            await api.post('/files/upload/public', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
            toast.success('File uploaded!')
            loadContent(currentFolderId)
        } catch (err) { toast.error(err.response?.data?.message || 'Upload failed') }
        finally { setUploading(false) }
    }

    const handleDownload = async (fileId, fileName) => {
        try {
            const res = await api.get(`/files/${fileId}/download`, { responseType: 'blob' })
            const url = URL.createObjectURL(res.data)
            const a = document.createElement('a')
            a.href = url
            a.download = fileName || 'file'
            document.body.appendChild(a)
            a.click()
            setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a) }, 200)
        } catch { toast.error('Download failed') }
    }

    const handleFollow   = async id => { try { await api.post(`/files/${id}/follow`);   toast.success('Following!');  loadContent(currentFolderId) } catch {} }
    const handleUnfollow = async id => { try { await api.delete(`/files/${id}/follow`); toast.success('Unfollowed'); loadContent(currentFolderId) } catch {} }

    // ── Filtres avancés ───────────────────────────────────────────────────────

    const applyFilters = fileList => {
        return fileList.filter(f => {
            if (filters.type && !f.mimeType?.includes(filters.type)) return false
            if (filters.source === 'public'   && f.projectId) return false
            if (filters.source === 'projects' && !f.projectId) return false
            if (filters.sizeMin && f.fileSize < parseInt(filters.sizeMin) * 1024) return false
            if (filters.sizeMax && f.fileSize > parseInt(filters.sizeMax) * 1024) return false
            if (filters.dateFrom && new Date(f.createdAt) < new Date(filters.dateFrom)) return false
            if (filters.dateTo   && new Date(f.createdAt) > new Date(filters.dateTo))   return false
            return true
        })
    }

    const activeFilterCount = Object.entries(filters).filter(([k, v]) => v && v !== 'all').length
    const displayFiles = applyFilters(showArchived ? files : files.filter(f => !f.isArchived))
    const displayFolders = showArchived ? folders : folders.filter(f => !f.isArchived)
    const archivedFileCount = files.filter(f => f.isArchived).length
    const archivedFolderCount = folders.filter(f => f.isArchived).length
    const totalArchived = archivedFileCount + archivedFolderCount

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="p-6 w-full space-y-5 min-h-full">

            {/* ── Header ───────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <FileText className="w-6 h-6 text-blue-400" /> Documents
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        {folders.length} folders · {displayFiles.length} files
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {totalArchived > 0 && (
                        <button onClick={() => setShowArchived(!showArchived)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${showArchived ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'border-slate-600/50 text-slate-400 hover:text-white'}`}>
                            <Archive className="w-3.5 h-3.5" />
                            {showArchived ? `Hide archived (${totalArchived})` : `Show archived (${totalArchived})`}
                        </button>
                    )}
                    <button onClick={() => loadContent(currentFolderId)}
                            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* ── Upload zone ──────────────────────────────────────────────── */}
            <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files[0]) }}
                className={`border-2 border-dashed rounded-2xl p-5 transition-all ${dragOver ? 'border-blue-500 bg-blue-500/5' : 'border-slate-600/50 hover:border-slate-500'}`}>
                {uploading ? (
                    <div className="flex items-center justify-center gap-2">
                        <Loader2 className="animate-spin w-5 h-5 text-blue-500" />
                        <p className="text-slate-400 text-sm">Uploading...</p>
                    </div>
                ) : (
                    <div className="flex items-center justify-center gap-4">
                        <div className="w-9 h-9 rounded-xl bg-emerald-600/20 flex items-center justify-center flex-shrink-0">
                            <Globe className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="text-left">
                            <p className="text-white font-medium text-sm">Upload a Document</p>
                            <p className="text-slate-400 text-xs mt-0.5">
                                {currentFolderId ? 'Uploading to current folder' : 'Public document — visible to all'} · Max 50MB
                            </p>
                        </div>
                        <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-all flex-shrink-0">
                            Browse
                            <input type="file" className="hidden" onChange={e => handleUpload(e.target.files[0])} />
                        </label>
                    </div>
                )}
            </div>

            {/* ── Search + Filters ─────────────────────────────────────────── */}
            <div className="space-y-3">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-400 animate-spin" />}
                        <input type="text" placeholder="Search documents..." value={search}
                               onChange={e => setSearch(e.target.value)}
                               className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl py-2.5 pl-9 pr-9 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <button onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${showFilters || activeFilterCount > 0 ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' : 'border-slate-600/50 text-slate-400 hover:text-white'}`}>
                        <SlidersHorizontal className="w-4 h-4" />
                        Filters {activeFilterCount > 0 && <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">{activeFilterCount}</span>}
                    </button>
                    {search && (
                        <button onClick={() => { setSearch(''); loadContent(currentFolderId) }}
                                className="text-xs text-slate-400 hover:text-white px-3 py-2 rounded-xl bg-slate-700/30 transition-all">Clear</button>
                    )}
                </div>

                {/* Advanced filters panel */}
                {showFilters && (
                    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">File type</label>
                            <select value={filters.type} onChange={e => setFilters({...filters, type: e.target.value})}
                                    className="w-full bg-slate-900/60 border border-slate-600/50 rounded-xl py-2 px-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                {FILE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Source</label>
                            <select value={filters.source} onChange={e => setFilters({...filters, source: e.target.value})}
                                    className="w-full bg-slate-900/60 border border-slate-600/50 rounded-xl py-2 px-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="all">All sources</option>
                                <option value="public">Public only</option>
                                <option value="projects">Projects only</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Size min (KB)</label>
                            <input type="number" placeholder="0" value={filters.sizeMin}
                                   onChange={e => setFilters({...filters, sizeMin: e.target.value})}
                                   className="w-full bg-slate-900/60 border border-slate-600/50 rounded-xl py-2 px-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Size max (KB)</label>
                            <input type="number" placeholder="∞" value={filters.sizeMax}
                                   onChange={e => setFilters({...filters, sizeMax: e.target.value})}
                                   className="w-full bg-slate-900/60 border border-slate-600/50 rounded-xl py-2 px-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Date from</label>
                            <input type="date" value={filters.dateFrom}
                                   onChange={e => setFilters({...filters, dateFrom: e.target.value})}
                                   className="w-full bg-slate-900/60 border border-slate-600/50 rounded-xl py-2 px-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1.5">Date to</label>
                            <input type="date" value={filters.dateTo}
                                   onChange={e => setFilters({...filters, dateTo: e.target.value})}
                                   className="w-full bg-slate-900/60 border border-slate-600/50 rounded-xl py-2 px-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div className="md:col-span-3 flex justify-end pt-1">
                            <button onClick={() => setFilters({ type:'', source:'all', sizeMin:'', sizeMax:'', dateFrom:'', dateTo:'' })}
                                    className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-700/50 transition-all">
                                Reset filters
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Breadcrumb ───────────────────────────────────────────────── */}
            <div className="flex items-center gap-1 text-sm">
                <button onClick={() => goToBreadcrumb(-1)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all ${breadcrumb.length === 0 ? 'text-white font-medium' : 'text-slate-400 hover:text-white'}`}>
                    <FolderOpen className="w-4 h-4" /> Root
                </button>
                {breadcrumb.map((crumb, i) => (
                    <div key={crumb.id} className="flex items-center gap-1">
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                        <button onClick={() => goToBreadcrumb(i)}
                                className={`px-2 py-1 rounded-lg transition-all ${i === breadcrumb.length - 1 ? 'text-white font-medium' : 'text-slate-400 hover:text-white'}`}>
                            {crumb.name}
                        </button>
                    </div>
                ))}
                {/* New folder button */}
                {!search && canCreateFolder && (
                    <button onClick={() => setShowNewFolder(!showNewFolder)}
                            className="ml-3 flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400 px-2 py-1 rounded-lg border border-slate-700/50 hover:border-blue-500/50 transition-all">
                        <FolderPlus className="w-3.5 h-3.5" /> New folder
                    </button>
                )}
            </div>

            {/* New folder form */}
            {showNewFolder && (
                <form onSubmit={handleCreateFolder} className="flex items-center gap-2">
                    <input autoFocus required value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                           placeholder="Folder name..."
                           className="flex-1 max-w-sm bg-slate-800/60 border border-slate-600/50 rounded-xl py-2 px-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button type="submit" disabled={creating}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-white text-sm font-medium transition-all disabled:opacity-50">
                        {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                    </button>
                    <button type="button" onClick={() => setShowNewFolder(false)}
                            className="px-3 py-2 text-slate-400 hover:text-white transition-all">
                        <X className="w-4 h-4" />
                    </button>
                </form>
            )}

            {/* ── Content ──────────────────────────────────────────────────── */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
                </div>
            ) : (
                <div className="space-y-2">

                    {/* Folders */}
                    {displayFolders.map(folder => (
                        <div key={folder.id} className={`group bg-slate-800/40 border hover:border-slate-600 rounded-xl p-3 flex items-center gap-3 transition-all ${folder.isArchived ? 'border-amber-500/20 opacity-60' : 'border-slate-700/50'}`}>
                            <button onClick={() => !folder.isArchived && openFolder(folder)} className={`flex items-center gap-3 flex-1 text-left ${folder.isArchived ? 'cursor-default' : ''}`}>
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${folder.isArchived ? 'bg-slate-600/20' : 'bg-amber-500/20'}`}>
                                    <Folder className={`w-5 h-5 ${folder.isArchived ? 'text-slate-500' : 'text-amber-400'}`} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-white">{folder.name}</p>
                                        {folder.isArchived && <span className="flex items-center gap-1 text-xs text-amber-400"><Archive className="w-3 h-3" /> Archived</span>}
                                        {search && folder.parentFolderId && <span className="text-xs text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">Subfolder</span>}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                                        {folder.accessGroups?.length > 0 || folder.accessUsers?.length > 0 ? (
                                            <span className="flex items-center gap-1 text-purple-400">
                                                <Lock className="w-3 h-3" />
                                                {folder.accessGroups?.length > 0 && `${folder.accessGroups.length} group${folder.accessGroups.length > 1 ? 's' : ''}`}
                                                {folder.accessGroups?.length > 0 && folder.accessUsers?.length > 0 && ', '}
                                                {folder.accessUsers?.length > 0 && `${folder.accessUsers.length} user${folder.accessUsers.length > 1 ? 's' : ''}`}
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-emerald-400">
                                                <Globe className="w-3 h-3" /> Public
                                            </span>
                                        )}
                                        <span>{new Date(folder.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </button>

                            {/* Folder actions — only visible to creator or admin */}
                            {canManageFolder(folder) && (
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {!folder.isArchived && (
                                        <>
                                            <button onClick={() => handleRenameFolder(folder)}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all" title="Rename">
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => handleSetFolderGroups(folder)}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-purple-400 hover:bg-slate-700/50 transition-all" title="Set access groups">
                                                <Lock className="w-3.5 h-3.5" />
                                            </button>
                                        </>
                                    )}
                                    <button onClick={() => folder.isArchived ? handleUnarchiveFolder(folder.id) : handleArchiveFolder(folder.id)}
                                            className={`p-1.5 rounded-lg transition-all ${folder.isArchived ? 'text-amber-400 hover:bg-amber-400/10' : 'text-slate-400 hover:text-amber-400 hover:bg-slate-700/50'}`}
                                            title={folder.isArchived ? 'Unarchive' : 'Archive'}>
                                        {folder.isArchived ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                                    </button>
                                    <button onClick={() => handleDeleteFolder(folder.id)}
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700/50 transition-all" title="Delete">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}

                            {!folder.isArchived && <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0 group-hover:text-slate-400 transition-colors" />}
                        </div>
                    ))}

                    {/* Files */}
                    {displayFiles.length === 0 && displayFolders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                            <FileText className="w-12 h-12 mb-4 opacity-20" />
                            <p className="font-medium">{search ? `No results for "${search}"` : 'Empty folder'}</p>
                            <p className="text-sm mt-1">{search ? '' : 'Upload a file or create a folder'}</p>
                        </div>
                    ) : displayFiles.map(file => (
                        <div key={file.id}
                             ref={el => { if (el) fileRowRefs.current[String(file.id)] = el }}
                             className={`border rounded-xl p-4 flex items-center gap-4 transition-all group ${file.isArchived ? 'bg-slate-800/30 border-amber-500/20 opacity-60' : String(file.id) === highlightFileId ? 'bg-blue-600/10 border-blue-500 ring-1 ring-blue-500/40' : 'bg-slate-800/60 border-slate-700/50 hover:border-slate-600'}`}>
                            <div className="text-2xl flex-shrink-0">{FILE_ICON(file.mimeType)}</div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <p className="text-sm font-medium text-white truncate">{file.originalName}</p>
                                    {file.isArchived && <span className="flex items-center gap-1 text-xs text-amber-400 flex-shrink-0"><Archive className="w-3 h-3" /> Archived</span>}
                                    {!file.isArchived && !file.projectId && !file.folderId
                                        ? <span className="text-xs text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded flex-shrink-0">Public</span>
                                        : !file.isArchived && file.projectId
                                            ? <span className="text-xs text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded flex-shrink-0">Project</span>
                                            : null
                                    }
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-500">
                                    <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" />{FMT_SIZE(file.fileSize)}</span>
                                    <span>v{file.version || 1}</span>
                                    {file.uploadedBy && <span>by {file.uploadedBy.fullName}</span>}
                                    {file.tags && <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{file.tags}</span>}
                                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(file.createdAt).toLocaleDateString('en', { day:'numeric', month:'short', year:'numeric' })}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                {!file.isArchived && (
                                    <>
                                        <button onClick={() => file.isFollowing ? handleUnfollow(file.id) : handleFollow(file.id)}
                                                className={`p-2 rounded-lg transition-all ${file.isFollowing ? 'text-amber-400 bg-amber-400/10' : 'text-slate-400 hover:text-amber-400 hover:bg-slate-700/50'}`} title={file.isFollowing ? 'Unfollow' : 'Follow'}>
                                            <Star className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDownload(file.id, file.originalName)}
                                                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all" title="Download">
                                            <Download className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => setPreviewFile(file)}
                                                className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 transition-all" title="Preview">
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    </>
                                )}
                                {/* Archive/unarchive — only creator or admin */}
                                {canManageFile(file) && (
                                    <>
                                        <button onClick={() => file.isArchived ? handleUnarchiveFile(file.id) : handleArchiveFile(file.id)}
                                                className={`p-2 rounded-lg transition-all ${file.isArchived ? 'text-amber-400 hover:bg-amber-400/10' : 'text-slate-400 hover:text-amber-400 hover:bg-slate-700/50'}`}
                                                title={file.isArchived ? 'Unarchive' : 'Archive'}>
                                            {file.isArchived ? <RotateCcw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                                        </button>
                                        {!file.isArchived && (
                                            <button onClick={() => setMoveModal({ fileId: file.id, fileName: file.originalName })}
                                                    className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 transition-all"
                                                    title="Move to folder">
                                                <FolderInput className="w-4 h-4" />
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* File preview modal */}
            {previewFile && (
                <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
            )}

            {/* File detail modal */}
            {selected && (
                <FileDetailModal file={selected} onClose={() => setSelected(null)}
                                 onRefresh={() => loadContent(currentFolderId)}
                                 getIcon={FILE_ICON} fmtSize={FMT_SIZE}
                                 handleDownload={handleDownload} folders={folders} />
            )}

            {/* Rename folder modal */}
            {renameModal && (
                <RenameFolderModal
                    folder={renameModal}
                    onClose={() => setRenameModal(null)}
                    onConfirm={async (newName) => {
                        try {
                            await api.patch(`/folders/${renameModal.id}/rename`, { name: newName })
                            toast.success('Folder renamed')
                            setRenameModal(null)
                            loadContent(currentFolderId)
                        } catch { toast.error('Failed to rename') }
                    }}
                />
            )}

            {/* Move to folder modal */}
            {moveModal && (
                <MoveToFolderModal
                    fileName={moveModal.fileName}
                    currentFolderId={currentFolderId}
                    onClose={() => setMoveModal(null)}
                    onMove={targetFolderId => handleMoveFile(moveModal.fileId, targetFolderId)}
                />
            )}

            {/* Set access modal (groups + users) */}
            {accessModal && (
                <SetAccessModal
                    folder={accessModal}
                    allGroups={groups}
                    allUsers={allUsers}
                    onClose={() => setAccessModal(null)}
                    onConfirm={async (selectedGroups, selectedUsers) => {
                        try {
                            if (selectedGroups.length === 0 && selectedUsers.length === 0) {
                                await api.delete(`/folders/${accessModal.folderId}/groups`)
                                toast.success('Folder is now public')
                            } else {
                                if (selectedGroups.length > 0 || (accessModal.selectedGroups || []).length > 0) {
                                    await api.patch(`/folders/${accessModal.folderId}/groups`, {
                                        groupIds: selectedGroups.map(g => g.id)
                                    })
                                }
                                await api.patch(`/folders/${accessModal.folderId}/users`, {
                                    userIds: selectedUsers.map(u => u.id)
                                })
                                toast.success('Access updated')
                            }
                            setAccessModal(null)
                            loadContent(currentFolderId)
                        } catch { toast.error('Failed to update access') }
                    }}
                />
            )}
        </div>
    )
}

// ─── Inline File Preview (used inside FileDetailModal tab) ───────────────────

function InlineFilePreview({ file, getIcon, handleDownload }) {
    const [blobUrl, setBlobUrl] = useState(null)
    const [textContent, setTextContent] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const mime = (file?.mimeType || '').toLowerCase()
    const isImage = mime.startsWith('image/')
    const isPdf   = mime === 'application/pdf'
    const isVideo = mime.startsWith('video/')
    const isAudio = mime.startsWith('audio/')
    const isText  = mime.startsWith('text/') || /\.(txt|md|csv|json|xml|yaml|yml|js|jsx|ts|tsx|html|css)$/.test(file?.originalName || '')

    useEffect(() => {
        let mounted = true
        let url = null
        setLoading(true); setError(null); setBlobUrl(null); setTextContent(null)
        api.get(`/files/${file.id}/download`, { responseType: 'blob' })
            .then(async res => {
                if (!mounted) return
                if (isText) {
                    setTextContent(await res.data.text())
                } else {
                    url = URL.createObjectURL(res.data)
                    setBlobUrl(url)
                }
            })
            .catch(() => { if (mounted) setError(true) })
            .finally(() => { if (mounted) setLoading(false) })
        return () => { mounted = false; if (url) URL.revokeObjectURL(url) }
    }, [file.id])

    if (loading) return (
        <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /><span className="text-sm">Loading preview…</span>
        </div>
    )
    if (error) return (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-400">
            <span className="text-4xl">{getIcon(file.mimeType)}</span>
            <p className="text-sm">Preview failed to load.</p>
            <button onClick={() => handleDownload(file.id, file.originalName)}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium flex items-center gap-2">
                <Download className="w-4 h-4" /> Download instead
            </button>
        </div>
    )
    if (isImage && blobUrl) return (
        <div className="flex items-center justify-center rounded-xl overflow-hidden bg-slate-900/50 min-h-40">
            <img src={blobUrl} alt={file.originalName} className="max-w-full max-h-80 object-contain rounded-xl" />
        </div>
    )
    if (isPdf && blobUrl) return (
        <iframe src={blobUrl} title={file.originalName}
                className="w-full rounded-xl border border-slate-700" style={{ height: '420px' }} />
    )
    if (isVideo && blobUrl) return (
        <video src={blobUrl} controls className="w-full rounded-xl max-h-64" />
    )
    if (isAudio && blobUrl) return (
        <div className="flex flex-col items-center gap-4 py-6">
            <span className="text-4xl">🎵</span>
            <audio src={blobUrl} controls className="w-full" />
        </div>
    )
    if (isText && textContent !== null) return (
        <div className="bg-slate-900/70 rounded-xl border border-slate-700 overflow-auto max-h-72">
            <pre className="p-4 text-slate-300 text-xs leading-relaxed whitespace-pre-wrap font-mono">{textContent}</pre>
        </div>
    )
    return (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-400">
            <span className="text-4xl">{getIcon(file.mimeType)}</span>
            <p className="text-sm text-center">No preview available for this file type.</p>
            <button onClick={() => handleDownload(file.id, file.originalName)}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium flex items-center gap-2">
                <Download className="w-4 h-4" /> Download to view
            </button>
        </div>
    )
}

// ─── File Detail Modal ────────────────────────────────────────────────────────

function FileDetailModal({ file, onClose, onRefresh, getIcon, fmtSize, handleDownload, folders }) {
    const [comments, setComments] = useState([])
    const [comment, setComment]   = useState('')
    const [sending, setSending]   = useState(false)
    const [uploading, setUploading] = useState(false)
    const [versions, setVersions] = useState([])
    const [tab, setTab]           = useState('comments')

    useEffect(() => {
        api.get(`/files/${file.id}/comments`).then(r => setComments(r.data.data || [])).catch(() => {})
        api.get(`/files/${file.id}/history`).then(r => setVersions(r.data.data || [])).catch(() => {})
    }, [file.id])

    const handleComment = async e => {
        e.preventDefault(); if (!comment.trim()) return; setSending(true)
        try {
            await api.post(`/files/${file.id}/comments`, { content: comment })
            setComment(''); const r = await api.get(`/files/${file.id}/comments`); setComments(r.data.data || [])
        } catch {} finally { setSending(false) }
    }

    const handleNewVersion = async f => {
        if (!f) return; setUploading(true)
        const fd = new FormData(); fd.append('file', f)
        try {
            await api.post(`/files/${file.id}/version`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
            toast.success('New version uploaded!'); onRefresh(); onClose()
        } catch { toast.error('Failed') } finally { setUploading(false) }
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between p-6 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">{getIcon(file.mimeType)}</span>
                        <div>
                            <h2 className="text-base font-semibold text-white">{file.originalName}</h2>
                            <p className="text-xs text-slate-400 mt-0.5">{fmtSize(file.fileSize)} · v{file.version || 1}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <div className="flex gap-1 p-3 border-b border-slate-700">
                    {['comments', 'versions', 'preview'].map(t => (
                        <button key={t} onClick={() => setTab(t)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${tab === t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>{t}</button>
                    ))}
                </div>
                <div className="p-6">
                    {tab === 'comments' && (
                        <div className="space-y-4">
                            <div className="space-y-3 max-h-64 overflow-y-auto">
                                {comments.length === 0 ? <p className="text-slate-500 text-sm text-center py-4">No comments yet</p>
                                    : comments.map(c => (
                                        <div key={c.id} className="flex gap-3">
                                            <div className="w-7 h-7 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                                                <span className="text-blue-400 text-xs font-bold">{c.user?.fullName?.charAt(0)}</span>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-medium text-white">{c.user?.fullName}</span>
                                                    <span className="text-xs text-slate-500">{new Date(c.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                <p className="text-sm text-slate-300">{c.content}</p>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                            <form onSubmit={handleComment} className="flex gap-2">
                                <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a comment..."
                                       className="flex-1 bg-slate-900/50 border border-slate-600/50 rounded-xl py-2 px-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <button type="submit" disabled={sending} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-white text-sm font-medium transition-all disabled:bg-blue-800">
                                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
                                </button>
                            </form>
                        </div>
                    )}
                    {tab === 'versions' && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                {versions.length === 0 ? <p className="text-slate-500 text-sm text-center py-4">Only one version</p>
                                    : versions.map(v => (
                                        <div key={v.id} className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-xl">
                                            <div className="w-8 h-8 rounded-lg bg-slate-600/50 flex items-center justify-center text-xs font-bold text-slate-300">v{v.version}</div>
                                            <div className="flex-1">
                                                <p className="text-sm text-white">{v.originalName}</p>
                                                <p className="text-xs text-slate-400">{new Date(v.createdAt).toLocaleDateString()} · by {v.uploadedBy?.fullName}</p>
                                            </div>
                                            <button onClick={() => handleDownload(v.id, v.originalName)} className="p-1.5 text-slate-400 hover:text-white transition-all"><Download className="w-4 h-4" /></button>
                                        </div>
                                    ))}
                            </div>
                            <div className="border-t border-slate-700 pt-4">
                                <label className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:border-blue-500 hover:text-blue-400 text-sm cursor-pointer transition-all ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    {uploading ? <><Loader2 className="w-4 h-4 animate-spin" />Uploading...</> : <><Upload className="w-4 h-4" />Select file</>}
                                    <input type="file" className="hidden" disabled={uploading} onChange={e => handleNewVersion(e.target.files[0])} />
                                </label>
                            </div>
                        </div>
                    )}
                    {tab === 'preview' && <InlineFilePreview file={file} getIcon={getIcon} handleDownload={handleDownload} />}
                    <button onClick={() => handleDownload(file.id, file.originalName)}
                            className="w-full mt-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-all flex items-center justify-center gap-2">
                        <Download className="w-4 h-4" /> Download Current Version
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Rename Folder Modal ──────────────────────────────────────────────────────

function RenameFolderModal({ folder, onClose, onConfirm }) {
    const [name, setName] = useState(folder.name)
    const [saving, setSaving] = useState(false)

    const handleSubmit = async e => {
        e.preventDefault()
        if (!name.trim() || name === folder.name) return
        setSaving(true)
        await onConfirm(name.trim())
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl">
                <div className="flex items-center justify-between p-5 border-b border-slate-700">
                    <h2 className="text-sm font-semibold text-white">Rename Folder</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <input autoFocus required value={name} onChange={e => setName(e.target.value)}
                           className="w-full bg-slate-900/50 border border-slate-600/50 rounded-xl py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose}
                                className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-sm hover:text-white transition-all">Cancel</button>
                        <button type="submit" disabled={saving || !name.trim() || name === folder.name}
                                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium text-sm transition-all flex items-center justify-center gap-2">
                            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : 'Rename'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ─── Set Groups Modal ─────────────────────────────────────────────────────────

function SetAccessModal({ folder, allGroups, allUsers, onClose, onConfirm }) {
    const [tab, setTab]             = useState('groups') // 'groups' | 'users'
    const [search, setSearch]       = useState('')
    const [selGroups, setSelGroups] = useState(folder.selectedGroups || [])
    const [selUsers, setSelUsers]   = useState(folder.selectedUsers  || [])
    const [saving, setSaving]       = useState(false)

    const filteredGroups = allGroups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()))
    const filteredUsers  = allUsers.filter(u =>
        (u.fullName || '').toLowerCase().includes(search.toLowerCase()) ||
        (u.email    || '').toLowerCase().includes(search.toLowerCase())
    )

    const isGroupSel = g => selGroups.some(s => s.id === g.id)
    const isUserSel  = u => selUsers.some(s => s.id === u.id)

    const toggleGroup = g => setSelGroups(prev => isGroupSel(g) ? prev.filter(s => s.id !== g.id) : [...prev, g])
    const toggleUser  = u => setSelUsers(prev  => isUserSel(u)  ? prev.filter(s => s.id !== u.id)  : [...prev, u])

    const totalSelected = selGroups.length + selUsers.length

    const handleConfirm = async () => {
        setSaving(true)
        await onConfirm(selGroups, selUsers)
        setSaving(false)
    }

    const CheckBox = ({ checked }) => (
        <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all ${checked ? 'bg-blue-500 border-blue-500' : 'border-slate-500'}`}>
            {checked && (
                <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            )}
        </div>
    )

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-700">
                    <div>
                        <h2 className="text-sm font-semibold text-white">Set Access</h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Folder: <span className="text-slate-300">{folder.folderName}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                </div>

                <div className="p-5 space-y-4">
                    {/* Tabs */}
                    <div className="flex gap-1 bg-slate-900/50 rounded-xl p-1">
                        {[['groups', `Groups (${selGroups.length})`], ['users', `Users (${selUsers.length})`]].map(([key, label]) => (
                            <button key={key} onClick={() => { setTab(key); setSearch('') }}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input autoFocus type="text"
                               placeholder={tab === 'groups' ? 'Search groups…' : 'Search users…'}
                               value={search} onChange={e => setSearch(e.target.value)}
                               className="w-full bg-slate-900/60 border border-slate-600/50 rounded-xl py-2.5 pl-9 pr-4 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>

                    {/* List */}
                    <div className="max-h-52 overflow-y-auto space-y-1">
                        {tab === 'groups' ? (
                            filteredGroups.length === 0
                                ? <div className="text-center py-6 text-slate-500 text-sm">No groups found</div>
                                : filteredGroups.map(g => (
                                    <button key={g.id} onClick={() => toggleGroup(g)}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border ${isGroupSel(g) ? 'bg-blue-600/20 border-blue-500/30' : 'bg-slate-700/30 hover:bg-slate-700/60 border-transparent'}`}>
                                        <CheckBox checked={isGroupSel(g)} />
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-medium truncate ${isGroupSel(g) ? 'text-blue-300' : 'text-slate-200'}`}>{g.name}</p>
                                            {g.description && <p className="text-xs text-slate-500 truncate">{g.description}</p>}
                                        </div>
                                    </button>
                                ))
                        ) : (
                            filteredUsers.length === 0
                                ? <div className="text-center py-6 text-slate-500 text-sm">No users found</div>
                                : filteredUsers.map(u => (
                                    <button key={u.id} onClick={() => toggleUser(u)}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border ${isUserSel(u) ? 'bg-blue-600/20 border-blue-500/30' : 'bg-slate-700/30 hover:bg-slate-700/60 border-transparent'}`}>
                                        <CheckBox checked={isUserSel(u)} />
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-medium truncate ${isUserSel(u) ? 'text-blue-300' : 'text-slate-200'}`}>{u.fullName}</p>
                                            <p className="text-xs text-slate-500 truncate">{u.email}</p>
                                        </div>
                                    </button>
                                ))
                        )}
                    </div>

                    <p className="text-xs text-slate-500">
                        {totalSelected === 0
                            ? '⚠️ No selection — folder will be public'
                            : `🔒 ${totalSelected} restriction${totalSelected > 1 ? 's' : ''} applied (groups + users)`}
                    </p>

                    <div className="flex gap-3 pt-1">
                        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-sm hover:text-white transition-all">
                            Cancel
                        </button>
                        <button onClick={handleConfirm} disabled={saving}
                                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium text-sm transition-all flex items-center justify-center gap-2">
                            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : totalSelected === 0 ? 'Make Public' : `Apply`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Move to Folder Modal ─────────────────────────────────────────────────────

function MoveToFolderModal({ fileName, currentFolderId, onClose, onMove }) {
    const [folders, setFolders]       = useState([])
    const [breadcrumb, setBreadcrumb] = useState([]) // [{id, name}]
    const [loading, setLoading]       = useState(true)
    const [moving, setMoving]         = useState(false)
    const [selected, setSelected]     = useState(null) // folder id or null (root)

    const activeFolderId = breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].id : null

    useEffect(() => {
        setLoading(true)
        const req = activeFolderId
            ? api.get(`/folders/${activeFolderId}/subfolders`)
            : api.get('/folders/root')
        req.then(r => setFolders(r.data.data || [])).catch(() => setFolders([])).finally(() => setLoading(false))
    }, [activeFolderId])

    const enter = (folder) => {
        setBreadcrumb(prev => [...prev, { id: folder.id, name: folder.name }])
        setSelected(null)
    }
    const goTo = (idx) => {
        if (idx === -1) { setBreadcrumb([]); setSelected(null); return }
        setBreadcrumb(prev => prev.slice(0, idx + 1)); setSelected(null)
    }

    const handleConfirm = async () => {
        setMoving(true)
        try { await onMove(selected ?? activeFolderId ?? null) }
        finally { setMoving(false) }
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="rounded-2xl w-full max-w-sm shadow-2xl border"
                 style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                    <div>
                        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Move to folder</h2>
                        <p className="text-xs mt-0.5 truncate max-w-xs" style={{ color: 'var(--text-muted)' }}>{fileName}</p>
                    </div>
                    <button onClick={onClose} style={{ color: 'var(--text-secondary)' }}><X className="w-5 h-5" /></button>
                </div>

                {/* Breadcrumb */}
                <div className="flex items-center gap-1 px-4 py-2 text-xs flex-wrap" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                    <button onClick={() => goTo(-1)}
                            className={`px-2 py-0.5 rounded transition-all ${breadcrumb.length === 0 ? 'text-white font-semibold' : 'text-slate-400 hover:text-white'}`}>
                        Root
                    </button>
                    {breadcrumb.map((c, i) => (
                        <span key={c.id} className="flex items-center gap-1">
                            <ChevronRight className="w-3 h-3 text-slate-600" />
                            <button onClick={() => goTo(i)}
                                    className={`px-2 py-0.5 rounded transition-all ${i === breadcrumb.length - 1 ? 'text-white font-semibold' : 'text-slate-400 hover:text-white'}`}>
                                {c.name}
                            </button>
                        </span>
                    ))}
                </div>

                {/* Folder list */}
                <div className="p-3 max-h-56 overflow-y-auto space-y-1">
                    {loading ? (
                        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
                    ) : folders.length === 0 ? (
                        <p className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>No subfolders here</p>
                    ) : folders.filter(f => !f.isArchived && f.id !== currentFolderId).map(f => (
                        <div key={f.id}
                             className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer border transition-all ${selected === f.id ? 'border-blue-500/50 bg-blue-500/10' : 'border-transparent hover:bg-slate-700/40'}`}
                             onClick={() => setSelected(f.id)}>
                            <Folder className="w-4 h-4 text-amber-400 flex-shrink-0" />
                            <span className="text-sm flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{f.name}</span>
                            <button onClick={e => { e.stopPropagation(); enter(f) }}
                                    className="p-0.5 rounded text-slate-500 hover:text-white transition-all" title="Open">
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>

                <div className="flex gap-3 p-4" style={{ borderTop: '1px solid var(--border-primary)' }}>
                    <button onClick={onClose} className="flex-1 py-2 rounded-xl border text-sm transition-all"
                            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>Cancel</button>
                    <button onClick={handleConfirm} disabled={moving || (selected === null && activeFolderId === currentFolderId && breadcrumb.length === 0)}
                            className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:opacity-50 text-white font-medium text-sm transition-all flex items-center justify-center gap-2">
                        {moving ? <><Loader2 className="w-4 h-4 animate-spin" />Moving…</> : 'Move here'}
                    </button>
                </div>
            </div>
        </div>
    )
}
