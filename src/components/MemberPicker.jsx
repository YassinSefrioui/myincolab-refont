import { useEffect, useMemo, useRef, useState } from 'react';
import Avatar from './Avatar.jsx';
import { departmentName, member } from '../lib/helpers.js';
import { useApp } from '../state/AppContext.jsx';

const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Sélecteur de personnes avec recherche (remplace les <select>).
 * - multi=true  : selected est un tableau d'ids, affiché en chips retirables.
 * - multi=false : selected est un id (ou null), affiché en chip unique.
 */
export default function MemberPicker({ candidates, selected, onChange, multi = true, placeholder, autoFocus = false, max = null }) {
  const { db, t } = useApp();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const selectedIds = useMemo(
    () => (multi ? (selected || []) : (selected ? [selected] : [])),
    [multi, selected],
  );

  useEffect(() => {
    if (!open) return;
    const onDown = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const list = useMemo(() => {
    const q = norm(query);
    return candidates
      .filter(m => !selectedIds.includes(m.id))
      .filter(m => !q || norm(m.name).includes(q) || norm(m.email).includes(q) || norm(departmentName(db, m.departmentId)).includes(q));
  }, [candidates, selectedIds, query, db]);

  function pick(id) {
    if (multi) {
      onChange([...selectedIds, id]);
      setQuery('');
    } else {
      onChange(id);
      setQuery('');
      setOpen(false);
    }
  }
  function remove(id) {
    if (multi) onChange(selectedIds.filter(x => x !== id));
    else onChange(null);
  }

  const atMax = max != null && selectedIds.length >= max;

  return (
    <div className="mp-wrap" ref={wrapRef}>
      {selectedIds.length > 0 && (
        <div className="mp-chips">
          {selectedIds.map(id => {
            const m = member(db, id);
            return (
              <span className="mp-chip" key={id}>
                <Avatar m={m} size="a20" /> {m.name}
                <button onClick={() => remove(id)} title={t('delete')} aria-label={t('delete')}>✕</button>
              </span>
            );
          })}
        </div>
      )}
      {!atMax && (
        <input
          className="input"
          placeholder={placeholder || t('searchPeople')}
          value={query}
          autoFocus={autoFocus}
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={e => {
            if (e.key === 'Enter' && list.length === 1) { e.preventDefault(); pick(list[0].id); }
            if (e.key === 'Escape') setOpen(false);
          }}
        />
      )}
      {open && !atMax && (
        <div className="mp-list">
          {list.length ? list.map(m => (
            <button className="mp-item" key={m.id} onClick={() => pick(m.id)}>
              <Avatar m={m} size="a20" withPresence />
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                <span className="mp-name">{m.name}</span>
                <span className="mp-sub">{[departmentName(db, m.departmentId), m.email].filter(Boolean).join(' · ')}</span>
              </span>
            </button>
          )) : <div className="empty-note" style={{ padding: '8px 0' }}>{t('noResults')}</div>}
        </div>
      )}
    </div>
  );
}
