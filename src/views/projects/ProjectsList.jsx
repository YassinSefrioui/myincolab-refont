import { useMemo, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import Avatar from '../../components/Avatar.jsx';
import NewProjectModal from './NewProjectModal.jsx';
import ProjectMenu from './ProjectMenu.jsx';
import { allCards, member, projectDone, projectProgress, projectOverdueCount, visibleProjectsFor } from '../../lib/helpers.js';
import { useApp } from '../../state/AppContext.jsx';

function statusOf(p) {
  if (p.archived) return 'ARCHIVED';
  if (p.completed || projectDone(p)) return 'COMPLETED';
  if (projectOverdueCount(p) > 0) return 'OVERDUE';
  return 'ACTIVE';
}

export default function ProjectsList({ onOpenProject }) {
  const { db, user, openModal, ui, setUi, t } = useApp();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('name');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const projects = visibleProjectsFor(db, user);
  const withStatus = useMemo(() => projects.map(p => ({ p, status: statusOf(p) })), [projects]);

  const counts = useMemo(() => ({
    active: withStatus.filter(x => x.status === 'ACTIVE').length,
    overdue: withStatus.filter(x => x.status === 'OVERDUE').length,
    completed: withStatus.filter(x => x.status === 'COMPLETED').length,
    archived: withStatus.filter(x => x.status === 'ARCHIVED').length,
    all: withStatus.length,
  }), [withStatus]);

  const tabs = [
    ['active', t('active'), counts.active],
    ['overdue', t('overdue'), counts.overdue],
    ['completed', t('completed'), counts.completed],
    ['archived', t('archived'), counts.archived],
    ['all', t('all'), counts.all],
  ];

  let filtered = withStatus.filter(x => ui.projectsTab === 'all' ? true : x.status === ui.projectsTab.toUpperCase());
  if (query.trim()) {
    const needle = query.trim().toLowerCase();
    filtered = filtered.filter(({ p }) => p.name.toLowerCase().includes(needle) || (p.description || '').toLowerCase().includes(needle));
  }
  filtered = filtered.slice().sort((a, b) => {
    if (sort === 'progress') return projectProgress(b.p) - projectProgress(a.p);
    if (sort === 'members') return b.p.members.length - a.p.members.length;
    return a.p.name.localeCompare(b.p.name);
  });

  function openNewProjectModal() {
    openModal(<NewProjectModal onCreated={id => onOpenProject(id)} />, { wide: true });
  }

  return (
    <div className="view-anim">
      <div className="proj-head">
        <div>
          <div className="proj-head-title">
            <Icon name="boards" />
            {t('projects')}
          </div>
          <div className="proj-head-sub">
            {counts.active} {t('activeProjectsCount')} · {counts.overdue} {t('overdueCount')}
          </div>
        </div>
        <button className="btn btn-primary" onClick={openNewProjectModal}>
          <Icon name="plus" style={{ width: 13, height: 13 }} /> {t('newProjectShort')}
        </button>
      </div>

      <div className="proj-tabs">
        {tabs.map(([key, label, count]) => (
          <button key={key} className={`proj-tab${ui.projectsTab === key ? ' active' : ''}`} onClick={() => setUi({ projectsTab: key })}>
            {label} <span className="count">{count}</span>
          </button>
        ))}
      </div>

      <div className="proj-toolbar">
        <div className="proj-search">
          <Icon name="search" />
          <input placeholder={t('searchProjects')} value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <div style={{ position: 'relative' }}>
          <button className="btn btn-ghost" onClick={() => setFiltersOpen(o => !o)}>
            <Icon name="filter" style={{ width: 13, height: 13 }} /> {t('filters')}
          </button>
          {filtersOpen && (
            <div className="proj-switcher-menu" style={{ right: 0, left: 'auto' }} onMouseLeave={() => setFiltersOpen(false)}>
              {[['name', t('projectName')], ['progress', t('progress')], ['members', t('members')]].map(([k, lbl]) => (
                <div key={k} className={`proj-switcher-item${sort === k ? ' active' : ''}`} onClick={() => { setSort(k); setFiltersOpen(false); }}>
                  {lbl}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="proj-count-line">{filtered.length} / {counts.all} {t('projects').toLowerCase()}</div>

      {filtered.length ? (
        <div className="proj-grid">
          {filtered.map(({ p, status }) => {
            const cards = allCards(p);
            return (
              <div className="card proj-card" key={p.id} onClick={() => onOpenProject(p.id)}>
                <div className="proj-card-top">
                  <span className="proj-card-icon"><Icon name="boards" /></span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className={`status-pill ${status}`}>{t(status === 'ACTIVE' ? 'active' : status === 'COMPLETED' ? 'completed' : status === 'OVERDUE' ? 'overdue' : 'archived').toUpperCase()}</span>
                    <ProjectMenu projectId={p.id} />
                  </span>
                </div>
                <div className="proj-card-name">{p.name}</div>
                <div className="proj-card-desc">{p.description || '—'}</div>
                <div className="proj-card-foot">
                  <span className="avatar-stack">
                    {p.members.slice(0, 4).map(id => <Avatar key={id} m={member(db, id)} size="a20" />)}
                  </span>
                  <span className="member-count-chip">
                    <Icon name="groups" /> {p.members.length}
                  </span>
                  {cards.length > 0 && (
                    <span className="proj-card-due">
                      <Icon name="calendar" /> {cards.filter(c => c.done).length}/{cards.length}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          <div className="card proj-card new-tile" onClick={openNewProjectModal}>
            <span className="link-accent">+ {t('newProjectShort')}</span>
          </div>
        </div>
      ) : (
        <div className="empty-note">{t('noProjects')}</div>
      )}
    </div>
  );
}
