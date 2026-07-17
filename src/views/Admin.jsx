import { useState } from 'react';
import Avatar from '../components/Avatar.jsx';
import MemberProfileModal from '../components/MemberProfileModal.jsx';
import { ModalHeader } from '../components/Modal.jsx';
import { allCards, departmentName, GUEST_PERMISSION_KEYS, member, projectOverdueCount, projectProgress } from '../lib/helpers.js';
import { useApp } from '../state/AppContext.jsx';

const AVATAR_COLORS = ['#f0a04b', '#5b8def', '#9b7bf0', '#4bb37a', '#e0607a', '#2a9d8f', '#d18334', '#7c96f5'];
const DURATION_CHOICES = [1, 2, 3, 7, 14, 30];
const PERM_LEVELS = ['none', 'see', 'execute'];

function NewUserModal() {
  const { db, updateDB, closeModal, logAudit, toast, prefs, t } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('EMPLOYEE');
  const [departmentId, setDepartmentId] = useState('');
  function create() {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail) return;
    const initials = trimmedName.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
    updateDB(draft => {
      draft.team.push({
        id: 'u' + Date.now(), name: trimmedName, email: trimmedEmail, role,
        departmentId: departmentId || null, initials,
        color: AVATAR_COLORS[draft.team.length % AVATAR_COLORS.length],
        presence: 'offline', locked: false, hiddenProjectsOnProfile: [],
      });
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
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label className="field-label">{t('role')}</label>
          <select className="select" value={role} onChange={e => setRole(e.target.value)}>
            <option>EMPLOYEE</option><option>MANAGER</option><option>ADMIN</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label className="field-label">{t('department')}</label>
          <select className="select" value={departmentId} onChange={e => setDepartmentId(e.target.value)}>
            <option value="">—</option>
            {db.departments.map(d => <option value={d.id} key={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>
      <div className="demo-hint">{prefs.lang === 'en' ? 'A welcome email with credentials will be sent automatically.' : 'Un e-mail de bienvenue avec les identifiants sera envoyé automatiquement.'}</div>
      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={closeModal}>{t('cancel')}</button>
        <button className="btn btn-primary" onClick={create}>{t('create')}</button>
      </div>
    </>
  );
}

function NewDepartmentModal() {
  const { updateDB, closeModal, toast, t } = useApp();
  const [name, setName] = useState('');
  function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    updateDB(draft => {
      if (!draft.departments) draft.departments = [];
      draft.departments.push({ id: 'dept-' + Date.now(), name: trimmed });
    });
    closeModal();
    toast(t('departmentCreated'));
  }
  return (
    <>
      <ModalHeader title={t('newDepartment')} />
      <label className="field-label">{t('departmentName')}</label>
      <input className="input" value={name} onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') create(); }} autoFocus />
      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={closeModal}>{t('cancel')}</button>
        <button className="btn btn-primary" onClick={create}>{t('create')}</button>
      </div>
    </>
  );
}

function NewTemplateModal() {
  const { updateDB, db, closeModal, toast, t } = useApp();
  const [name, setName] = useState('');
  const [label, setLabel] = useState(db.labels[0]?.name || '');
  const [tasksText, setTasksText] = useState('');
  function create() {
    const trimmed = name.trim();
    const tasks = tasksText.split('\n').map(x => x.trim()).filter(Boolean);
    if (!trimmed || !tasks.length) return;
    updateDB(draft => { draft.templates.push({ id: 'tpl' + Date.now(), name: trimmed, label, tasks }); });
    closeModal();
    toast(t('templateCreated'));
  }
  return (
    <>
      <ModalHeader title={t('newTemplate')} />
      <label className="field-label">{t('templateName')}</label>
      <input className="input" value={name} onChange={e => setName(e.target.value)} autoFocus />
      <label className="field-label">{t('labels')}</label>
      <select className="select" value={label} onChange={e => setLabel(e.target.value)}>
        {db.labels.map(l => <option key={l.name}>{l.name}</option>)}
      </select>
      <label className="field-label">{t('templateTasks')} ({t('oneTaskPerLine')})</label>
      <textarea className="textarea" rows={5} value={tasksText} onChange={e => setTasksText(e.target.value)} />
      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={closeModal}>{t('cancel')}</button>
        <button className="btn btn-primary" onClick={create}>{t('create')}</button>
      </div>
    </>
  );
}

function AdminDashboard({ db, openModal, setUi, updateDB, user, toast, t }) {
  const activeProjects = db.projects.filter(p => !p.archived);
  const tasks = db.projects.flatMap(allCards).filter(c => !c.done).length;
  const overdue = activeProjects.reduce((s, p) => s + projectOverdueCount(p), 0);
  const avgProgress = activeProjects.length
    ? Math.round(activeProjects.reduce((s, p) => s + projectProgress(p), 0) / activeProjects.length)
    : 0;

  function quickGenerateGuestCode() {
    openModal(<GuestCodeModal />, { wide: true });
  }
  function exportAuditCsv() {
    const rows = [['action', 'user', 'detail', 'time'], ...db.auditLogs.map(l => [l.action, member(db, l.user).name, l.detail, l.time])];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'audit-log.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <h2 className="page-title">{t('adminDashboard')}</h2>
      <div className="admin-grid">
        <div className="card"><div className="stat-value">{db.team.filter(m => !m.locked).length}</div><div className="stat-label">{t('activeUsers')}</div></div>
        <div className="card"><div className="stat-value">{activeProjects.length}</div><div className="stat-label">{t('activeProjects')}</div></div>
        <div className="card"><div className="stat-value">{tasks}</div><div className="stat-label">{t('activeTasks')}</div></div>
        <div className="card"><div className="stat-value">{db.files.length}</div><div className="stat-label">{t('totalFiles')}</div></div>
        <div className="card"><div className="stat-value" style={{ color: overdue > 0 ? 'var(--danger)' : undefined }}>{overdue}</div><div className="stat-label">{t('overdueTasks')}</div></div>
        <div className="card"><div className="stat-value">{avgProgress}%</div><div className="stat-label">{t('avgProgress')}</div></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-label">{t('quickActions')}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-sm" onClick={() => openModal(<NewUserModal />)}>+ {t('newUser')}</button>
          <button className="btn btn-ghost btn-sm" onClick={quickGenerateGuestCode}>+ {t('generateCode')}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setUi({ adminTab: 'templates' })}>+ {t('newTemplate')}</button>
          <button className="btn btn-ghost btn-sm" onClick={exportAuditCsv}>{t('exportAudit')}</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-label">{t('projectsOverview')}</div>
        {activeProjects.map(p => {
          const pct = projectProgress(p);
          return (
            <div key={p.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-lt)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>{p.name}</span>
                <span style={{ color: 'var(--muted)' }}>{pct}% · {p.members.length} {t('members').toLowerCase()}</span>
              </div>
              <div style={{ height: 6, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: pct + '%', borderRadius: 4, background: 'var(--accent)' }} />
              </div>
            </div>
          );
        })}
        {!activeProjects.length && <div className="empty-note">{t('noProjects')}</div>}
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
  const [query, setQuery] = useState('');
  function changeRole(id, role) {
    const m = member(db, id);
    updateDB(draft => { draft.auditLogs.unshift({ id: Date.now(), action: 'ROLE_CHANGED', user: user.id, detail: `${m.name} : ${m.role} → ${role}`, time: '', sensitive: true }); const dm = draft.team.find(x => x.id === id); if (dm) dm.role = role; });
  }
  function toggleLockUser(id) {
    updateDB(draft => { const m = draft.team.find(x => x.id === id); m.locked = !m.locked; draft.auditLogs.unshift({ id: Date.now(), action: m.locked ? 'ACCOUNT_LOCKED' : 'ACCOUNT_UNLOCKED', user: user.id, detail: m.email, time: '', sensitive: true }); });
  }
  function updateDepartment(id, departmentId) {
    updateDB(draft => { const m = draft.team.find(x => x.id === id); if (m) m.departmentId = departmentId || null; });
  }
  const q = query.trim().toLowerCase();
  const rows = db.team.filter(m => !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || departmentName(db, m.departmentId).toLowerCase().includes(q));

  return (
    <>
      <div className="boards-head">
        <h2 className="page-title" style={{ margin: 0 }}>{t('users')}</h2>
        <button className="btn btn-primary btn-sm" onClick={() => openModal(<NewUserModal />)}>+ {t('newUser')}</button>
      </div>
      <input className="input" style={{ maxWidth: 320, marginBottom: 12 }} placeholder={t('searchUsers')} value={query} onChange={e => setQuery(e.target.value)} />
      <div className="card" style={{ padding: '4px 16px' }}>
        <table className="table">
          <thead><tr><th>{t('fullName')}</th><th>{t('department')}</th><th>{t('email')}</th><th>{t('role')}</th><th>{t('status')}</th><th>{t('actions')}</th></tr></thead>
          <tbody>
            {rows.map(m => (
              <tr key={m.id}>
                <td>
                  <Avatar m={m} size="a20" withPresence />{' '}
                  <span className="name-link" onClick={() => openModal(<MemberProfileModal memberId={m.id} />)}>{m.name}</span>
                </td>
                <td>
                  <select
                    className="select" style={{ padding: '4px 8px', fontSize: 11, width: 130 }}
                    value={m.departmentId || ''} onChange={e => updateDepartment(m.id, e.target.value)}
                  >
                    <option value="">—</option>
                    {db.departments.map(d => <option value={d.id} key={d.id}>{d.name}</option>)}
                  </select>
                </td>
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
            {!rows.length && <tr><td colSpan={6}><div className="empty-note">{t('noResults')}</div></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AdminDepartments({ db, updateDB, openModal, toast, t }) {
  function deleteDepartment(id) {
    const inUse = db.team.some(m => m.departmentId === id);
    if (inUse) { toast(t('departmentInUse')); return; }
    updateDB(draft => { draft.departments = draft.departments.filter(x => x.id !== id); });
    toast(t('departmentDeleted'));
  }
  return (
    <>
      <div className="boards-head">
        <h2 className="page-title" style={{ margin: 0 }}>{t('departments')}</h2>
        <button className="btn btn-primary btn-sm" onClick={() => openModal(<NewDepartmentModal />)}>+ {t('newDepartment')}</button>
      </div>
      <div className="files-list">
        {db.departments.map(d => {
          const count = db.team.filter(m => m.departmentId === d.id).length;
          return (
            <div className="file-row" key={d.id} style={{ cursor: 'default' }}>
              <div className="file-main">
                <div className="file-name">{d.name}</div>
                <div className="file-meta">{count} {t('members').toLowerCase()}</div>
              </div>
              <div className="file-actions" style={{ opacity: 1 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => deleteDepartment(d.id)}>{t('deleteDepartment')}</button>
              </div>
            </div>
          );
        })}
        {!db.departments.length && <div className="empty-note">{t('noResults')}</div>}
      </div>
    </>
  );
}

function AdminTemplates({ db, updateDB, openModal, toast, t }) {
  function deleteTemplate(id) {
    updateDB(draft => { draft.templates = draft.templates.filter(x => x.id !== id); });
    toast(t('templateDeleted'));
  }
  return (
    <>
      <div className="boards-head">
        <h2 className="page-title" style={{ margin: 0 }}>{t('templates')}</h2>
        <button className="btn btn-primary btn-sm" onClick={() => openModal(<NewTemplateModal />)}>+ {t('newTemplate')}</button>
      </div>
      <div className="files-list">
        {db.templates.map(tpl => (
          <div className="file-row" key={tpl.id} style={{ cursor: 'default' }}>
            <span className="pill" style={{ background: 'var(--accent-soft-2)', color: 'var(--accent)' }}>{tpl.label}</span>
            <div className="file-main">
              <div className="file-name">{tpl.name}</div>
              <div className="file-meta">{tpl.tasks.length} {t('templateTasks')} — {tpl.tasks.join(', ')}</div>
            </div>
            <div className="file-actions" style={{ opacity: 1 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => deleteTemplate(tpl.id)}>{t('deleteTemplate')}</button>
            </div>
          </div>
        ))}
        {!db.templates.length && <div className="empty-note">{t('noResults')}</div>}
      </div>
    </>
  );
}

function AdminSettings({ db, updateDB, toast, t }) {
  const settings = db.settings || {};
  const [companyName, setCompanyName] = useState(settings.companyName || 'INCO LAB');
  const [allowGuestCodes, setAllowGuestCodes] = useState(settings.allowGuestCodes !== false);
  const [require2FA, setRequire2FA] = useState(!!settings.require2FA);

  function save() {
    updateDB(draft => {
      draft.settings = { companyName: companyName.trim() || 'INCO LAB', allowGuestCodes, require2FA };
    });
    toast(t('settingsSaved'));
  }

  return (
    <>
      <h2 className="page-title">{t('settings')}</h2>
      <div className="card" style={{ marginBottom: 16, maxWidth: 480 }}>
        <div className="section-label">{t('generalSettings')}</div>
        <label className="field-label">{t('companyName')}</label>
        <input className="input" value={companyName} onChange={e => setCompanyName(e.target.value)} />
      </div>
      <div className="card" style={{ marginBottom: 16, maxWidth: 480 }}>
        <div className="section-label">{t('security')}</div>
        <label className="member-chip" style={{ cursor: 'pointer', marginBottom: 8 }}>
          <input type="checkbox" checked={allowGuestCodes} onChange={e => setAllowGuestCodes(e.target.checked)} /> {t('allowGuestCodes')}
        </label>
        <label className="member-chip" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={require2FA} onChange={e => setRequire2FA(e.target.checked)} /> {t('require2FADemo')}
        </label>
      </div>
      <div className="modal-foot" style={{ maxWidth: 480 }}>
        <button className="btn btn-primary" onClick={save}>{t('save')}</button>
      </div>
    </>
  );
}

function AdminAudit({ db, t }) {
  const [query, setQuery] = useState('');
  const [action, setAction] = useState('');
  const actions = [...new Set(db.auditLogs.map(l => l.action))];
  const rows = db.auditLogs.filter(l => {
    if (action && l.action !== action) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return l.action.toLowerCase().includes(q) || l.detail.toLowerCase().includes(q) || member(db, l.user).name.toLowerCase().includes(q);
  });
  return (
    <>
      <h2 className="page-title">{t('auditLogs')}</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input className="input" style={{ maxWidth: 260 }} placeholder={t('searchResults')} value={query} onChange={e => setQuery(e.target.value)} />
        <select className="select" style={{ width: 'auto' }} value={action} onChange={e => setAction(e.target.value)}>
          <option value="">{t('allActions')}</option>
          {actions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div className="card" style={{ padding: '4px 16px' }}>
        <table className="table">
          <thead><tr><th>Action</th><th>{t('users')}</th><th>Détail</th><th>⏱</th></tr></thead>
          <tbody>
            {rows.map(l => (
              <tr key={l.id}>
                <td>{l.sensitive ? '🔒 ' : ''}<b>{l.action}</b></td>
                <td>{member(db, l.user).name}</td>
                <td>{l.detail}</td>
                <td style={{ color: 'var(--muted)' }}>{l.time}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={4}><div className="empty-note">{t('noResults')}</div></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function GuestCodeModal({ guestId }) {
  const { db, user, updateDB, closeModal, toast, t } = useApp();
  const gc = guestId ? db.guestCodes.find(g => g.id === guestId) : null;
  const isCreate = !guestId;
  if (guestId && !gc) return null;

  const [name, setName] = useState(gc ? gc.name || '' : '');
  const [email, setEmail] = useState(gc ? gc.email || '' : '');
  const [validityType, setValidityType] = useState(gc ? gc.validityType || 'time' : 'time');
  const [durationDays, setDurationDays] = useState(gc ? gc.durationDays || 7 : 7);
  const [scopeProjectId, setScopeProjectId] = useState(gc ? gc.scopeProjectId || '' : '');
  const [scopeGroupId, setScopeGroupId] = useState(gc ? gc.scopeGroupId || '' : '');
  const [permissions, setPermissions] = useState(
    gc ? { ...gc.permissions } : Object.fromEntries(GUEST_PERMISSION_KEYS.map(k => [k, 'none']))
  );

  function setLevel(key, level) { setPermissions(prev => ({ ...prev, [key]: level })); }

  function save() {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const payload = {
      name: trimmedName, email: email.trim(), validityType,
      durationDays: validityType === 'time' ? durationDays : null,
      expiresAt: validityType === 'time' && durationDays ? Date.now() + durationDays * 86400000 : null,
      scopeProjectId: scopeProjectId || null,
      scopeGroupId: validityType === 'group' ? (scopeGroupId || null) : null,
      permissions,
    };
    if (isCreate) {
      const code = 'GUEST-' + Math.random().toString(36).slice(2, 6).toUpperCase();
      updateDB(draft => {
        draft.guestCodes.unshift({ id: Date.now(), code, createdBy: user.id, uses: 0, max: 5, active: true, ...payload });
      });
      toast(t('generateCode') + ' ✓');
    } else {
      updateDB(draft => {
        const d = draft.guestCodes.find(x => x.id === guestId);
        if (d) Object.assign(d, payload);
      });
      toast(t('accessUpdated'));
    }
    closeModal();
  }

  return (
    <>
      <ModalHeader title={isCreate ? t('generateGuestCode') : t('guestAccessSettings')} />
      <label className="field-label">{t('guestFullName')} *</label>
      <input className="input" value={name} onChange={e => setName(e.target.value)} autoFocus />
      <label className="field-label">{t('guestEmail')}</label>
      <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} />

      <div className="guest-section-label">{t('validityType')} *</div>
      <div className="tabs">
        {[['time', t('timeBased')], ['project', t('projectBased')], ['group', t('groupBased')]].map(([k, lbl]) => (
          <button key={k} type="button" className={`tab${validityType === k ? ' active' : ''}`} onClick={() => setValidityType(k)}>{lbl}</button>
        ))}
      </div>

      {validityType === 'time' && (
        <>
          <label className="field-label">{t('duration')}</label>
          <div className="chip-group">
            {DURATION_CHOICES.map(d => (
              <button key={d} type="button" className={`chip-btn${durationDays === d ? ' active' : ''}`} onClick={() => setDurationDays(d)}>
                {d}{t('dayAbbrev')}
              </button>
            ))}
          </div>
        </>
      )}

      {validityType === 'group' && (
        <>
          <label className="field-label">{t('groupOptional')}</label>
          <select className="select" value={scopeGroupId} onChange={e => setScopeGroupId(e.target.value)}>
            <option value="">{t('noSpecificGroup')}</option>
            {db.groupChats.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </>
      )}

      <label className="field-label">{t('projectOptional')}</label>
      <select className="select" value={scopeProjectId} onChange={e => setScopeProjectId(e.target.value)}>
        <option value="">{t('noSpecificProject')}</option>
        {db.projects.filter(p => !p.archived).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      <div className="guest-section-label">{t('accessPermissions')}</div>
      <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 6px' }}>{t('accessPermissionsHint')}</p>
      <div className="perm-grid">
        {GUEST_PERMISSION_KEYS.map(k => (
          <div className="perm-row" key={k}>
            <span className="perm-row-label">{t(k)}</span>
            <div className="perm-seg">
              {PERM_LEVELS.map(lvl => (
                <button
                  key={lvl} type="button"
                  className={`perm-btn lvl-${lvl}${permissions[k] === lvl ? ' active' : ''}`}
                  onClick={() => setLevel(k, lvl)}
                >{t('level' + lvl[0].toUpperCase() + lvl.slice(1))}</button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={closeModal}>{t('cancel')}</button>
        <button className="btn btn-primary" onClick={save} disabled={!name.trim()}>{isCreate ? t('generate') : t('save')}</button>
      </div>
    </>
  );
}

function AdminGuests({ db, updateDB, openModal, user, toast, t }) {
  const allowed = db.settings?.allowGuestCodes !== false;
  function openGenerateModal() {
    openModal(<GuestCodeModal />, { wide: true });
  }
  function copyGuestCode(code) {
    if (navigator.clipboard) navigator.clipboard.writeText(code);
    toast(t('copied'));
  }
  function toggleGuestCode(id) {
    updateDB(draft => { const g = draft.guestCodes.find(x => x.id === id); g.active = !g.active; });
  }
  function configureAccess(id) {
    openModal(<GuestCodeModal guestId={id} />, { wide: true });
  }
  return (
    <>
      <div className="boards-head">
        <h2 className="page-title" style={{ margin: 0 }}>{t('guestCodes')}</h2>
        <button className="btn btn-primary btn-sm" onClick={openGenerateModal} disabled={!allowed}>+ {t('generateCode')}</button>
      </div>
      {!allowed && <div className="demo-hint" style={{ marginBottom: 12 }}>{t('guestCodesDisabledNote')}</div>}
      <div className="card" style={{ padding: '4px 16px' }}>
        <table className="table">
          <thead><tr><th>Code</th><th>{t('guestIdentity')}</th><th>{t('users')}</th><th>Utilisations</th><th>{t('status')}</th><th>{t('actions')}</th></tr></thead>
          <tbody>
            {db.guestCodes.map(g => (
              <tr key={g.id}>
                <td style={{ fontFamily: 'ui-monospace,monospace', fontWeight: 700 }}>{g.code}</td>
                <td>{g.name || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                <td>{member(db, g.createdBy).name}</td>
                <td>{g.uses}/{g.max}</td>
                <td><span className="tag-soft" style={g.active ? { background: 'rgba(75,179,122,.15)', color: 'var(--success)' } : { background: 'rgba(229,72,77,.15)', color: 'var(--danger)' }}>{g.active ? t('active') : t('locked')}</span></td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => configureAccess(g.id)}>{t('configureAccess')}</button>
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

function AdminLocked({ db, updateDB, openModal, t }) {
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
              <div className="file-main">
                <div className="file-name">
                  <span className="name-link" onClick={() => openModal(<MemberProfileModal memberId={m.id} />)}>{m.name}</span>
                </div>
                <div className="file-meta">{m.email}</div>
              </div>
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
    ['dashboard', t('adminDashboard')], ['users', t('users')], ['departments', t('departments')],
    ['templates', t('templates')], ['audit', t('auditLogs')], ['guests', t('guestCodes')],
    ['locked', t('lockedAccounts')], ['settings', t('settings')],
  ];
  let body;
  if (ui.adminTab === 'users') body = <AdminUsers db={db} updateDB={updateDB} user={user} openModal={openModal} t={t} />;
  else if (ui.adminTab === 'departments') body = <AdminDepartments db={db} updateDB={updateDB} openModal={openModal} toast={toast} t={t} />;
  else if (ui.adminTab === 'templates') body = <AdminTemplates db={db} updateDB={updateDB} openModal={openModal} toast={toast} t={t} />;
  else if (ui.adminTab === 'audit') body = <AdminAudit db={db} t={t} />;
  else if (ui.adminTab === 'guests') body = <AdminGuests db={db} updateDB={updateDB} openModal={openModal} user={user} toast={toast} t={t} />;
  else if (ui.adminTab === 'locked') body = <AdminLocked db={db} updateDB={updateDB} openModal={openModal} t={t} />;
  else if (ui.adminTab === 'settings') body = <AdminSettings db={db} updateDB={updateDB} toast={toast} t={t} />;
  else body = <AdminDashboard db={db} openModal={openModal} setUi={setUi} updateDB={updateDB} user={user} toast={toast} t={t} />;

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
