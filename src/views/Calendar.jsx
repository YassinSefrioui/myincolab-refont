import { useState } from 'react';
import Avatar from '../components/Avatar.jsx';
import DueTag from '../components/DueTag.jsx';
import { ModalHeader } from '../components/Modal.jsx';
import MemberPicker from '../components/MemberPicker.jsx';
import DatePicker from '../components/DatePicker.jsx';
import TimePicker from '../components/TimePicker.jsx';
import { DOW_LABELS, daysLeft, member, nextId, toISODate } from '../lib/helpers.js';
import { useApp } from '../state/AppContext.jsx';

function isoFromOffset(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function NewEventModal({ initialOffset = 0, eventId = null, title: modalTitle }) {
  const { db, updateDB, user, closeModal, notify, toast, setUi, t } = useApp();
  const existing = eventId ? db.events.find(x => x.id === eventId) : null;
  const isHost = !existing || existing.hostId === user.id;
  const [title, setTitle] = useState(existing ? existing.title : '');
  const [description, setDescription] = useState(existing ? (existing.description || '') : '');
  const [offset, setOffset] = useState(existing ? existing.offset : initialOffset);
  const [time, setTime] = useState(existing ? (existing.time || '10:00') : '10:00');
  const [allDay, setAllDay] = useState(existing ? existing.allDay : false);
  const [members, setMembers] = useState(existing ? existing.with.filter(id => id !== user.id) : []);
  const [hostId, setHostId] = useState(existing ? existing.hostId : user.id);

  if (eventId && !existing) return null;

  function joinNow() { closeModal(); setUi({ view: 'meet', joinEventId: eventId }); }

  if (eventId && !isHost) {
    const host = member(db, existing.hostId);
    return (
      <>
        <ModalHeader title={existing.title} />
        <div style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '8px 0' }}>
          {existing.offset === 0 ? t('today') : '+' + existing.offset + ' j'} {existing.allDay ? '· ' + t('allDay') : (existing.time ? '· ' + existing.time : '')}
        </div>
        {existing.description && <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '0 0 12px' }}>{existing.description}</p>}
        <div className="member-chips">
          {existing.with.map(id => (
            <span className="member-chip" key={id}><Avatar m={member(db, id)} size="a20" /> {member(db, id).name}</span>
          ))}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 10 }}>
          {t('hostedBy')} : <Avatar m={host} size="a20" /> {host.name}
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={closeModal}>{t('close')}</button>
          <button className="btn btn-primary" onClick={joinNow}>{t('join')}</button>
        </div>
      </>
    );
  }

  const hostCandidates = [user, ...members.map(id => db.team.find(m => m.id === id))].filter(Boolean);

  function save() {
    const trimmed = title.trim();
    if (!trimmed) return;
    const finalHost = (hostId === user.id || members.includes(hostId)) ? hostId : user.id;
    const payload = {
      title: trimmed, description: description.trim(),
      offset: Math.max(0, offset || 0), time: allDay ? '' : time, allDay,
      with: [...new Set([user.id, ...members])], hostId: finalHost,
    };
    updateDB(draft => {
      if (eventId) {
        const ev = draft.events.find(x => x.id === eventId);
        if (ev) Object.assign(ev, payload);
      } else {
        draft.events.push({ id: nextId(draft.events), ...payload });
      }
    });
    closeModal();
    if (eventId) {
      toast(t('eventUpdated'));
    } else {
      notify(`${t('newEvent')} : <b>${trimmed}</b>`, 'calendar');
      toast(t('createEvent') + ' ✓');
    }
  }
  function del() {
    updateDB(draft => { draft.events = draft.events.filter(x => x.id !== eventId); });
    closeModal();
    toast(t('eventDeleted'));
  }

  return (
    <>
      <ModalHeader title={modalTitle || (eventId ? t('editEvent') : t('newEvent'))} />
      <label className="field-label">{t('eventTitle')}</label>
      <input className="input" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
      <label className="field-label">{t('description')}</label>
      <textarea className="textarea" value={description} onChange={e => setDescription(e.target.value)} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label className="field-label">
            {t('dueDate')} <DueTag due={isoFromOffset(offset)} compact />
          </label>
          <DatePicker
            value={isoFromOffset(offset)} min={isoFromOffset(0)}
            onChange={iso => { const n = daysLeft(iso); if (n !== null) setOffset(Math.max(0, n)); }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="field-label">Heure</label>
          <TimePicker value={time} onChange={setTime} />
        </div>
      </div>
      <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} /> {t('allDay')}
      </label>
      <label className="field-label">{t('invitePeople')}</label>
      <MemberPicker candidates={db.team.filter(m => m.id !== user.id && !m.locked)} selected={members} onChange={setMembers} />
      <label className="field-label">{t('host')}</label>
      <MemberPicker candidates={hostCandidates} selected={hostId} onChange={id => setHostId(id || user.id)} multi={false} placeholder={t('host')} />
      <p style={{ fontSize: 11, color: 'var(--muted)', margin: '2px 0 0' }}>{t('hostHint')}</p>
      <div className="modal-foot">
        {eventId && <button className="btn btn-danger" onClick={del}>{t('delete')}</button>}
        {eventId && <button className="btn btn-ghost" onClick={joinNow}>{t('join')}</button>}
        {!eventId && <button className="btn btn-ghost" onClick={closeModal}>{t('cancel')}</button>}
        <button className="btn btn-primary" onClick={save}>{eventId ? t('save') : t('createEvent')}</button>
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
  function showEvent(id) { openModal(<NewEventModal eventId={id} />, { wide: true }); }

  const cells = [];
  (DOW_LABELS[prefs.lang] || DOW_LABELS.fr).forEach(d => cells.push(<div className="cal-dow" key={'dow-' + d}>{d}</div>));
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
