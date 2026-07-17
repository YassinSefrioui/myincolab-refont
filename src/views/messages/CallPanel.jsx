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
export default function CallPanel({ convId, type, onEnd }) {
  const { db, user, toast, t } = useApp();
  const [connected, setConnected] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(type === 'video');
  const [fullscreen, setFullscreen] = useState(false);

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
    const joinTimer = setTimeout(() => setConnected(true), 1600);
    return () => clearTimeout(joinTimer);
  }, []);

  useEffect(() => {
    if (!connected) return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [connected]);

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
        <button className={`ctl-btn sm${micOn ? '' : ' off'}`} onClick={() => setMicOn(v => !v)} title={micOn ? t('micOn') : t('micOff')}>
          <Icon name={micOn ? 'mic' : 'micOff'} />
        </button>
        {type === 'video' && (
          <button className={`ctl-btn sm${camOn ? '' : ' off'}`} onClick={() => setCamOn(v => !v)} title={camOn ? t('camOn') : t('camOff')}>
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
