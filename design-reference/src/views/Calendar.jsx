import { useState } from 'react';
import Avatar from '../components/Avatar.jsx';
import { ModalHeader } from '../components/Modal.jsx';
import { member, nextId } from '../lib/helpers.js';
import { useApp } from '../state/AppContext.jsx';

const DOWS = {
  fr: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  es: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
  it: ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'],
};

function NewEventModal({ initialOffset = 0 }) {
  const { db, updateDB, user, closeModal, notify, toast, t } = useApp();
  const [title, setTitle] = useState('');
  const [offset, setOffset] = useState(initialOffset);
  const [time, setTime] = useState('10:00');
  const [allDay, setAllDay] = useState(false);
  const [members, setMembers] = useState([user.id]);

  function toggle(id) { setMembers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); }
  function create() {
    const trimmed = title.trim();
    if (!trimmed) return;
    updateDB(draft => {
      draft.events.push({ id: nextId(draft.events), title: trimmed, offset: Math.max(0, offset || 0), time: allDay ? '' : time, allDay, with: members });
    });
    notify(`${t('newEvent')} : <b>${trimmed}</b>`, 'calendar');
    closeModal();
    toast(t('createEvent') + ' ✓');
  }

  return (
    <>
      <ModalHeader title={t('newEvent')} />
      <label className="field-label">{t('eventTitle')}</label>
      <input className="input" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label className="field-label">{t('dueDate')} (jours à partir d'aujourd'hui)</label>
          <input className="input" type="number" min="0" value={offset} onChange={e => setOffset(parseInt(e.target.value, 10) || 0)} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="field-label">Heure</label>
          <input className="input" type="time" value={time} onChange={e => setTime(e.target.value)} />
        </div>
      </div>
      <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} /> {t('allDay')}
      </label>
      <label className="field-label">{t('members')}</label>
      <div className="member-chips">
        {db.team.map(m => (
          <label className="member-chip" style={{ cursor: 'pointer' }} key={m.id}>
            <input type="checkbox" checked={members.includes(m.id)} onChange={() => toggle(m.id)} /> <Avatar m={m} size="a20" /> {m.name}
          </label>
        ))}
      </div>
      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={closeModal}>{t('cancel')}</button>
        <button className="btn btn-primary" onClick={create}>{t('createEvent')}</button>
      </div>
    </>
  );
}

function EventDetailModal({ eventId }) {
  const { db, updateDB, closeModal, go, t } = useApp();
  const e = db.events.find(x => x.id === eventId);
  if (!e) return null;
  function del() {
    updateDB(draft => { draft.events = draft.events.filter(x => x.id !== eventId); });
    closeModal();
  }
  return (
    <>
      <ModalHeader title={e.title} />
      <div style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '8px 0' }}>
        {e.offset === 0 ? t('today') : '+' + e.offset + ' j'} {e.allDay ? '· ' + t('allDay') : (e.time ? '· ' + e.time : '')}
      </div>
      <div className="member-chips">
        {e.with.map(id => (
          <span className="member-chip" key={id}><Avatar m={member(db, id)} size="a20" /> {member(db, id).name}</span>
        ))}
      </div>
      <div className="modal-foot">
        <button className="btn btn-danger" onClick={del}>{t('delete')}</button>
        <button className="btn btn-primary" onClick={() => { closeModal(); go('meet'); }}>{t('join')}</button>
      </div>
    </>
  );
}

export default function Calendar() {
  const { db, prefs, ui, setUi, openModal, t } = useApp();
  const cur = ui.calCursor;
  const y = cur.getFullYear(), m = cur.getMonth();
  const today = new Date();
  const monthName = cur.toLocaleDateString(
    prefs.lang === 'en' ? 'en-US' : prefs.lang === 'es' ? 'es-ES' : prefs.lang === 'it' ? 'it-IT' : 'fr-FR',
    { month: 'long', year: 'numeric' }
  );

  const first = new Date(y, m, 1);
  let start = first.getDay() - 1;
  if (start < 0) start = 6;
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  function eventDate(evt) {
    const d = new Date(today);
    d.setDate(d.getDate() + evt.offset);
    return d;
  }
  function eventsOn(day) {
    return db.events.filter(e => {
      const d = eventDate(e);
      return d.getFullYear() === y && d.getMonth() === m && d.getDate() === day;
    });
  }

  function calMove(delta) { setUi({ calCursor: new Date(y, m + delta, 1) }); }
  function calToday() { setUi({ calCursor: new Date() }); }
  function openNewEventModal(day = null) {
    const initialOffset = day !== null ? Math.max(0, day - new Date().getDate()) : 0;
    openModal(<NewEventModal initialOffset={initialOffset} />);
  }
  function showEvent(id) { openModal(<EventDetailModal eventId={id} />); }

  const cells = [];
  (DOWS[prefs.lang] || DOWS.fr).forEach(d => cells.push(<div className="cal-dow" key={'dow-' + d}>{d}</div>));
  for (let i = 0; i < start; i++) cells.push(<div className="cal-cell other" key={'pad-' + i} />);
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === day;
    const evts = eventsOn(day);
    cells.push(
      <div className={`cal-cell${isToday ? ' today' : ''}`} key={'day-' + day} onClick={() => openNewEventModal(day)} title={t('newEvent')}>
        <div className="cal-daynum">{day}</div>
        {evts.map(e => (
          <div className="cal-event" key={e.id} onClick={ev => { ev.stopPropagation(); showEvent(e.id); }}>
            {e.allDay ? '◆ ' : (e.time ? e.time + ' ' : '')}{e.title}
          </div>
        ))}
      </div>
    );
  }

  const upcoming = db.events.slice().sort((a, b) => a.offset - b.offset).slice(0, 5);

  return (
    <div className="view-anim">
      <div className="cal-head">
        <h2 className="page-title" style={{ margin: 0 }}>{t('calendar')}</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => calMove(-1)}>←</button>
          <span className="cal-month">{monthName}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => calMove(1)}>→</button>
          <button className="btn btn-ghost btn-sm" onClick={calToday}>{t('today')}</button>
          <button className="btn btn-primary btn-sm" onClick={() => openNewEventModal()}>+ {t('newEvent')}</button>
        </div>
      </div>
      <div className="home-cols">
        <div style={{ flex: 2.5, minWidth: 340 }}><div className="cal-grid">{cells}</div></div>
        <div className="card" style={{ flex: 1, minWidth: 220 }}>
          <div className="section-label">{t('upcomingEvents')}</div>
          {upcoming.map(e => (
            <div className="task-row" style={{ cursor: 'pointer' }} key={e.id} onClick={() => showEvent(e.id)}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{e.title}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {e.offset === 0 ? t('today') : '+' + e.offset + ' j'}{e.allDay ? ' · ' + t('allDay') : (e.time ? ' · ' + e.time : '')}
                </div>
              </div>
              <span style={{ display: 'flex' }}>{e.with.slice(0, 3).map(id => <Avatar key={id} m={member(db, id)} size="a20" />)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
