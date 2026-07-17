import { useEffect, useRef, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import NewProjectModal from './NewProjectModal.jsx';
import { projectDone, projectOverdueCount, visibleProjectsFor } from '../../lib/helpers.js';
import { useApp } from '../../state/AppContext.jsx';

function statusOf(p) {
  if (p.archived) return 'ARCHIVED';
  if (projectOverdueCount(p) > 0) return 'OVERDUE';
  if (projectDone(p)) return 'COMPLETED';
  return 'ACTIVE';
}

export default function ProjectSwitcher({ activeId, onSwitch }) {
  const { db, user, openModal, t } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const active = db.projects.find(p => p.id === activeId);
  const options = visibleProjectsFor(db, user).filter(p => !p.archived || p.id === activeId);

  useEffect(() => {
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  return (
    <div className="proj-switcher" ref={ref}>
      <button className={`proj-switcher-btn${open ? ' open' : ''}`} onClick={() => setOpen(o => !o)} title={t('switchProject')}>
        {active ? active.name : t('projects')}
        <Icon name="chevron" />
      </button>
      {open && (
        <div className="proj-switcher-menu">
          {options.map(p => (
            <div
              key={p.id}
              className={`proj-switcher-item${p.id === activeId ? ' active' : ''}`}
              onClick={() => { onSwitch(p.id); setOpen(false); }}
            >
              <span>{p.name}</span>
              <span className={`status-pill ${statusOf(p)}`} style={{ fontSize: 8.5 }}>{statusOf(p)}</span>
            </div>
          ))}
          <div className="proj-switcher-sep" />
          <div className="proj-switcher-new" onClick={() => { setOpen(false); openModal(<NewProjectModal onCreated={onSwitch} />, { wide: true }); }}>
            <Icon name="plus" style={{ width: 12, height: 12 }} /> {t('newProjectShort')}
          </div>
        </div>
      )}
    </div>
  );
}
