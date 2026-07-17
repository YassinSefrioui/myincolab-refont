import { useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { ModalHeader } from '../components/Modal.jsx';
import MemberPicker from '../components/MemberPicker.jsx';
import { fileKind, fmtDateTime, hasGuestExecute, member, nextId } from '../lib/helpers.js';
import { useApp } from '../state/AppContext.jsx';

function NewFolderModal({ parentId }) {
  const { updateDB, closeModal, t } = useApp();
  const [name, setName] = useState('');
  function create() {
    if (!name.trim()) return;
    updateDB(draft => { draft.folders.push({ id: 'f' + Date.now(), name: name.trim(), parent: parentId, archived: false }); });
    closeModal();
  }
  return (
    <>
      <ModalHeader title={t('newFolder')} />
      <label className="field-label">{t('folderName')}</label>
      <input className="input" value={name} onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') create(); }} autoFocus />
      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={closeModal}>{t('cancel')}</button>
        <button className="btn btn-primary" onClick={create}>{t('create')}</button>
      </div>
    </>
  );
}

/** Convertit une taille affichée ("1,2 Mo" / "214 Ko") en octets approximatifs, pour le tri. */
function parseSize(size) {
  const m = /^([\d.,]+)\s*(Ko|Mo|Go|KB|MB|GB)?$/i.exec((size || '').trim());
  if (!m) return 0;
  const n = parseFloat(m[1].replace(',', '.'));
  const unit = (m[2] || '').toLowerCase();
  if (unit.startsWith('g')) return n * 1024 * 1024 * 1024;
  if (unit.startsWith('m')) return n * 1024 * 1024;
  if (unit.startsWith('k')) return n * 1024;
  return n;
}

const SORTS = [
  ['newest', 'sortNewest'], ['oldest', 'sortOldest'],
  ['name', 'sortName'], ['largest', 'sortLargest'], ['smallest', 'sortSmallest'],
];
const TYPE_FILTERS = ['pdf', 'fileDoc', 'fileSheet', 'fileImage'];
const TYPE_LABELS = { pdf: 'typePdf', fileDoc: 'typeDoc', fileSheet: 'typeSheet', fileImage: 'typeImage' };

export default function Files() {
  const { db, updateDB, user, prefs, ui, setUi, openModal, toast, logAudit, logActivity, t } = useApp();
  const uploadRef = useRef(null);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState('newest');
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState(null);
  const [uploaderFilter, setUploaderFilter] = useState(null);

  const tabs = [['all', t('sharedFiles')], ['mine', t('myDocuments')], ['archived', t('archived')]];
  const showArchivedFolders = ui.filesTab === 'archived';
  const folders = db.folders.filter(f => f.parent === ui.filesFolder && f.archived === showArchivedFolders);
  let files = db.files.filter(f => f.folder === ui.filesFolder);
  if (ui.filesTab === 'mine') files = files.filter(f => f.from === user.id);
  if (ui.filesTab === 'archived') files = [];

  if (query.trim()) {
    const q = query.trim().toLowerCase();
    files = files.filter(f => f.name.toLowerCase().includes(q));
  }
  if (typeFilter) files = files.filter(f => fileKind(f.name).icon === typeFilter);
  if (uploaderFilter) files = files.filter(f => f.from === uploaderFilter);

  files = files.slice().sort((a, b) => {
    if (sortKey === 'name') return a.name.localeCompare(b.name);
    if (sortKey === 'oldest') return (a.ts || 0) - (b.ts || 0);
    if (sortKey === 'largest') return parseSize(b.size) - parseSize(a.size);
    if (sortKey === 'smallest') return parseSize(a.size) - parseSize(b.size);
    return (b.ts || 0) - (a.ts || 0);
  });

  const uploaders = [...new Set(db.files.filter(f => f.folder === ui.filesFolder).map(f => f.from))];
  const uploaderCandidates = uploaders.map(id => member(db, id));
  const activeFilterCount = (typeFilter ? 1 : 0) + (uploaderFilter ? 1 : 0);
  const hasActiveRefinement = activeFilterCount > 0 || sortKey !== 'newest' || query.trim() !== '';

  function resetFilters() {
    setQuery('');
    setSortKey('newest');
    setTypeFilter(null);
    setUploaderFilter(null);
    setFilterOpen(false);
    setSortOpen(false);
  }

  const crumbs = [];
  let cur = db.folders.find(f => f.id === ui.filesFolder);
  while (cur) { crumbs.unshift(cur); cur = db.folders.find(f => f.id === cur.parent); }

  function setFilesTab(k) { setUi({ filesTab: k, filesFolder: 'root' }); }
  function openFolder(id) { setUi({ filesFolder: id }); }

  function createFolder() {
    openModal(<NewFolderModal parentId={ui.filesFolder} />);
  }
  function toggleArchiveFolder(id) {
    updateDB(draft => { const f = draft.folders.find(x => x.id === id); if (f) f.archived = !f.archived; });
  }
  function uploadFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    const size = f.size > 1048576 ? (f.size / 1048576).toFixed(1) + ' Mo' : Math.max(1, Math.round(f.size / 1024)) + ' Ko';
    updateDB(draft => {
      const existing = draft.files.find(x => x.name === f.name && x.folder === ui.filesFolder);
      if (existing) {
        existing.version++;
        existing.time = t('today');
        existing.ts = Date.now();
      } else {
        draft.files.unshift({ id: nextId(draft.files), name: f.name, size, from: user.id, where: t('myDocuments'), time: t('today'), folder: ui.filesFolder, version: 1, ts: Date.now() });
      }
    });
    logAudit('FILE_UPLOADED', f.name, false);
    logActivity(`<b>${user.name.split(' ')[0]}</b> a téléversé <b>${f.name}</b>`);
    toast(t('upload') + ' ✓');
    e.target.value = '';
  }
  function renameFile(id) {
    const f = db.files.find(x => x.id === id);
    if (!f) return;
    const name = prompt(t('rename'), f.name);
    if (!name) return;
    updateDB(draft => { const df = draft.files.find(x => x.id === id); if (df) df.name = name.trim(); });
  }
  function deleteFile(id) {
    updateDB(draft => { draft.files = draft.files.filter(x => x.id !== id); });
    toast(t('delete') + ' ✓');
  }

  return (
    <div className="view-anim">
      <div className="boards-head" data-tour="files-header">
        <h2 className="page-title" style={{ margin: 0 }}>{t('files')}</h2>
        {hasGuestExecute(user, 'files') && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={createFolder}><Icon name="folder" style={{ width: 13, height: 13 }} /> {t('newFolder')}</button>
            <button className="btn btn-primary btn-sm" onClick={() => uploadRef.current?.click()}><Icon name="upload" style={{ width: 13, height: 13 }} /> {t('upload')}</button>
            <input type="file" ref={uploadRef} hidden onChange={uploadFile} />
          </div>
        )}
      </div>
      <div className="tabs" data-tour="files-tabs">
        {tabs.map(([k, lbl]) => (
          <button key={k} className={`tab${ui.filesTab === k ? ' active' : ''}`} onClick={() => setFilesTab(k)}>{lbl}</button>
        ))}
      </div>
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <span key={c.id}>
            <span className="crumb" onClick={() => openFolder(c.id)}>{c.name}</span>
            {i < crumbs.length - 1 && <span>›</span>}
          </span>
        ))}
      </div>

      <div className="proj-toolbar" data-tour="files-toolbar">
        <div className="proj-search">
          <Icon name="search" />
          <input placeholder={t('searchFiles')} value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <div style={{ position: 'relative' }}>
          <button className="btn btn-ghost" onClick={() => { setSortOpen(o => !o); setFilterOpen(false); }}>
            <Icon name="sort" style={{ width: 13, height: 13 }} /> {t(SORTS.find(([k]) => k === sortKey)[1])}
          </button>
          {sortOpen && (
            <div className="proj-switcher-menu" style={{ right: 0, left: 'auto' }} onMouseLeave={() => setSortOpen(false)}>
              {SORTS.map(([k, lbl]) => (
                <div key={k} className={`proj-switcher-item${sortKey === k ? ' active' : ''}`} onClick={() => { setSortKey(k); setSortOpen(false); }}>
                  {t(lbl)}
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <button className="btn btn-ghost" onClick={() => { setFilterOpen(o => !o); setSortOpen(false); }}>
            <Icon name="filter" style={{ width: 13, height: 13 }} /> {t('filters')}{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>
          {filterOpen && (
            <div className="proj-switcher-menu" style={{ right: 0, left: 'auto', minWidth: 240 }} onMouseLeave={() => setFilterOpen(false)}>
              <div style={{ padding: '6px 10px 4px', fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>{t('fileType')}</div>
              <div className={`proj-switcher-item${!typeFilter ? ' active' : ''}`} onClick={() => setTypeFilter(null)}>{t('allTypes')}</div>
              {TYPE_FILTERS.map(k => (
                <div key={k} className={`proj-switcher-item${typeFilter === k ? ' active' : ''}`} onClick={() => setTypeFilter(k)}>{t(TYPE_LABELS[k])}</div>
              ))}
              {uploaderCandidates.length > 0 && (
                <>
                  <div style={{ padding: '8px 10px 6px', fontSize: 11, fontWeight: 600, color: 'var(--muted)', borderTop: '1px solid var(--border-lt)', marginTop: 4 }}>{t('uploadedBy')}</div>
                  <div style={{ padding: '0 8px 8px' }}>
                    <MemberPicker
                      candidates={uploaderCandidates} selected={uploaderFilter} onChange={setUploaderFilter}
                      multi={false} placeholder={t('allUploaders')}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        {hasActiveRefinement && (
          <button className="btn btn-ghost btn-sm" onClick={resetFilters} title={t('resetFilters')}>
            <Icon name="close" style={{ width: 12, height: 12 }} /> {t('resetFilters')}
          </button>
        )}
      </div>

      <div className="files-list" data-tour="files-list">
        {folders.map(f => (
          <div className="file-row" key={f.id} onClick={() => openFolder(f.id)}>
            <span style={{ width: 26, height: 20, color: 'var(--warning)', display: 'inline-flex', flexShrink: 0 }}><Icon name="folder" /></span>
            <div className="file-main">
              <div className="file-name">{f.name}</div>
              <div className="file-meta">{db.files.filter(x => x.folder === f.id).length} {t('files').toLowerCase()}</div>
            </div>
            <div className="file-actions">
              <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); toggleArchiveFolder(f.id); }}>{f.archived ? t('restore') : t('archive')}</button>
            </div>
          </div>
        ))}
        {files.map(f => {
          const kind = fileKind(f.name);
          return (
            <div className="file-row" key={f.id} onClick={() => toast(t('download') + ' : ' + f.name)}>
              <span style={{ width: 20, height: 20, color: kind.color, display: 'inline-flex', flexShrink: 0 }}><Icon name={kind.icon} /></span>
              <div className="file-main">
                <div className="file-name">
                  {f.name}
                  {f.version > 1 && <span className="tag-soft" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}> v{f.version}</span>}
                </div>
                <div className="file-meta">{member(db, f.from).name} · {f.where} · {fmtDateTime(f.ts, prefs.lang) || f.time}</div>
              </div>
              <div className="file-actions">
                <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); renameFile(f.id); }}>{t('rename')}</button>
                <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); deleteFile(f.id); }}>{t('delete')}</button>
              </div>
              <div className="file-size">{f.size}</div>
            </div>
          );
        })}
        {(!folders.length && !files.length) && <div className="empty-note">{t('noResults')}</div>}
      </div>
    </div>
  );
}
