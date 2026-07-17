import { useState } from 'react';
import { SEED } from '../data.js';
import { departmentName } from '../lib/helpers.js';
import { useApp } from '../state/AppContext.jsx';

export default function Profile() {
  const { db, updateDB, user, setUser, prefs, setLang, setTheme, setFontSize, logout, logAudit, toast, t } = useApp();
  const [pwCur, setPwCur] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [tzChoice, setTzChoice] = useState('');
  const me = user;
  const meRecord = db.team.find(x => x.id === user.id) || user;
  const dept = departmentName(db, meRecord.departmentId);
  const hiddenProjects = new Set(meRecord.hiddenProjectsOnProfile || []);
  const myProjects = db.projects.filter(p => !p.archived && p.members.includes(user.id));

  function toggleProjectVisibility(pid) {
    updateDB(draft => {
      const dm = draft.team.find(x => x.id === user.id);
      if (!dm) return;
      if (!Array.isArray(dm.hiddenProjectsOnProfile)) dm.hiddenProjectsOnProfile = [];
      dm.hiddenProjectsOnProfile = dm.hiddenProjectsOnProfile.includes(pid)
        ? dm.hiddenProjectsOnProfile.filter(x => x !== pid)
        : [...dm.hiddenProjectsOnProfile, pid];
    });
  }

  function tzTime(tz) {
    try { return new Date().toLocaleTimeString(prefs.lang === 'en' ? 'en-US' : 'fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: tz }); }
    catch (e) { return '—'; }
  }
  function setPresence(p) {
    updateDB(draft => { const m = draft.team.find(x => x.id === me.id); if (m) m.presence = p; });
    setUser(u => ({ ...u, presence: p }));
    toast(t(p));
  }
  function addTimezone() {
    const choice = SEED.timezoneChoices.find(c => c.tz === tzChoice);
    if (!choice) return;
    updateDB(draft => { draft.timezones.push({ id: 'z' + Date.now(), label: choice.label, tz: choice.tz }); });
    setTzChoice('');
  }
  function removeTimezone(id) {
    updateDB(draft => { draft.timezones = draft.timezones.filter(z => z.id !== id); });
  }
  function updatePassword() {
    if (!pwCur || !pwNew) return;
    logAudit('PASSWORD_CHANGED', me.email, true);
    setPwCur(''); setPwNew('');
    toast(t('profileUpdated'));
  }

  const availableChoices = SEED.timezoneChoices.filter(c => !db.timezones.some(z => z.tz === c.tz));

  return (
    <div className="view-anim" style={{ maxWidth: 660 }}>
      <h2 className="page-title">{t('profile')}</h2>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="profile-head">
          <span className="profile-avatar" style={{ background: me.color }}>{me.initials}</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{me.name} <span className={`role-badge role-${me.role}`}>{me.role}</span></div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{[dept, me.email].filter(Boolean).join(' · ')}</div>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{t('presenceStatus')} :</span>
              <select className="select" style={{ width: 'auto', padding: '4px 10px', fontSize: 11.5 }} value={me.presence} onChange={e => setPresence(e.target.value)}>
                {['online', 'away', 'busy', 'offline'].map(p => <option value={p} key={p}>{t(p)}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label className="field-label">{t('language')}</label>
            <select className="select" value={prefs.lang} onChange={e => setLang(e.target.value)}>
              {[['fr', 'Français'], ['en', 'English'], ['es', 'Español'], ['it', 'Italiano'], ['zh', '中文']].map(([k, lbl]) => <option value={k} key={k}>{lbl}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label className="field-label">{t('theme')}</label>
            <select className="select" value={prefs.theme} onChange={e => setTheme(e.target.value)}>
              <option value="light">☀️ {t('light')}</option>
              <option value="dark">🌙 {t('dark')}</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label className="field-label">{t('fontSize')}</label>
            <select className="select" value={prefs.fontSize || 'medium'} onChange={e => setFontSize(e.target.value)}>
              <option value="small">{t('fontSmall')}</option>
              <option value="medium">{t('fontMedium')}</option>
              <option value="large">{t('fontLarge')}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-label">{t('timezones')}</div>
        {db.timezones.map(z => (
          <div className="tz-row" key={z.id}>
            <span>{z.label}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="tz-time">{tzTime(z.tz)}</span>
              <span style={{ cursor: 'pointer', color: 'var(--muted)' }} onClick={() => removeTimezone(z.id)}>✕</span>
            </span>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <select className="select" style={{ flex: 1 }} value={tzChoice} onChange={e => setTzChoice(e.target.value)}>
            <option value="" disabled>—</option>
            {availableChoices.map(c => <option value={c.tz} key={c.tz}>{c.label}</option>)}
          </select>
          <button className="btn btn-ghost" onClick={addTimezone}>+ {t('addTimezone')}</button>
        </div>
      </div>

      {myProjects.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-label">{t('projectVisibility')}</div>
          <p style={{ fontSize: 11.5, color: 'var(--text-2)', margin: '0 0 10px' }}>{t('projectVisibilityHint')}</p>
          {myProjects.map(p => (
            <div className="tz-row" key={p.id}>
              <span>{p.name}</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 11.5, color: 'var(--text-2)' }}>
                <input type="checkbox" checked={!hiddenProjects.has(p.id)} onChange={() => toggleProjectVisibility(p.id)} />
                {hiddenProjects.has(p.id) ? t('privateProject') : t('publicProject')}
              </label>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="section-label">{t('changePassword')}</div>
        <label className="field-label">{t('currentPassword')}</label>
        <input className="input" type="password" value={pwCur} onChange={e => setPwCur(e.target.value)} />
        <label className="field-label">{t('newPassword')}</label>
        <input className="input" type="password" value={pwNew} onChange={e => setPwNew(e.target.value)} />
        <div className="modal-foot" style={{ marginTop: 14 }}>
          <button className="btn btn-primary" onClick={updatePassword}>{t('updatePassword')}</button>
        </div>
      </div>

      <div style={{ marginTop: 18, textAlign: 'right' }}>
        <button className="btn btn-danger" onClick={logout}>{t('logout')}</button>
      </div>
    </div>
  );
}
