import { useState } from 'react';
import Avatar from '../components/Avatar.jsx';
import { ModalHeader } from '../components/Modal.jsx';
import { allCards, member } from '../lib/helpers.js';
import { useApp } from '../state/AppContext.jsx';

const AVATAR_COLORS = ['#f0a04b', '#5b8def', '#9b7bf0', '#4bb37a', '#e0607a', '#2a9d8f', '#d18334', '#7c96f5'];

function NewUserModal() {
  const { db, updateDB, closeModal, logAudit, toast, prefs, t } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('EMPLOYEE');
  function create() {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail) return;
    const initials = trimmedName.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
    updateDB(draft => {
      draft.team.push({ id: 'u' + Date.now(), name: trimmedName, email: trimmedEmail, role, job: '', initials, color: AVATAR_COLORS[draft.team.length % AVATAR_COLORS.length], presence: 'offline', locked: false });
    });
    logAudit('USER_CREATED', trimmedEmail, true);
    closeModal();
    toast(t('createUser') + ' ✓');
  }
  return (
    <>
      <ModalHeader title={t('createUser')} />
      <label className="field-label">{t('fullName')}</label>
      <input className="input" value={name} onChange={e => setName(e.target.value)} />
      <label className="field-label">{t('email')}</label>
      <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
      <label className="field-label">{t('role')}</label>
      <select className="select" value={role} onChange={e => setRole(e.target.value)}>
        <option>EMPLOYEE</option><option>MANAGER</option><option>ADMIN</option>
      </select>
      <div className="demo-hint">{prefs.lang === 'en' ? 'A welcome email with credentials will be sent automatically.' : 'Un e-mail de bienvenue avec les identifiants sera envoyé automatiquement.'}</div>
      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={closeModal}>{t('cancel')}</button>
        <button className="btn btn-primary" onClick={create}>{t('create')}</button>
      </div>
    </>
  );
}

