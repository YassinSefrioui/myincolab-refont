import { useState } from 'react';
import Avatar from '../components/Avatar.jsx';
import { ModalHeader } from '../components/Modal.jsx';
import { member, nextId } from '../lib/helpers.js';
import { useApp } from '../state/AppContext.jsx';

function NewAnnouncementModal() {
  const { db, updateDB, user, closeModal, notify, logAudit, toast, t } = useApp();
  const [type, setType] = useState('company');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  function create() {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody) return;
    updateDB(draft => {
      draft.announcements.unshift({ id: nextId(draft.announcements), type, title: trimmedTitle, body: trimmedBody, by: user.id, time: 'À l\'instant', attachment: null });
    });
    notify(`${t('newAnnouncement')} : <b>${trimmedTitle}</b>`, 'announcements');
    logAudit('ANNOUNCEMENT_POSTED', trimmedTitle, false);
    closeModal();
    toast(t('newAnnouncement') + ' ✓');
  }
  return (
    <>
      <ModalHeader title={t('newAnnouncement')} />
      <label className="field-label">Type</label>
      <select className="select" value={type} onChange={e => setType(e.target.value)}>
        <option value="company">{t('companyAnnouncement')}</option>
        {user.role === 'ADMIN' && <option value="global">{t('globalAnnouncement')}</option>}
      </select>
      <label className="field-label">{t('announcementTitle')}</label>
      <input className="input" value={title} onChange={e => setTitle(e.target.value)} />
      <label className="field-label">{t('description')}</label>
      <textarea className="textarea" value={body} onChange={e => setBody(e.target.value)} />
      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={closeModal}>{t('cancel')}</button>
        <button className="btn btn-primary" onClick={create}>{t('create')}</button>
      </div>
    </>
  );
}

export default function Announcements() {
  const { db, user, openModal, toast, t } = useApp();
  const canPost = ['ADMIN', 'MANAGER'].includes(user.role);
  return (
    <div className="view-anim">
      <div className="boards-head">
        <h2 className="page-title" style={{ margin: 0 }}>{t('announcements')}</h2>
        {canPost && <button className="btn btn-primary btn-sm" onClick={() => openModal(<NewAnnouncementModal />)}>+ {t('newAnnouncement')}</button>}
      </div>
      {db.announcements.map(a => (
        <div className={`card announce-card ${a.type}`} key={a.id}>
          <span className="tag-soft" style={a.type === 'global' ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : { background: 'rgba(240,160,75,.18)', color: '#d18334' }}>
            {a.type === 'global' ? t('globalAnnouncement') : t('companyAnnouncement')}
          </span>
          <div className="announce-title">{a.title}</div>
          <div className="announce-body">{a.body}</div>
          {a.attachment && (
            <div className="file-chip" onClick={() => toast(t('download'))}>
              <span className="sq" /><span className="fn">{a.attachment}</span>
            </div>
          )}
          <div className="announce-meta">
            <Avatar m={member(db, a.by)} size="a20" /> {member(db, a.by).name} · {a.time}
          </div>
        </div>
      ))}
    </div>
  );
}
