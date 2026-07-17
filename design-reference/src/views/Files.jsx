import { useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { ModalHeader } from '../components/Modal.jsx';
import { member, nextId } from '../lib/helpers.js';
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

export default function Files() {
  const { db, updateDB, user, ui, setUi, openModal, toast, logAudit, logActivity, t } = useApp();
  const uploadRef = useRef(null);

  const tabs = [['all', t('sharedFiles')], ['mine', t('myDocuments')], ['archived', t('archived')]];
  const showArchivedFolders = ui.filesTab === 'archived';
  const folders = db.folders.filter(f => f.parent === ui.filesFolder && f.archived === showArchivedFolders);
  let files = db.files.filter(f => f.folder === ui.filesFolder);
  if (ui.filesTab === 'mine') files = files.filter(f => f.from === user.id);
  if (ui.filesTab === 'archived') files = [];

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
      } else {
        draft.files.unshift({ id: nextId(draft.files), name: f.name, size, from: user.id, where: t('myDocuments'), time: t('today'), folder: ui.filesFolder, version: 1 });
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
      <div className="boards-head">
        <h2 className="page-title" style={{ margin: 0 }}>{t('files')}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={createFolder}>📁 {t('newFolder')}</button>
          <button className="btn btn-primary btn-sm" onClick={() => uploadRef.current?.click()}>↑ {t('upload')}</button>
          <input type="file" ref={uploadRef} hidden onChange={uploadFile} />
        </div>
      </div>
      <div className="tabs">
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
      <div className="files-list">
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
        {files.map(f => (
          <div className="file-row" key={f.id} onClick={() => toast(t('download') + ' : ' + f.name)}>
            <span className="file-glyph" />
            <div className="file-main">
              <div className="file-name">
                {f.name}
                {f.version > 1 && <span className="tag-soft" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}> v{f.version}</span>}
              </div>
              <div className="file-meta">{member(db, f.from).name} · {f.where} · {f.time}</div>
            </div>
            <div className="file-actions">
              <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); renameFile(f.id); }}>{t('rename')}</button>
              <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); deleteFile(f.id); }}>{t('delete')}</button>
            </div>
            <div className="file-size">{f.size}</div>
          </div>
        ))}
        {(!folders.length && !files.length) && <div className="empty-note">{t('noResults')}</div>}
      </div>
    </div>
  );
}
