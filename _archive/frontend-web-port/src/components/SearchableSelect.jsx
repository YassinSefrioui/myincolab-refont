import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, X, Check } from 'lucide-react'

/**
 * SearchableSelect — remplace les <select> natifs partout.
 *
 * Props :
 *   options      : [{ value, label, sublabel? }]
 *   value        : valeur sélectionnée (string | number | null)
 *   onChange     : (value) => void
 *   placeholder  : string (ex: "Select a user...")
 *   nullable     : bool — affiche une option "None" en tête (default: true)
 *   nullLabel    : string — label de l'option vide (default: "None")
 *   disabled     : bool
 *   className    : string — classes supplémentaires pour le wrapper
 */
export default function SearchableSelect({
    options = [],
    value,
    onChange,
    placeholder = 'Select...',
    nullable = true,
    nullLabel = 'None',
    disabled = false,
    className = '',
}) {
    const [open, setOpen]       = useState(false)
    const [search, setSearch]   = useState('')
    const wrapperRef            = useRef(null)
    const inputRef              = useRef(null)

    // Fermer en cliquant en dehors
    useEffect(() => {
        const handler = e => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setOpen(false)
                setSearch('')
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    // Focus l'input à l'ouverture
    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 50)
    }, [open])

    const selected = options.find(o => String(o.value) === String(value))

    const filtered = options.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(search.toLowerCase()))
    )

    const handleSelect = val => {
        onChange(val)
        setOpen(false)
        setSearch('')
    }

    return (
        <div ref={wrapperRef} className={`relative ${className}`}>
            {/* Trigger */}
            <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setOpen(!open)}
                className={`w-full flex items-center justify-between gap-2 bg-slate-900/50 border rounded-xl py-2.5 px-4 text-sm transition-all text-left ${
                    open
                        ? 'border-blue-500 ring-2 ring-blue-500/20'
                        : 'border-slate-600/50 hover:border-slate-500/70'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
                <span className={selected ? 'text-white' : 'text-slate-500'}>
                    {selected ? selected.label : placeholder}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                    {value && nullable && (
                        <span
                            onClick={e => { e.stopPropagation(); handleSelect(null) }}
                            className="p-0.5 text-slate-400 hover:text-white rounded transition-colors"
                        >
                            <X className="w-3 h-3" />
                        </span>
                    )}
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600/50 rounded-xl shadow-2xl overflow-hidden">
                    {/* Search input */}
                    <div className="p-2 border-b border-slate-700/50">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search..."
                                className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg py-1.5 pl-7 pr-3 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>

                    {/* Options list */}
                    <div className="max-h-52 overflow-y-auto py-1">
                        {/* Null option */}
                        {nullable && (
                            <button
                                type="button"
                                onClick={() => handleSelect(null)}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                                    !value
                                        ? 'bg-blue-600/20 text-blue-300'
                                        : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                                }`}
                            >
                                {!value && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                                <span className={!value ? 'ml-0' : 'ml-5'}>{nullLabel}</span>
                            </button>
                        )}

                        {/* Filtered options */}
                        {filtered.length === 0 ? (
                            <div className="px-3 py-4 text-center text-slate-500 text-xs">
                                No results for "{search}"
                            </div>
                        ) : filtered.map(opt => {
                            const isActive = String(opt.value) === String(value)
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => handleSelect(opt.value)}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                                        isActive
                                            ? 'bg-blue-600/20 text-blue-300'
                                            : 'text-slate-200 hover:bg-slate-700/50'
                                    }`}
                                >
                                    {isActive
                                        ? <Check className="w-3.5 h-3.5 flex-shrink-0 text-blue-400" />
                                        : <div className="w-3.5 flex-shrink-0" />
                                    }
                                    <div className="flex-1 min-w-0">
                                        <p className="truncate">{opt.label}</p>
                                        {opt.sublabel && (
                                            <p className="text-xs text-slate-500 truncate">{opt.sublabel}</p>
                                        )}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
