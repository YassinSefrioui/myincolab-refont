import { useEffect, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import Avatar from '../../components/Avatar.jsx';
import { member } from '../../lib/helpers.js';
import { useApp } from '../../state/AppContext.jsx';

function fmtElapsed(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/**
 * Appel audio / vidéo dans une conversation privée ou un chat de groupe.
 * type: 'audio' | 'video' — la caméra n'est proposée qu'en vidéo.
 */
export default function CallPanel({ convId, type, startedAt, onEnd }) {
  const { db, user, ui, setUi, toast, t } = useApp();
  const [now, setNow] = useState(Date.now());
  const [fullscreen, setFullscreen] = useState(false);
  const micOn = ui.micOn;
  const camOn = ui.camOn;

  const dm = db.dms.find(d => d.id === convId);
  const gc = db.groupChats.find(g => g.id === convId);
  const proj = db.projects.find(p => p.id === convId);
  const ids = dm
    ? [user.id, dm.user]
    : gc
      ? [...new Set([user.id, ...gc.members])]
      : proj
        ? [...new Set([user.id, ...proj.members])]
        : [user.id];

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const connected = now - startedAt > 1600;
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));

  function hangUp() {
    toast(t('callEnded'));
    onEnd();
  }

  return (
    <div className={`call-panel${type === 'video' ? ' video' : ''}${fullscreen ? ' call-panel-fullscreen' : ''}`}>
      <div className="call-status">
        <span className="call-type-icon"><Icon name={type === 'video' ? 'cam' : 'phone'} /></span>
        <span>{type === 'video' ? t('videoCall') : t('audioCall')}</span>
        {connected
          ? <span className="call-timer">⏱ {fmtElapsed(elapsed)}</span>
          : <span className="call-connecting">{t('calling')}</span>}
        <button
          className="call-fs-btn" onClick={() => setFullscreen(f => !f)}
          title={fullscreen ? t('exitFullscreen') : t('fullscreen')}
        >
          <Icon name={fullscreen ? 'collapse' : 'expand'} />
        </button>
      </div>

      <div className="call-tiles">
        {ids.map(id => {
          const m = member(db, id);
          const isMe = id === user.id;
          const showCam = type === 'video' && (isMe ? camOn : connected);
          return (
            <div className={`call-tile${type === 'video' ? ' video' : ''}${!isMe && !connected ? ' waiting' : ''}`} key={id}>
              <Avatar m={m} size={type === 'video' ? 'a52' : 'a30'} withPresence={type !== 'video'} />
              <span className="call-tile-name">
                {m.name}{isMe ? ` (${t('you')})` : ''}
                {isMe && !micOn && <span className="call-mic-off"><Icon name="micOff" /></span>}
              </span>
              {type === 'video' && !showCam && <span className="call-cam-off"><Icon name="camOff" /></span>}
            </div>
          );
        })}
      </div>

      <div className="call-controls">
        <button className={`ctl-btn sm${micOn ? '' : ' off'}`} onClick={() => setUi({ micOn: !micOn })} title={micOn ? t('micOn') : t('micOff')}>
          <Icon name={micOn ? 'mic' : 'micOff'} />
        </button>
        {type === 'video' && (
          <button className={`ctl-btn sm${camOn ? '' : ' off'}`} onClick={() => setUi({ camOn: !camOn })} title={camOn ? t('camOn') : t('camOff')}>
            <Icon name={camOn ? 'cam' : 'camOff'} />
          </button>
        )}
        <button className="ctl-btn sm leave" onClick={hangUp} title={t('leaveCall')}>
          <Icon name="leave" />
        </button>
      </div>
    </div>
  );
}