function AdminDashboard({ db, t }) {
  const activeProjects = db.projects.filter(p => !p.archived).length;
  const tasks = db.projects.flatMap(allCards).filter(c => !c.done).length;
  return (
    <>
      <h2 className="page-title">{t('adminDashboard')}</h2>
      <div className="admin-grid">
        <div className="card"><div className="stat-value">{db.team.filter(m => !m.locked).length}</div><div className="stat-label">{t('activeUsers')}</div></div>
        <div className="card"><div className="stat-value">{activeProjects}</div><div className="stat-label">{t('activeProjects')}</div></div>
        <div className="card"><div className="stat-value">{tasks}</div><div className="stat-label">{t('activeTasks')}</div></div>
        <div className="card"><div className="stat-value">{db.files.length}</div><div className="stat-label">{t('totalFiles')}</div></div>
      </div>
      <div className="card">
        <div className="section-label">{t('recentActivity')}</div>
        {db.auditLogs.slice(0, 6).map(l => (
          <div className="activity-row" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }} key={l.id}>
            <span>{l.sensitive ? '🔒 ' : ''}<b>{l.action}</b> — {l.detail}</span>
            <span style={{ color: 'var(--muted)', flexShrink: 0 }}>{l.time}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function AdminUsers({ db, updateDB, user, openModal, t }) {
  function changeRole(id, role) {
    const m = member(db, id);
    updateDB(draft => { draft.auditLogs.unshift({ id: Date.now(), action: 'ROLE_CHANGED', user: user.id, detail: `${m.name} : ${m.role} → ${role}`, time: '', sensitive: true }); const dm = draft.team.find(x => x.id === id); if (dm) dm.role = role; });
  }
  function toggleLockUser(id) {
    updateDB(draft => { const m = draft.team.find(x => x.id === id); m.locked = !m.locked; draft.auditLogs.unshift({ id: Date.now(), action: m.locked ? 'ACCOUNT_LOCKED' : 'ACCOUNT_UNLOCKED', user: user.id, detail: m.email, time: '', sensitive: true }); });
  }
  return (
    <>
      <div className="boards-head">
        <h2 className="page-title" style={{ margin: 0 }}>{t('users')}</h2>
        <button className="btn btn-primary btn-sm" onClick={() => openModal(<NewUserModal />)}>+ {t('newUser')}</button>
      </div>
      <div className="card" style={{ padding: '4px 16px' }}>
        <table className="table">
          <thead><tr><th>{t('fullName')}</th><th>{t('email')}</th><th>{t('role')}</th><th>{t('status')}</th><th>{t('actions')}</th></tr></thead>
          <tbody>
            {db.team.map(m => (
              <tr key={m.id}>
                <td><Avatar m={m} size="a20" withPresence /> {m.name}</td>
                <td>{m.email}</td>
                <td>
                  <select className="select" style={{ width: 'auto', padding: '4px 8px', fontSize: 11 }} value={m.role} disabled={m.id === user.id} onChange={e => changeRole(m.id, e.target.value)}>
                    {['ADMIN', 'MANAGER', 'EMPLOYEE'].map(r => <option key={r}>{r}</option>)}
                  </select>
                </td>
                <td><span className="tag-soft" style={m.locked ? { background: 'rgba(229,72,77,.15)', color: 'var(--danger)' } : { background: 'rgba(75,179,122,.15)', color: 'var(--success)' }}>{m.locked ? t('locked') : t('active')}</span></td>
                <td>{m.id !== user.id ? <button className="btn btn-ghost btn-sm" onClick={() => toggleLockUser(m.id)}>{m.locked ? t('unlock') : t('deactivate')}</button> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AdminAudit({ db, t }) {
  return (
    <>
      <h2 className="page-title">{t('auditLogs')}</h2>
      <div className="card" style={{ padding: '4px 16px' }}>
        <table className="table">
          <thead><tr><th>Action</th><th>{t('users')}</th><th>Détail</th><th>⏱</th></tr></thead>
          <tbody>
            {db.auditLogs.map(l => (
              <tr key={l.id}>
                <td>{l.sensitive ? '🔒 ' : ''}<b>{l.action}</b></td>
                <td>{member(db, l.user).name}</td>
                <td>{l.detail}</td>
                <td style={{ color: 'var(--muted)' }}>{l.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AdminGuests({ db, updateDB, user, toast, t }) {
  function generateGuestCode() {
    const code = 'GUEST-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    updateDB(draft => { draft.guestCodes.unshift({ id: Date.now(), code, createdBy: user.id, uses: 0, max: 5, active: true }); });
    toast('Code généré ✓');
  }
  function copyGuestCode(code) {
    if (navigator.clipboard) navigator.clipboard.writeText(code);
    toast(t('copied'));
  }
  function toggleGuestCode(id) {
    updateDB(draft => { const g = draft.guestCodes.find(x => x.id === id); g.active = !g.active; });
  }
  return (
    <>
      <div className="boards-head">
        <h2 className="page-title" style={{ margin: 0 }}>{t('guestCodes')}</h2>
        <button className="btn btn-primary btn-sm" onClick={generateGuestCode}>+ {t('generateCode')}</button>
      </div>
      <div className="card" style={{ padding: '4px 16px' }}>
        <table className="table">
          <thead><tr><th>Code</th><th>{t('users')}</th><th>Utilisations</th><th>{t('status')}</th><th>{t('actions')}</th></tr></thead>
          <tbody>
            {db.guestCodes.map(g => (
              <tr key={g.id}>
                <td style={{ fontFamily: 'ui-monospace,monospace', fontWeight: 700 }}>{g.code}</td>
                <td>{member(db, g.createdBy).name}</td>
                <td>{g.uses}/{g.max}</td>
                <td><span className="tag-soft" style={g.active ? { background: 'rgba(75,179,122,.15)', color: 'var(--success)' } : { background: 'rgba(229,72,77,.15)', color: 'var(--danger)' }}>{g.active ? t('active') : t('locked')}</span></td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => copyGuestCode(g.code)}>{t('copied').split(' ')[0]}</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => toggleGuestCode(g.id)}>{g.active ? t('deactivate') : t('activate')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AdminLocked({ db, updateDB, t }) {
  const locked = db.team.filter(m => m.locked);
  function toggleLockUser(id) {
    updateDB(draft => { const m = draft.team.find(x => x.id === id); m.locked = !m.locked; });
  }
  return (
    <>
      <h2 className="page-title">{t('lockedAccounts')}</h2>
      {locked.length ? (
        <div className="files-list">
          {locked.map(m => (
            <div className="file-row" key={m.id}>
              <Avatar m={m} size="a30" />
              <div className="file-main"><div className="file-name">{m.name}</div><div className="file-meta">{m.email}</div></div>
              <button className="btn btn-primary btn-sm" onClick={() => toggleLockUser(m.id)}>{t('unlock')}</button>
            </div>
          ))}
        </div>
      ) : <div className="card empty-note">✅ {t('noLockedAccounts')}</div>}
    </>
  );
}

export default function Admin() {
  const { db, updateDB, user, ui, setUi, openModal, toast, t } = useApp();
  if (user.role !== 'ADMIN') {
    return <div className="empty-note view-anim">⛔ Accès administrateur requis</div>;
  }
  const tabs = [
    ['dashboard', t('adminDashboard')], ['users', t('users')], ['audit', t('auditLogs')],
    ['guests', t('guestCodes')], ['locked', t('lockedAccounts')],
  ];
  let body;
  if (ui.adminTab === 'users') body = <AdminUsers db={db} updateDB={updateDB} user={user} openModal={openModal} t={t} />;
  else if (ui.adminTab === 'audit') body = <AdminAudit db={db} t={t} />;
  else if (ui.adminTab === 'guests') body = <AdminGuests db={db} updateDB={updateDB} user={user} toast={toast} t={t} />;
  else if (ui.adminTab === 'locked') body = <AdminLocked db={db} updateDB={updateDB} t={t} />;
  else body = <AdminDashboard db={db} t={t} />;

  return (
    <div className="view-anim">
      <div className="tabs">
        {tabs.map(([k, lbl]) => (
          <button key={k} className={`tab${ui.adminTab === k ? ' active' : ''}`} onClick={() => setUi({ adminTab: k })}>{lbl}</button>
        ))}
      </div>
      {body}
    </div>
  );
}
