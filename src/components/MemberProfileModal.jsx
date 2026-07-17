import Avatar from './Avatar.jsx';
import { ModalHeader } from './Modal.jsx';
import { departmentName, visibleProjectsForProfile } from '../lib/helpers.js';
import { useApp } from '../state/AppContext.jsx';

export default function MemberProfileModal({ memberId }) {
  const { db, updateDB, user, closeModal, setUi, t } = useApp();
  const m = db.team.find(x => x.id === memberId);
  if (!m) return null;
  const isMe = m.id === user.id;

  const hidden = new Set(m.hiddenProjectsOnProfile || []);
  const projects = isMe
    ? db.projects.filter(p => !p.archived && p.members.includes(m.id))
    : visibleProjectsForProfile(db, m.id);
  const dept = departmentName(db, m.departmentId);

  function messageMember() {
    if (isMe) { closeModal(); setUi({ view: 'profile' }); return; }
    let dm = db.dms.find(d => d.user === m.id);
    if (!dm) {
      const id = 'dm-' + m.id;
      updateDB(draft => {
        draft.dms.push({ id, user: m.id });
        draft.messagesByConv[id] = [];
      });
      dm = { id };
    }
    closeModal();
    setUi({ view: 'messages', activeConvId: dm.id });
  }
  function manageVisibility() { closeModal(); setUi({ view: 'profile' }); }

  return (
    <>
      <ModalHeader title={t('profile')} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '4px 0 16px' }}>
        <Avatar m={m} size="a52" withPresence clickable={false} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            {m.name} {m.role && <span className={`role-badge role-${m.role}`}>{m.role}</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{[dept, m.email].filter(Boolean).join(' · ')}</div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 14 }}>
        {t('presenceStatus')} : <b>{t(m.presence || 'offline')}</b>
      </div>
      {projects.length > 0 && (
        <>
          <label className="field-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {t('projects')}
            {isMe && <span className="link-accent" style={{ fontSize: 11, fontWeight: 600 }} onClick={manageVisibility}>{t('manageVisibility')}</span>}
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
            {projects.map(p => {
              const isHidden = isMe && hidden.has(p.id);
              return (
                <span
                  key={p.id} className="tag-soft"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)', opacity: isHidden ? .55 : 1 }}
                  title={isHidden ? t('hiddenFromProfile') : undefined}
                >
                  {p.name}{isHidden ? ` (${t('hiddenFromProfile')})` : ''}
                </span>
              );
            })}
          </div>
        </>
      )}
      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={closeModal}>{t('close')}</button>
        <button className="btn btn-primary" onClick={messageMember}>{isMe ? t('profile') : t('sendMessage')}</button>
      </div>
    </>
  );
}
