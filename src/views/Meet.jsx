import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import Avatar from '../components/Avatar.jsx';
import { ModalHeader } from '../components/Modal.jsx';
import MemberPicker from '../components/MemberPicker.jsx';
import { NewEventModal } from './Calendar.jsx';
import { hasGuestExecute, member } from '../lib/helpers.js';
import { useApp } from '../state/AppContext.jsx';

function fmtElapsed(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function MeetLobby({ db, user, onJoinEvent, onInstant, onSchedule, onEdit, t }) {
  const upcoming = db.events.slice().sort((a, b) => a.offset - b.offset).slice(0, 8);
  const canMeet = hasGuestExecute(user, 'meet');
  return (
    <div className="view-anim">
      <div className="boards-head">
        <h2 className="page-title" style={{ margin: 0 }}>{t('meet')}</h2>
        {canMeet && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={onSchedule}>+ {t('scheduleMeeting')}</button>
            <button className="btn btn-primary btn-sm" onClick={onInstant}>+ {t('startInstantMeeting')}</button>
          </div>
        )}
      </div>
      <div className="card">
        <div className="section-label">{t('upcomingMeetings')}</div>
        {upcoming.length ? upcoming.map(e => {
          const isHost = e.hostIds.includes(user.id);
          const hostNames = e.hostIds.map(id => (id === user.id ? t('you') : member(db, id).name)).join(', ');
          return (
            <div className="task-row" key={e.id}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{e.title}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {(e.offset === 0 ? t('today') : '+' + e.offset + ' j') + (e.allDay ? ' · ' + t('allDay') : (e.time ? ' · ' + e.time : ''))}
                  {' · ' + t('hostedBy') + ' ' + hostNames}
                </div>
                {e.description && <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 2 }}>{e.description}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ display: 'flex', marginRight: 4 }}>{e.with.slice(0, 4).map(id => <Avatar key={id} m={member(db, id)} size="a20" />)}</span>
                {isHost && (
                  <button className="btn btn-ghost btn-sm" title={t('editEvent')} onClick={() => onEdit(e.id)}><Icon name="edit" style={{ width: 12, height: 12 }} /></button>
                )}
                {canMeet && <button className="btn btn-ghost btn-sm" onClick={() => onJoinEvent(e)}>{t('join')}</button>}
              </div>
            </div>
          );
        }) : <div className="empty-note">{t('noUpcomingMeetings')}</div>}
      </div>
    </div>
  );
}

function NewInstantMeetingModal({ onStart }) {
  const { db, user, closeModal, t } = useApp();
  const [members, setMembers] = useState([]);
  const candidates = db.team.filter(m => m.id !== user.id && !m.locked);

  function start() {
    onStart(members);
    closeModal();
  }

  return (
    <>
      <ModalHeader title={t('startInstantMeeting')} />
      <label className="field-label">{t('members')}</label>
      <MemberPicker candidates={candidates} selected={members} onChange={setMembers} autoFocus />
      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={closeModal}>{t('cancel')}</button>
        <button className="btn btn-primary" onClick={start}>{t('startInstantMeeting')}</button>
      </div>
    </>
  );
}

