import { useState } from 'react';
import Avatar from '../components/Avatar.jsx';
import { ModalHeader } from '../components/Modal.jsx';
import MemberPicker from '../components/MemberPicker.jsx';
import MemberProfileModal from '../components/MemberProfileModal.jsx';
import { hasGuestExecute, member } from '../lib/helpers.js';
import { useApp } from '../state/AppContext.jsx';

function NewGroupModal({ parentId }) {
  const { updateDB, closeModal, logAudit, t } = useApp();
  const [name, setName] = useState('');
  function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    updateDB(draft => { draft.groups.push({ id: 'g' + Date.now(), name: trimmed, parent: parentId, members: [] }); });
    logAudit('GROUP_CREATED', trimmed, false);
    closeModal();
  }
  return (
    <>
      <ModalHeader title={parentId ? t('addSubgroup') : t('newGroup')} />
      <label className="field-label">{t('groupName')}</label>
      <input className="input" value={name} onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') create(); }} autoFocus />
      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={closeModal}>{t('cancel')}</button>
        <button className="btn btn-primary" onClick={create}>{t('create')}</button>
      </div>
    </>
  );
}

function AddMemberModal({ groupId }) {
  const { db, updateDB, closeModal, prefs, t } = useApp();
  const g = db.groups.find(x => x.id === groupId);
  const candidates = db.team.filter(m => !g.members.includes(m.id));
  const [ids, setIds] = useState([]);
  function add() {
    if (!ids.length) return;
    updateDB(draft => {
      const dg = draft.groups.find(x => x.id === groupId);
      ids.forEach(id => { if (!dg.members.includes(id)) dg.members.push(id); });
    });
    closeModal();
  }
  return (
    <>
      <ModalHeader title={t('addMember') + ' — ' + g.name} />
      {candidates.length ? (
        <>
          <div style={{ marginTop: 10 }}>
            <MemberPicker candidates={candidates} selected={ids} onChange={setIds} autoFocus />
          </div>
          <div className="modal-foot">
            <button className="btn btn-ghost" onClick={closeModal}>{t('cancel')}</button>
            <button className="btn btn-primary" onClick={add}>{t('addMember')}</button>
          </div>
        </>
      ) : <div className="empty-note">{prefs.lang === 'en' ? 'All members are already in this group.' : 'Tous les membres sont déjà dans ce groupe.'}</div>}
    </>
  );
}

function GroupCard({ g, db, updateDB, openModal, t, onOpenProfile, canEdit }) {
  const children = db.groups.filter(x => x.parent === g.id);
  function removeMember(userId) {
    updateDB(draft => { const dg = draft.groups.find(x => x.id === g.id); dg.members = dg.members.filter(id => id !== userId); });
  }
  return (
    <div className="card group-card">
      <div className="group-head">
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>
          {g.name}
          <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400, marginLeft: 6 }}>{g.members.length} {t('members').toLowerCase()}</span>
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => openModal(<AddMemberModal groupId={g.id} />, { wide: true })}>+ {t('addMember')}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => openModal(<NewGroupModal parentId={g.id} />)}>+ {t('addSubgroup')}</button>
          </div>
        )}
      </div>
      <div className="member-chips">
        {g.members.map(id => (
          <span className="member-chip" key={id}>
            <Avatar m={member(db, id)} size="a20" withPresence />
            <span className="name-link" onClick={() => onOpenProfile(id)}>{member(db, id).name}</span>
            {canEdit && <span style={{ cursor: 'pointer', color: 'var(--muted)' }} onClick={() => removeMember(id)} title={t('delete')}>✕</span>}
          </span>
        ))}
      </div>
      {children.length > 0 && (
        <div className="subgroup-wrap">
          {children.map(c => <GroupCard key={c.id} g={c} db={db} updateDB={updateDB} openModal={openModal} t={t} onOpenProfile={onOpenProfile} canEdit={canEdit} />)}
        </div>
      )}
    </div>
  );
}

export default function Groups() {
  const { db, user, updateDB, openModal, t } = useApp();
  const roots = db.groups.filter(g => !g.parent);
  const canEdit = hasGuestExecute(user, 'groups');
  function onOpenProfile(id) { openModal(<MemberProfileModal memberId={id} />); }
  return (
    <div className="view-anim">
      <div className="boards-head">
        <h2 className="page-title" style={{ margin: 0 }}>{t('groups')}</h2>
        {canEdit && <button className="btn btn-primary btn-sm" onClick={() => openModal(<NewGroupModal parentId={null} />)}>+ {t('newGroup')}</button>}
      </div>
      {roots.map(g => <GroupCard key={g.id} g={g} db={db} updateDB={updateDB} openModal={openModal} t={t} onOpenProfile={onOpenProfile} canEdit={canEdit} />)}
    </div>
  );
}
