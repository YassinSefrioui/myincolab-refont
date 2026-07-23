import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { convLabel } from '../lib/helpers.js';
import { useApp } from '../state/AppContext.jsx';

function fmtElapsed(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function initialsOf(label) {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

// Pastille d'appel flottante affichée tant qu'on est ailleurs que sur l'appel en
// cours — verre dépoli + halo dégradé assortis au reste de l'app plutôt qu'un
// clone de la Dynamic Island.
function IslandPill({
  icon, label, startedAt, onReturn, onEnd, returnTitle, endTitle,
  micOn, onToggleMic, micOnTitle, micOffTitle,
  showCam, camOn, onToggleCam, camOnTitle, camOffTitle,
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const initials = initialsOf(label);

  return (
    <div className="call-island">
      <div className="call-island-main" onClick={onReturn} title={returnTitle}>
        <span className="call-island-avatar">
          {initials}
          <span className="call-island-live-ring" />
        </span>
        <span className="call-island-body">
          <span className="call-island-label">{label}</span>
          <span className="call-island-meta">
            <span className="call-island-dot" />
            {fmtElapsed(elapsed)}
          </span>
        </span>
        <span className="call-island-type-icon"><Icon name={icon} /></span>
      </div>
      <div className="call-island-controls">
        <button
          className={`call-island-ctl${micOn ? '' : ' off'}`}
          onClick={onToggleMic}
          title={micOn ? micOnTitle : micOffTitle}
        >
          <Icon name={micOn ? 'mic' : 'micOff'} />
        </button>
        {showCam && (
          <button
            className={`call-island-ctl${camOn ? '' : ' off'}`}
            onClick={onToggleCam}
            title={camOn ? camOnTitle : camOffTitle}
          >
            <Icon name={camOn ? 'cam' : 'camOff'} />
          </button>
        )}
        <button className="call-island-end" onClick={onEnd} title={endTitle}>
          <Icon name="leave" />
        </button>
      </div>
    </div>
  );
}

export default function CallIsland() {
  const { db, ui, setUi, chatCall, endChatCall, meetCall, endMeetCall, t } = useApp();

  function toggleMic() { setUi({ micOn: !ui.micOn }); }
  function toggleCam() { setUi({ camOn: !ui.camOn }); }

  const pills = [];
  if (chatCall && !(ui.view === 'messages' && ui.activeConvId === chatCall.convId)) {
    pills.push(
      <IslandPill
        key="chat"
        icon={chatCall.type === 'video' ? 'cam' : 'phone'}
        label={convLabel(db, chatCall.convId)}
        startedAt={chatCall.startedAt}
        onReturn={() => setUi({ view: 'messages', activeConvId: chatCall.convId, msgPane: 'chat' })}
        onEnd={endChatCall}
        returnTitle={t('returnToCall')}
        endTitle={t('leaveCall')}
        micOn={ui.micOn}
        onToggleMic={toggleMic}
        micOnTitle={t('micOn')}
        micOffTitle={t('micOff')}
        showCam={chatCall.type === 'video'}
        camOn={ui.camOn}
        onToggleCam={toggleCam}
        camOnTitle={t('camOn')}
        camOffTitle={t('camOff')}
      />
    );
  }
  if (meetCall && ui.view !== 'meet') {
    pills.push(
      <IslandPill
        key="meet"
        icon="meet"
        label={meetCall.title}
        startedAt={meetCall.startedAt}
        onReturn={() => setUi({ view: 'meet' })}
        onEnd={endMeetCall}
        returnTitle={t('returnToCall')}
        endTitle={t('leaveCall')}
        micOn={ui.micOn}
        onToggleMic={toggleMic}
        micOnTitle={t('micOn')}
        micOffTitle={t('micOff')}
        showCam
        camOn={ui.camOn}
        onToggleCam={toggleCam}
        camOnTitle={t('camOn')}
        camOffTitle={t('camOff')}
      />
    );
  }
  if (!pills.length) return null;
  return <div className="call-island-stack">{pills}</div>;
}