function ActiveCallView({ call, onLeave }) {
  const { db, user, ui, setUi, toast, t } = useApp();

  const [elapsed, setElapsed] = useState(0);
  const [speakingId, setSpeakingId] = useState(null);
  const [shareOn, setShareOn] = useState(false);
  const [extras, setExtras] = useState([]);

  const everyone = [...call.participants, ...extras];

  useEffect(() => {
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Rotation de parole simulée (quelqu'un d'autre prend la parole toutes les ~3,5s)
  useEffect(() => {
    const id = setInterval(() => {
      const pool = everyone.map(p => p.id).filter(x => x !== user.id && x !== 'you');
      if (!pool.length) return;
      setSpeakingId(Math.random() < 0.2 ? null : pool[Math.floor(Math.random() * pool.length)]);
    }, 3500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extras.length, user.id]);

  // Un collègue rejoint la réunion en cours de route
  useEffect(() => {
    const present = new Set(call.participants.map(p => p.id));
    present.add(user.id); present.add('you');
    const candidates = db.team.filter(m => !present.has(m.id) && !m.locked);
    if (!candidates.length) return;
    const timer = setTimeout(() => {
      const joiner = candidates[0];
      setExtras(prev => prev.some(x => x.id === joiner.id) ? prev : [...prev, { id: joiner.id, camOn: Math.random() > 0.5 }]);
      toast(`${joiner.name} ${t('joinedCall')}`);
    }, 7000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleMic() { setUi({ micOn: !ui.micOn }); toast(!ui.micOn ? t('micOn') : t('micOff')); }
  function toggleCam() { setUi({ camOn: !ui.camOn }); toast(!ui.camOn ? t('camOn') : t('camOff')); }
  function toggleShare() {
    setShareOn(s => !s);
    toast(!shareOn ? t('presenting') : t('stopShare') + ' ✓');
  }
  function leaveCall() { toast(t('leaveCall') + ' ✓'); onLeave(); }
  function copyCallLink() {
    const link = 'https://myincolab.com/call/' + Math.random().toString(36).slice(2, 10);
    if (navigator.clipboard) navigator.clipboard.writeText(link);
    toast(t('copied'));
  }

  function renderTile(pt, small = false) {
    const m = member(db, pt.id);
    const isMe = pt.id === user.id || pt.id === 'you';
    const camOn = isMe ? ui.camOn : pt.camOn;
    const speaking = !isMe && speakingId === pt.id;
    return (
      <div className={`meet-tile${speaking ? ' speaking' : ''}${small ? ' small' : ''}`} key={pt.id}>
        {camOn ? (
          <span className={`avatar ${small ? 'a30' : 'a52'}`} style={{ background: m.color }}>{m.initials}</span>
        ) : (
          <>
            <span className={`avatar ${small ? 'a30' : 'a52'}`} style={{ background: 'var(--muted)', opacity: .6 }}>{m.initials}</span>
            <span className="cam-off-note"><Icon name="camOff" /></span>
          </>
        )}
        <span className="name-chip">
          {m.name}{isMe ? ' (vous)' : ''}
          {speaking && <span className="speak-wave"><i /><i /><i /></span>}
          {isMe && !ui.micOn && <span style={{ color: 'var(--danger)', display: 'inline-flex', width: 11, height: 11 }}><Icon name="micOff" /></span>}
        </span>
      </div>
    );
  }

  return (
    <div className="meet-view view-anim">
      <div className="chat-head">
        <div className="chat-title">{call.title}
          <span className="tag-soft" style={{ background: 'rgba(75,179,122,.15)', color: 'var(--success)', marginLeft: 8 }}>● {t('inCall')}</span>
          <span className="meet-timer-chip">⏱ {fmtElapsed(elapsed)}</span>
          <span className="meet-count-chip"><Icon name="groups" /> {everyone.length}</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={copyCallLink}>{t('copyCallLink')}</button>
      </div>

      <div className="meet-body">
        {shareOn ? (
          <div className="meet-stage">
            <div className="share-tile">
              <div className="win-bar"><i className="win-dot r" /><i className="win-dot y" /><i className="win-dot g" /><span className="win-title">pricing-deck.pdf</span></div>
              <div className="share-lines">
                <div className="share-line" style={{ width: '42%' }} />
                <div className="share-line" style={{ width: '86%' }} />
                <div className="share-line" style={{ width: '73%' }} />
                <div className="share-line" style={{ width: '90%', animationDelay: '.3s' }} />
                <div className="share-line" style={{ width: '58%', animationDelay: '.5s' }} />
                <div className="share-blocks">
                  <div className="share-block" /><div className="share-block" /><div className="share-block" />
                </div>
              </div>
              <span className="presenting-chip">{t('presenting')}</span>
              <span className="share-cursor" />
            </div>
            <div className="meet-strip">
              {everyone.map(pt => renderTile(pt, true))}
            </div>
          </div>
        ) : (
          <div className="meet-grid">
            {everyone.map(pt => renderTile(pt))}
          </div>
        )}
      </div>

      <div className="meet-controls">
        <button className={`ctl-btn${ui.micOn ? '' : ' off'}`} onClick={toggleMic} title={ui.micOn ? t('micOn') : t('micOff')}>
          <Icon name={ui.micOn ? 'mic' : 'micOff'} />
        </button>
        <button className={`ctl-btn${ui.camOn ? '' : ' off'}`} onClick={toggleCam} title={ui.camOn ? t('camOn') : t('camOff')}>
          <Icon name={ui.camOn ? 'cam' : 'camOff'} />
        </button>
        <button className={`ctl-btn${shareOn ? ' active' : ''}`} onClick={toggleShare} title={shareOn ? t('stopShare') : t('shareScreen')}>
          <Icon name="screen" />
        </button>
        <span className="meet-sep" />
        <button className="ctl-btn leave" onClick={leaveCall} title={t('leaveCall')}>
          <Icon name="leave" />
        </button>
      </div>
    </div>
  );
}

export default function Meet() {
  const { db, user, ui, setUi, openModal, t } = useApp();
  const [activeCall, setActiveCall] = useState(null);

  function startCallFromEvent(e) {
    const participants = [...new Set([user.id, ...e.with])].map(id => ({ id, camOn: true, speaking: false }));
    setActiveCall({ title: e.title, participants });
  }
  function startInstantMeeting(memberIds = []) {
    const participants = [...new Set([user.id, ...memberIds])].map(id => ({ id, camOn: true, speaking: false }));
    setActiveCall({ title: t('instantMeeting'), participants });
  }
  function openInstantMeetingModal() {
    openModal(<NewInstantMeetingModal onStart={startInstantMeeting} />, { wide: true });
  }
  function openScheduleModal() {
    openModal(<NewEventModal title={t('scheduleMeeting')} />, { wide: true });
  }
  function openEditModal(eventId) {
    openModal(<NewEventModal eventId={eventId} />, { wide: true });
  }

  useEffect(() => {
    if (!ui.joinEventId) return;
    const e = db.events.find(x => x.id === ui.joinEventId);
    setUi({ joinEventId: null });
    if (e) startCallFromEvent(e);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.joinEventId]);

  if (activeCall) {
    return <ActiveCallView call={activeCall} onLeave={() => setActiveCall(null)} />;
  }
  return <MeetLobby db={db} user={user} onJoinEvent={startCallFromEvent} onInstant={openInstantMeetingModal} onSchedule={openScheduleModal} onEdit={openEditModal} t={t} />;
}
