import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import Avatar from '../components/Avatar.jsx';
import DueTag from '../components/DueTag.jsx';
import WorldClock from '../components/WorldClock.jsx';
import MemberProfileModal from '../components/MemberProfileModal.jsx';
import TaskModal from './projects/TaskModal.jsx';
import { allCards, daysLeft, discussionUnreadTotal, member, recentDecisions, taskCountByMember } from '../lib/helpers.js';
import { useApp } from '../state/AppContext.jsx';

const WIDGET_KEYS = ['myTasks', 'nextMeeting', 'clocks', 'online', 'workload', 'decisions', 'activity'];
const TASK_LIMIT_OPTIONS = [3, 6, 10];

function CustomizeMenu({ widgets, onToggle, tasksLimit, onTasksLimit, t }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <span className="proj-menu-wrap" ref={wrapRef}>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(o => !o)}>{t('customizeHome')}</button>
      {open && (
        <div className="proj-menu" style={{ minWidth: 220 }}>
          {WIDGET_KEYS.map(key => (
            <label className="proj-menu-item" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }} key={key}>
              <input type="checkbox" checked={widgets[key] !== false} onChange={() => onToggle(key)} />
              {t('widget_' + key)}
            </label>
          ))}
          <div className="proj-menu-sep" />
          <div style={{ padding: '6px 10px 4px', fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>{t('tasksShown')}</div>
          <div style={{ display: 'flex', gap: 4, padding: '2px 8px 6px' }}>
            {TASK_LIMIT_OPTIONS.map(n => (
              <button
                key={n}
                className={`tab${tasksLimit === n ? ' active' : ''}`}
                style={{ flex: 1, padding: '4px 0', fontSize: 11.5 }}
                onClick={() => onTasksLimit(n)}
              >{n}</button>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}

export default function Home() {
  const { db, updateDB, user, prefs, toggleHomeWidget, setHomeTasksLimit, go, setUi, openModal, logActivity, toast, t } = useApp();
  const me = user;
  const h = new Date().getHours();
  const greet = h < 12 ? t('greetingMorning') : h < 18 ? t('greetingAfternoon') : t('greetingEvening');
  const firstName = me.name.split(' ')[0];
  const widgets = prefs.homeWidgets || {};
  const tasksLimit = prefs.homeTasksLimit || 6;
  const [completingIds, setCompletingIds] = useState(() => new Set());
  const completingTimers = useRef({});

  useEffect(() => () => { Object.values(completingTimers.current).forEach(clearTimeout); }, []);

  const openCards = db.projects.filter(p => !p.archived)
    .flatMap(p => allCards(p).filter(c => !c.done).map(c => ({ ...c, projectName: p.name, projectId: p.id })));
  const mine = openCards.filter(c => c.assignee === me.id);
  const myCards = mine.length ? mine : openCards.filter(c => c.due);
  const dueToday = myCards.filter(c => {
    const n = daysLeft(c.due);
    return n !== null && n <= 0;
  }).length;
  const unread = discussionUnreadTotal(db);
  const eventsToday = db.events.filter(e => e.offset === 0).length;
  const nextEvt = db.events.slice().sort((a, b) => a.offset - b.offset)[0];

  const onlineNow = db.team.filter(m => !m.locked && m.presence === 'online' && m.id !== me.id);
  const workload = taskCountByMember(db).filter(w => w.count > 0).slice(0, 5);
  const decisions = recentDecisions(db, 4);

  function completeTask(cardId) {
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

  function toggleTaskDone(cardId) {
    if (completingIds.has(cardId)) return;
    setCompletingIds(prev => new Set(prev).add(cardId));
    completingTimers.current[cardId] = setTimeout(() => {
      completeTask(cardId);
      setCompletingIds(prev => { const next = new Set(prev); next.delete(cardId); return next; });
      delete completingTimers.current[cardId];
    }, 700);
  }

  function openProjectFromHome(projectId) {
    setUi({ view: 'projects', projectDetail: projectId, activeProjectId: projectId });
  }

  return (
    <div className="view-anim">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div data-tour="home-greeting">
          <h1 className="home-greeting">{greet}, {firstName}</h1>
          <p className="home-sub">{t('homeSub')}</p>
        </div>
        <div data-tour="home-customize">
          <CustomizeMenu widgets={widgets} onToggle={toggleHomeWidget} tasksLimit={tasksLimit} onTasksLimit={setHomeTasksLimit} t={t} />
        </div>
      </div>

      <div className="stats-row" data-tour="home-stats">
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
        <div className="card home-left" data-tour="home-tasks">
          {widgets.myTasks !== false && (
          <>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{t('myTasks')}</div>
          {myCards.length ? myCards.slice(0, tasksLimit).map(c => {
            const isCompleting = completingIds.has(c.id);
            return (
              <div className={`task-row${isCompleting ? ' completing' : ''}`} key={c.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span
                    className={`task-check${c.done ? ' done' : ''}${isCompleting ? ' completing' : ''}`}
                    onClick={() => toggleTaskDone(c.id)}
                  ><Icon name="check" /></span>
                  <span className="task-title" onClick={() => { openProjectFromHome(c.projectId); openModal(<TaskModal cardId={c.id} />, { wide: true }); }}>{c.title}</span>
                </div>
                {c.due
                  ? <DueTag due={c.due} />
                  : <span className="task-due">{c.projectName}</span>}
              </div>
            );
          }) : <div className="empty-note">🎉 {t('noResults')}</div>}
          </>
          )}

          {widgets.decisions !== false && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{t('recentDecisions')}</div>
              {decisions.length ? decisions.map(d => (
                <div className="activity-row" key={d.id} style={{ cursor: 'pointer' }} onClick={() => openProjectFromHome(d.projectId)}>
                  <span>{d.text} — <b>{d.projectName}</b></span>
                </div>
              )) : <div className="empty-note">{t('noDecisions')}</div>}
            </div>
          )}
        </div>
        <div className="home-right">
          {widgets.nextMeeting !== false && (
          <div className="card" data-tour="home-next-meeting">
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
            <button
              className="btn btn-primary"
              onClick={() => setUi({ view: 'meet', joinEventId: nextEvt ? nextEvt.id : null })}
              disabled={!nextEvt}
            >{t('join')}</button>
          </div>
          )}

          {widgets.online !== false && (
            <div className="card">
              <div className="section-label">{t('onlineNow')}</div>
              {onlineNow.length ? onlineNow.map(m => (
                <div className="task-row" key={m.id} style={{ cursor: 'pointer' }} onClick={() => openModal(<MemberProfileModal memberId={m.id} />)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar m={m} size="a20" withPresence clickable={false} />
                    <span style={{ fontSize: 12.5 }}>{m.name}</span>
                  </div>
                </div>
              )) : <div className="empty-note">{t('noOneOnline')}</div>}
            </div>
          )}

          {widgets.workload !== false && (
            <div className="card">
              <div className="section-label">{t('workloadByMember')}</div>
              {workload.length ? workload.map(w => {
                const m = member(db, w.id);
                const max = workload[0].count || 1;
                return (
                  <div key={w.id} style={{ padding: '6px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 3 }}>
                      <span>{m.name}</span><span style={{ color: 'var(--muted)' }}>{w.count}</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: (w.count / max * 100) + '%', borderRadius: 4, background: 'var(--accent)' }} />
                    </div>
                  </div>
                );
              }) : <div className="empty-note">{t('noResults')}</div>}
            </div>
          )}

          {widgets.clocks !== false && <WorldClock />}

          {widgets.activity !== false && (
            <div className="card">
              <div className="section-label">{t('recentActivity')}</div>
              {db.activity.slice(0, 5).map((a, i) => <div className="activity-row" key={i} dangerouslySetInnerHTML={{ __html: a }} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
