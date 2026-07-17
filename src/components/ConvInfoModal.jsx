import { useState } from 'react';
import Icon from './Icon.jsx';
import Avatar from './Avatar.jsx';
import { ModalHeader } from './Modal.jsx';
import MemberPicker from './MemberPicker.jsx';
import MemberProfileModal from './MemberProfileModal.jsx';
import { fileKind, mediaKind, member } from '../lib/helpers.js';
import { useApp } from '../state/AppContext.jsx';

export default function ConvInfoModal({ convId }) {
  const { db, updateDB, user, openModal, closeModal, toast, t } = useApp();
  const [tab, setTab] = useState('overview');
  const [addingMember, setAddingMember] = useState(false);
  const [newMemberIds, setNewMemberIds] = useState([]);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const msgs = db.messagesByConv[convId] || [];
  const dm = db.dms.find(d => d.id === convId);
  const gc = db.groupChats.find(g => g.id === convId);
  const proj = db.projects.find(p => p.id === convId);

  const attachments = msgs.filter(m => m.file).map(m => ({ ...m.file, from: m.user, time: m.time, kind: mediaKind(m.file.name) }));
  const images = attachments.filter(a => a.kind === 'image');
  const videos = attachments.filter(a => a.kind === 'video');
  const docs = attachments.filter(a => a.kind === 'document');

  const isAdmin = gc ? gc.adminIds.includes(user.id) : false;
  const isProjectLead = proj ? proj.leadId === user.id : false;
  const title = gc ? gc.name : proj ? proj.name : dm ? member(db, dm.user).name : convId;

  function startEditName() { setNameDraft(gc.name); setEditingName(true); }
  function saveName() {
    const trimmed = nameDraft.trim();
    setEditingName(false);
    if (!trimmed || trimmed === gc.name) return;
    updateDB(draft => { const g = draft.groupChats.find(x => x.id === convId); if (g) g.name = trimmed; });
  }
  function addMembers() {
    if (!newMemberIds.length) { setAddingMember(false); return; }
    updateDB(draft => {
      const g = draft.groupChats.find(x => x.id === convId);
      if (g) g.members = [...new Set([...g.members, ...newMemberIds])];
    });
    setNewMemberIds([]);
    setAddingMember(false);
    toast(t('addMember') + ' ✓');
  }
  function removeMember(id) {
    updateDB(draft => {
      const g = draft.groupChats.find(x => x.id === convId);
      if (!g) return;
      g.members = g.members.filter(x => x !== id);
      g.adminIds = g.adminIds.filter(x => x !== id);
      if (!g.adminIds.length && g.members.length) g.adminIds = [g.members[0]];
    });
  }
  function toggleAdmin(id) {
    let blocked = false;
    updateDB(draft => {
      const g = draft.groupChats.find(x => x.id === convId);
      if (!g) return;
      if (g.adminIds.includes(id) && g.adminIds.length === 1) { blocked = true; return; }
      g.adminIds = g.adminIds.includes(id) ? g.adminIds.filter(x => x !== id) : [...g.adminIds, id];
    });
    if (blocked) toast(t('lastAdminWarning'));
  }
  function addProjectMembers() {
    if (!newMemberIds.length) { setAddingMember(false); return; }
    updateDB(draft => {
      const p = draft.projects.find(x => x.id === convId);
      if (p) p.members = [...new Set([...p.members, ...newMemberIds])];
    });
    setNewMemberIds([]);
    setAddingMember(false);
    toast(t('addMember') + ' ✓');
  }
  function removeProjectMember(id) {
    updateDB(draft => {
      const p = draft.projects.find(x => x.id === convId);
      if (!p) return;
      p.members = p.members.filter(x => x !== id);
      if (p.leadId === id) p.leadId = p.members[0] || null;
    });
  }
  function transferLead(id) {
    updateDB(draft => {
      const p = draft.projects.find(x => x.id === convId);
      if (p) p.leadId = id;
    });
  }
  function openMember(id) { openModal(<MemberProfileModal memberId={id} />); }

  return (
    <>
      <ModalHeader title={t('conversationInfo')} />
      <div className="conv-info-head">
        {gc ? (
          <span className="conv-info-icon group"><Icon name="groups" /></span>
        ) : proj ? (
          <span className="conv-info-icon proj"><Icon name="boards" /></span>
        ) : (
          <Avatar m={member(db, dm.user)} size="a52" withPresence clickable={false} />
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          {gc && editingName ? (
            <input
              className="input" value={nameDraft} onChange={e => setNameDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
              onBlur={saveName} autoFocus
            />
          ) : (
            <div className={`conv-info-title${gc && isAdmin ? ' editable' : ''}`} onClick={gc && isAdmin ? startEditName : undefined}>
              {title}
              {gc && isAdmin && <Icon name="edit" style={{ width: 12, height: 12, marginLeft: 6, opacity: .5, flexShrink: 0 }} />}
            </div>
          )}
          <div className="conv-info-sub">
            {gc && t('membersCount').replace('{n}', gc.members.length)}
            {proj && t('membersCount').replace('{n}', proj.members.length)}
            {dm && t(member(db, dm.user).presence || 'offline')}
          </div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab${tab === 'overview' ? ' active' : ''}`} onClick={() => setTab('overview')}>{t('overview')}</button>
        <button className={`tab${tab === 'media' ? ' active' : ''}`} onClick={() => setTab('media')}>
          {t('media')}{(images.length + videos.length) > 0 ? ` (${images.length + videos.length})` : ''}
        </button>
        <button className={`tab${tab === 'documents' ? ' active' : ''}`} onClick={() => setTab('documents')}>
          {t('documents')}{docs.length > 0 ? ` (${docs.length})` : ''}
        </button>
      </div>

      {tab === 'overview' && (
        <div className="conv-info-overview">
          {gc && (
            <>
              <div className="conv-info-section-head">
                <span className="section-label" style={{ margin: 0 }}>{t('members')}</span>
                {isAdmin && <button className="btn btn-ghost btn-sm" onClick={() => setAddingMember(o => !o)}>+ {t('addMember')}</button>}
              </div>
              {addingMember && (
                <div style={{ marginBottom: 12 }}>
                  <MemberPicker candidates={db.team.filter(m => !gc.members.includes(m.id))} selected={newMemberIds} onChange={setNewMemberIds} autoFocus />
                  <div className="modal-foot" style={{ marginTop: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setAddingMember(false); setNewMemberIds([]); }}>{t('cancel')}</button>
                    <button className="btn btn-primary btn-sm" onClick={addMembers}>{t('addMember')}</button>
                  </div>
                </div>
              )}
              {!isAdmin && <p className="demo-hint" style={{ marginBottom: 10 }}>{t('adminOnlyHint')}</p>}
              {gc.members.map(id => {
                const m = member(db, id);
                const memberIsAdmin = gc.adminIds.includes(id);
                return (
                  <div className="task-row" key={id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <Avatar m={m} size="a30" withPresence onClick={() => openMember(id)} />
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                        {m.name}{id === user.id ? ` (${t('you')})` : ''}
                      </span>
                      {memberIsAdmin && <span className="role-badge role-ADMIN">{t('groupAdminLabel')}</span>}
                    </div>
                    {isAdmin && (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleAdmin(id)}>{memberIsAdmin ? t('removeAdminRole') : t('makeAdmin')}</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => removeMember(id)}>{t('removeFromGroup')}</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
          {proj && (
            <>
              <div className="conv-info-section-head">
                <span className="section-label" style={{ margin: 0 }}>{t('members')}</span>
                {isProjectLead && <button className="btn btn-ghost btn-sm" onClick={() => setAddingMember(o => !o)}>+ {t('addMember')}</button>}
              </div>
              {addingMember && (
                <div style={{ marginBottom: 12 }}>
                  <MemberPicker candidates={db.team.filter(m => !proj.members.includes(m.id))} selected={newMemberIds} onChange={setNewMemberIds} autoFocus />
                  <div className="modal-foot" style={{ marginTop: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setAddingMember(false); setNewMemberIds([]); }}>{t('cancel')}</button>
                    <button className="btn btn-primary btn-sm" onClick={addProjectMembers}>{t('addMember')}</button>
                  </div>
                </div>
              )}
              {!isProjectLead && <p className="demo-hint" style={{ marginBottom: 10 }}>{t('adminOnlyHint')}</p>}
              {proj.members.map(id => {
                const m = member(db, id);
                const memberIsLead = proj.leadId === id;
                return (
                  <div className="task-row" key={id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <Avatar m={m} size="a30" withPresence onClick={() => openMember(id)} />
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                        {m.name}{id === user.id ? ` (${t('you')})` : ''}
                      </span>
                      {memberIsLead && <span className="role-badge role-ADMIN">{t('projectLead')}</span>}
                    </div>
                    {isProjectLead && !memberIsLead && (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => transferLead(id)}>{t('transferLead')}</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => removeProjectMember(id)}>{t('removeFromProject')}</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
          {dm && (() => {
            const m = member(db, dm.user);
            return (
              <div className="task-row" style={{ cursor: 'pointer' }} onClick={() => openMember(m.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar m={m} size="a30" withPresence />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{m.email}</div>
                  </div>
                </div>
                <span className="link-accent" style={{ fontSize: 11.5, fontWeight: 600 }}>{t('viewFullProfile')}</span>
              </div>
            );
          })()}
        </div>
      )}

      {tab === 'media' && (
        (images.length + videos.length) > 0 ? (
          <div className="conv-info-media-grid">
            {[...images, ...videos].map((a, i) => (
              <div className="conv-info-media-tile" key={i} onClick={() => toast(t('download') + ' : ' + a.name)}>
                <Icon name={a.kind === 'video' ? 'cam' : 'fileImage'} />
                <span>{a.name}</span>
              </div>
            ))}
          </div>
        ) : <div className="empty-note">{t('noMedia')}</div>
      )}

      {tab === 'documents' && (
        docs.length > 0 ? (
          <div className="files-list">
            {docs.map((d, i) => {
              const kind = fileKind(d.name);
              return (
                <div className="file-row" key={i} onClick={() => toast(t('download') + ' : ' + d.name)}>
                  <span style={{ width: 20, height: 20, color: kind.color, display: 'inline-flex', flexShrink: 0 }}><Icon name={kind.icon} /></span>
                  <div className="file-main">
                    <div className="file-name">{d.name}</div>
                    <div className="file-meta">{member(db, d.from).name} · {d.time}</div>
                  </div>
                  <div className="file-size">{d.size}</div>
                </div>
              );
            })}
          </div>
        ) : <div className="empty-note">{t('noDocuments')}</div>
      )}

      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={closeModal}>{t('close')}</button>
      </div>
    </>
  );
}
