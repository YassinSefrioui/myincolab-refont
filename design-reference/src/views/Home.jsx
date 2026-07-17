import Icon from '../components/Icon.jsx';
import TaskModal from './projects/TaskModal.jsx';
import { allCards, discussionUnreadTotal, member } from '../lib/helpers.js';
import { useApp } from '../state/AppContext.jsx';

export default function Home() {
  const { db, updateDB, user, go, setUi, openModal, logActivity, toast, t } = useApp();
  const me = user;
  const h = new Date().getHours();
  const greet = h < 12 ? t('greetingMorning') : h < 18 ? t('greetingAfternoon') : t('greetingEvening');
  const firstName = me.name.split(' ')[0];

  const openCards = db.projects.filter(p => !p.archived)
    .flatMap(p => allCards(p).filter(c => !c.done).map(c => ({ ...c, projectName: p.name, projectId: p.id })));
  const mine = openCards.filter(c => c.assignee === me.id);
  const myCards = mine.length ? mine : openCards.filter(c => c.due);
  const dueToday = myCards.filter(c => c.due && /aujourd|today|oggi|hoy/i.test(c.due)).length;
  const unread = discussionUnreadTotal(db);
  const eventsToday = db.events.filter(e => e.offset === 0).length;
  const nextEvt = db.events.slice().sort((a, b) => a.offset - b.offset)[0];

  function toggleTaskDone(cardId) {
    updateDB(draft => {
      for (const p of draft.projects) {
        for (const col of p.columns) {
          const card = col.cards.find(c => c.id === cardId);
          if (card) {
            card.done = !card.done;
            if (card.done) {
              const doneCol = p.columns.find(c => c.id === 'done');
              if (doneCol && col !== doneCol) {
                col.cards = col.cards.filter(c => c.id !== cardId);
                doneCol.cards.push(card);
              }
            }
            return;
          }
        }
      }
    });
    logActivity(`<b>${me.name.split(' ')[0]}</b> a terminé une tâche`);
    toast(t('taskUpdated'));
  }

  function openProjectFromHome(projectId) {
    setUi({ view: 'projects', projectDetail: projectId, activeProjectId: projectId });
  }

  return (
    <div className="view-anim">
      <h1 className="home-greeting">{greet}, {firstName}</h1>
      <p className="home-sub">{t('homeSub')}</p>

      <div className="stats-row">
        <div className="card stat-card" onClick={() => go('projects')}>
          <div className="stat-value">{dueToday}</div><div className="stat-label">{t('tasksDueToday')}</div>
        </div>
        <div className="card stat-card" onClick={() => go('messages')}>
          <div className="stat-value">{unread}</div><div className="stat-label">{t('unreadMessages')}</div>
        </div>
        <div className="card stat-card" onClick={() => go('calendar')}>
          <div className="stat-value">{eventsToday}</div><div className="stat-label">{t('meetingsToday')}</div>
        </div>
        <div className="card stat-card" onClick={() => go('projects')}>
          <div className="stat-value">{myCards.length}</div><div className="stat-label">{t('openIssues')}</div>
        </div>
      </div>

      <div className="home-cols">
        <div className="card home-left">
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{t('myTasks')}</div>
          {myCards.length ? myCards.slice(0, 6).map(c => (
            <div className="task-row" key={c.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span className={`task-check${c.done ? ' done' : ''}`} onClick={() => toggleTaskDone(c.id)}><Icon name="check" /></span>
                <span className="task-title" onClick={() => { openProjectFromHome(c.projectId); openModal(<TaskModal cardId={c.id} />, { wide: true }); }}>{c.title}</span>
              </div>
              <span className={`task-due${/aujourd|today|oggi|hoy/i.test(c.due || '') ? ' overdue' : ''}`}>{c.due || c.projectName}</span>
            </div>
          )) : <div className="empty-note">🎉 {t('noResults')}</div>}
        </div>
        <div className="home-right">
          <div className="card">
            <div className="section-label">{t('nextMeeting')}</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{nextEvt ? nextEvt.title : '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', margin: '3px 0 10px' }}>
              {nextEvt && (
                <>
                  {(nextEvt.offset === 0 ? t('today') : '+' + nextEvt.offset + ' j') + (nextEvt.time ? ' · ' + nextEvt.time : '')}
                  {' · ' + nextEvt.with.slice(0, 3).map(id => member(db, id).name.split(' ')[0]).join(', ') + (nextEvt.with.length > 3 ? ' +' + (nextEvt.with.length - 3) : '')}
                </>
              )}
            </div>
            <button className="btn btn-primary" onClick={() => go('meet')}>{t('join')}</button>
          </div>
          <div className="card">
            <div className="section-label">{t('recentActivity')}</div>
            {db.activity.slice(0, 5).map((a, i) => <div className="activity-row" key={i} dangerouslySetInnerHTML={{ __html: a }} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
