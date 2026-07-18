import { allCards, convLabel, departmentName } from '../lib/helpers.js';
import { useApp } from '../state/AppContext.jsx';

export default function SearchPanel() {
  const { db, ui, setUi, go, t } = useApp();
  const q = ui.searchQuery;
  if (!q || !q.trim()) return null;
  const needle = q.trim().toLowerCase();
  const hits = [];

  db.projects.filter(p => !p.archived).forEach(p => {
    if (p.name.toLowerCase().includes(needle)) {
      hits.push({ type: '📋', text: p.name, run: () => { setUi({ activeProjectId: p.id, projectDetail: p.id }); go('projects'); } });
    }
    allCards(p).forEach(c => {
      if (c.title.toLowerCase().includes(needle)) {
        hits.push({ type: '☑️', text: c.title + ' · ' + p.name, run: () => { setUi({ activeProjectId: p.id, projectDetail: p.id, openTaskId: c.id }); go('projects'); } });
      }
    });
  });
  Object.entries(db.messagesByConv).forEach(([convId, msgs]) => {
    msgs.forEach(m => {
      if (m.text.toLowerCase().includes(needle)) {
        hits.push({ type: '💬', text: m.text.slice(0, 60) + ' · ' + convLabel(db, convId), run: () => { go('messages'); setUi({ activeConvId: convId, msgPane: 'chat' }); } });
      }
    });
  });
  db.files.forEach(f => {
    if (f.name.toLowerCase().includes(needle)) {
      hits.push({ type: '📄', text: f.name, run: () => { setUi({ filesFolder: f.folder, filesTab: 'all' }); go('files'); } });
    }
  });
  db.team.forEach(m => {
    if (m.name.toLowerCase().includes(needle)) hits.push({ type: '👤', text: m.name + ' · ' + (departmentName(db, m.departmentId) || m.role), run: () => go('groups') });
  });
  db.events.forEach(e => {
    if (e.title.toLowerCase().includes(needle)) hits.push({ type: '📅', text: e.title, run: () => go('calendar') });
  });

  return (
    <div className="search-panel" id="search-panel">
      <div className="section-label">{t('searchResults')} ({hits.length})</div>
      {hits.length ? hits.slice(0, 12).map((h, i) => (
        <div className="notif-row" key={i} onClick={() => { setUi({ searchQuery: '' }); h.run(); }}>
          <span>{h.type}</span><div>{h.text}</div>
        </div>
      )) : <div className="empty-note">{t('noResults')}</div>}
    </div>
  );
}
