import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { TOUR_STEPS } from '../lib/tourSteps.js';
import { useApp } from '../state/AppContext.jsx';

const DONE_KEY = 'incolab-tutorial-v1';

const STEPS = [
  { key: 'home',          icon: 'home',     desc: 'tutHome' },
  { key: 'projects',      icon: 'boards',   desc: 'tutProjects' },
  { key: 'messages',      icon: 'messages', desc: 'tutMessages' },
  { key: 'meet',          icon: 'meet',     desc: 'tutMeet' },
  { key: 'files',         icon: 'files',    desc: 'tutFiles' },
  { key: 'calendar',      icon: 'calendar', desc: 'tutCalendar' },
  { key: 'groups',        icon: 'groups',   desc: 'tutGroups' },
  { key: 'announcements', icon: 'announce', desc: 'tutAnnouncements' },
  { key: 'profile',       icon: 'search',   desc: 'tutProfile' },
  { key: 'admin',         icon: 'admin',    desc: 'tutAdmin', adminOnly: true },
];

function loadDone() {
  try { return new Set(JSON.parse(localStorage.getItem(DONE_KEY) || '[]')); } catch { return new Set(); }
}

// Remet chaque page dans son état "de base" avant de démarrer sa visite, pour que
// les étapes ciblent toujours les mêmes éléments (ex. liste de projets plutôt qu'un détail resté ouvert).
const TOUR_RESETS = {
  projects: { projectDetail: null },
  admin: { adminTab: 'dashboard' },
  files: { filesFolder: 'root', filesTab: 'all' },
  calendar: { calCursor: new Date() },
};

export default function Tutorial() {
  const { user, go, setUi, startTour, t } = useApp();
  const [done, setDone] = useState(loadDone);

  const steps = STEPS.filter(s => !s.adminOnly || user.role === 'ADMIN');
  const pct = Math.round((steps.filter(s => done.has(s.key)).length / steps.length) * 100);

  function tryStep(s) {
    const next = new Set(done);
    next.add(s.key);
    setDone(next);
    try { localStorage.setItem(DONE_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
    if (TOUR_RESETS[s.key]) setUi(TOUR_RESETS[s.key]);
    go(s.key);
    if (TOUR_STEPS[s.key]) startTour(s.key);
  }

  function reset() {
    setDone(new Set());
    try { localStorage.removeItem(DONE_KEY); } catch { /* ignore */ }
  }

  return (
    <div className="view-anim">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>🎓 {t('tutorial')}</h1>
          <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: 0 }}>{t('tutorialSub')}</p>
        </div>
        {done.size > 0 && <button className="btn btn-ghost btn-sm" onClick={reset}>{t('tutReset')}</button>}
      </div>

      <div className="tut-progress"><i style={{ width: pct + '%' }} /></div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: pct === 100 ? 'var(--success)' : 'var(--text-2)', margin: '-12px 0 16px' }}>
        {pct === 100 ? '🎉 ' + t('tutAllDone') : pct + ' %'}
      </div>

      <div className="tut-grid">
        {steps.map(s => (
          <div className="card tut-card" key={s.key}>
            {done.has(s.key) && <span className="tut-done-badge"><Icon name="check" /></span>}
            <span className="tut-icon"><Icon name={s.icon} /></span>
            <div className="tut-card-title">
              {t(s.key)}
              {TOUR_STEPS[s.key] && <span className="tag-soft" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', marginLeft: 6, fontSize: 9.5 }}>{t('tourInteractive')}</span>}
            </div>
            <div className="tut-card-desc">{t(s.desc)}</div>
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => tryStep(s)}>
              {t('tutTry')} →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
