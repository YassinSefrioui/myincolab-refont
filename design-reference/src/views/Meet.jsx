import Icon from '../components/Icon.jsx';
import { member } from '../lib/helpers.js';
import { useApp } from '../state/AppContext.jsx';

export default function Meet() {
  const { db, user, ui, setUi, go, toast, t } = useApp();
  const meeting = db.meeting;

  function toggleMic() { setUi({ micOn: !ui.micOn }); toast(!ui.micOn ? t('micOn') : t('micOff')); }
  function toggleCam() { setUi({ camOn: !ui.camOn }); toast(!ui.camOn ? t('camOn') : t('camOff')); }
  function leaveCall() { toast(t('leaveCall') + ' ✓'); go('home'); }
  function copyCallLink() {
    const link = 'https://myincolab.com/call/' + Math.random().toString(36).slice(2, 10);
    if (navigator.clipboard) navigator.clipboard.writeText(link);
    toast(t('copied'));
  }

  return (
    <div className="meet-view view-anim">
      <div className="chat-head">
        <div className="chat-title">{meeting.title}
          <span className="tag-soft" style={{ background: 'rgba(75,179,122,.15)', color: 'var(--success)', marginLeft: 8 }}>● {t('inCall')}</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={copyCallLink}>{t('copyCallLink')}</button>
      </div>
      <div className="meet-grid">
        {meeting.participants.map(pt => {
          const m = member(db, pt.id);
          const isMe = pt.id === user.id || pt.id === 'you';
          const camOn = isMe ? ui.camOn : pt.camOn;
          return (
            <div className={`meet-tile${pt.speaking ? ' speaking' : ''}`} key={pt.id}>
              {camOn ? (
                <span className="avatar a52" style={{ background: m.color }}>{m.initials}</span>
              ) : (
                <>
                  <span className="avatar a52" style={{ background: 'var(--muted)', opacity: .6 }}>{m.initials}</span>
                  <span className="cam-off-note"><Icon name="camOff" /></span>
                </>
              )}
              <span className="name-chip">
                {m.name}{isMe ? ' (vous)' : ''}
                {pt.speaking && <span className="speak-wave"><i /><i /><i /></span>}
                {isMe && !ui.micOn && <span style={{ color: 'var(--danger)', display: 'inline-flex', width: 11, height: 11 }}><Icon name="micOff" /></span>}
              </span>
            </div>
          );
        })}
      </div>
      <div className="meet-controls">
        <button className={`ctl-btn${ui.micOn ? '' : ' off'}`} onClick={toggleMic} title={ui.micOn ? t('micOn') : t('micOff')}>
          <Icon name={ui.micOn ? 'mic' : 'micOff'} />
        </button>
        <button className={`ctl-btn${ui.camOn ? '' : ' off'}`} onClick={toggleCam} title={ui.camOn ? t('camOn') : t('camOff')}>
          <Icon name={ui.camOn ? 'cam' : 'camOff'} />
        </button>
        <button className="ctl-btn leave" onClick={leaveCall} title={t('leaveCall')}>
          <Icon name="leave" />
        </button>
      </div>
    </div>
  );
}
