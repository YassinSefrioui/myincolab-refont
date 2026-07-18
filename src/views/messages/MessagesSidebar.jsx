import Icon from '../../components/Icon.jsx';
import Avatar from '../../components/Avatar.jsx';
import { ModalHeader } from '../../components/Modal.jsx';
import MemberPicker from '../../components/MemberPicker.jsx';
import { hasGuestExecute, lastMessage, member, previewText, unreadCount, visibleProjectsFor } from '../../lib/helpers.js';
import { useApp } from '../../state/AppContext.jsx';
import { useState } from 'react';

function NewDMModal() {
  const { db, updateDB, user, closeModal, setUi, t } = useApp();
  const existing = db.dms.map(d => d.user);
  const candidates = db.team.filter(m => m.id !== user.id && !existing.includes(m.id));
  const [uid, setUid] = useState(null);
  function create() {
    if (!uid) return;
    const id = 'dm-' + uid;
    updateDB(draft => {
      draft.dms.push({ id, user: uid });
      draft.messagesByConv[id] = [];
    });
    closeModal();
    setUi({ activeConvId: id, msgPane: 'chat' });
  }
  return (
    <>
      <ModalHeader title={t('newConversation')} />
      {candidates.length ? (
        <>
          <label className="field-label">{t('members')}</label>
          <MemberPicker candidates={candidates} selected={uid} onChange={setUid} multi={false} autoFocus />
          <div className="modal-foot">
            <button className="btn btn-ghost" onClick={closeModal}>{t('cancel')}</button>
            <button className="btn btn-primary" onClick={create}>{t('create')}</button>
          </div>
        </>
      ) : <div className="empty-note">{t('noResults')}</div>}
    </>
  );
}

function NewGroupChatModal() {
  const { db, updateDB, user, closeModal, setUi, t } = useApp();
  const [name, setName] = useState('');
  const [members, setMembers] = useState([]);
  function create() {
    const trimmed = name.trim();
    if (!trimmed || !members.length) return;
    const id = 'gc-' + Date.now();
    updateDB(draft => {
      draft.groupChats.push({ id, name: trimmed, members: [...members, user.id], adminIds: [user.id] });
      draft.messagesByConv[id] = [];
    });
    closeModal();
    setUi({ activeConvId: id, msgPane: 'chat' });
  }
  return (
    <>
      <ModalHeader title={t('groupChats')} />
      <label className="field-label">{t('groupName')}</label>
      <input className="input" value={name} onChange={e => setName(e.target.value)} autoFocus />
      <label className="field-label">{t('members')}</label>
      <MemberPicker candidates={db.team.filter(m => m.id !== user.id)} selected={members} onChange={setMembers} />
      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={closeModal}>{t('cancel')}</button>
        <button className="btn btn-primary" onClick={create}>{t('create')}</button>
      </div>
    </>
  );
}

function ConvRow({ active, icon, unread, name, convId, onClick }) {
  const { db, user } = useApp();
  const last = lastMessage(db, convId);
  const preview = last ? (last.user === user.id ? 'Vous : ' : '') + previewText(db, last) : '';
  return (
    <div className={`chan-item-v2${active ? ' active' : ''}`} onClick={onClick}>
      {icon}
      <div className="chan-item-body">
        <div className="chan-item-top">
          <span className="nm">{name}</span>
          {last && <span className="chan-item-time">{last.time}</span>}
        </div>
        <div className="chan-item-preview">
          <span className="chan-item-preview-text">{preview || ' '}</span>
          {unread > 0 && <span className="unread">{unread}</span>}
        </div>
      </div>
    </div>
  );
}

export default function MessagesSidebar() {
  const { db, user, ui, setUi, go, openModal, t } = useApp();

  function switchConv(id) { setUi({ activeConvId: id, msgPane: 'chat' }); }

  const activeProjects = visibleProjectsFor(db, user).filter(p => !p.archived);
  const canEditMessages = hasGuestExecute(user, 'messages');
  const groupChats = user.allowedGroupIds ? db.groupChats.filter(g => user.allowedGroupIds.includes(g.id)) : db.groupChats;

  return (
    <>
      <div className="sec-head">
        <div className="section-label">{t('projectDiscussions')}</div>
        <button className="sec-add" title={t('newProjectShort')} onClick={() => go('projects')}>＋</button>
      </div>
      {activeProjects.map(p => (
        <ConvRow
          key={p.id} convId={p.id} active={ui.activeConvId === p.id} unread={unreadCount(db, p.id)}
          icon={<span className="chan-item-icon muted"><Icon name="boards" /></span>}
          name={p.name} onClick={() => switchConv(p.id)}
        />
      ))}

      <div className="sec-head" style={{ marginTop: 10 }}>
        <div className="section-label">{t('directMessages')}</div>
        {canEditMessages && <button className="sec-add" title={t('newConversation')} onClick={() => openModal(<NewDMModal />)}>＋</button>}
      </div>
      {db.dms.map(d => {
        const m = member(db, d.user);
        return (
          <ConvRow
            key={d.id} convId={d.id} active={ui.activeConvId === d.id} unread={unreadCount(db, d.id)}
            icon={<Avatar m={m} size="a20" withPresence />}
            name={m.name} onClick={() => switchConv(d.id)}
          />
        );
      })}

      <div className="sec-head" style={{ marginTop: 10 }}>
        <div className="section-label">{t('groupChats')}</div>
        {canEditMessages && <button className="sec-add" onClick={() => openModal(<NewGroupChatModal />, { wide: true })}>＋</button>}
      </div>
      {groupChats.map(g => (
        <ConvRow
          key={g.id} convId={g.id} active={ui.activeConvId === g.id} unread={unreadCount(db, g.id)}
          icon={<span className="chan-item-icon muted">👥</span>}
          name={g.name} onClick={() => switchConv(g.id)}
        />
      ))}
    </>
  );
}
