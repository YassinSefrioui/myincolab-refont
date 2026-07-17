import { useEffect, useState } from 'react';
import { useApp } from '../state/AppContext.jsx';

// Drapeaux par fuseau horaire (horloges de l'équipe)
const FLAGS = {
  'Europe/Paris': '🇫🇷',
  'America/New_York': '🇺🇸',
  'Europe/London': '🇬🇧',
  'Asia/Tokyo': '🇯🇵',
  'Africa/Casablanca': '🇲🇦',
  'Asia/Dubai': '🇦🇪',
};

function timeIn(tz) {
  try {
    return new Date().toLocaleTimeString('fr-FR', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}
function hourIn(tz) {
  try {
    const h = parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', hour12: false }).format(new Date()), 10);
    return Number.isNaN(h) ? 12 : h;
  } catch {
    return 12;
  }
}

/** Horloge mondiale : heure en direct par pays, configurable (ajout/retrait). */
export default function WorldClock() {
  const { db, updateDB, toast, t } = useApp();
  const [, setTick] = useState(0);
  const [adding, setAdding] = useState(false);

  // Rafraîchit l'affichage toutes les 10 s
  useEffect(() => {
    const id = setInterval(() => setTick(x => x + 1), 10000);
    return () => clearInterval(id);
  }, []);

  const remaining = db.timezoneChoices.filter(c => !db.timezones.some(z => z.tz === c.tz));

  function addZone(tz) {
    const choice = db.timezoneChoices.find(c => c.tz === tz);
    if (!choice) return;
    updateDB(draft => {
      draft.timezones.push({ id: 'tz' + Date.now(), label: choice.label, tz: choice.tz });
    });
    setAdding(false);
    toast(t('clockAdded'));
  }
  function removeZone(id) {
    updateDB(draft => {
      draft.timezones = draft.timezones.filter(z => z.id !== id);
    });
  }

  return (
    <div className="card">
      <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {t('worldClock')}
        {remaining.length > 0 && (
          <button className="proj-menu-btn" style={{ fontSize: 13 }} title={t('addClock')} onClick={() => setAdding(a => !a)}>+</button>
        )}
      </div>
      {db.timezones.map(z => {
        const h = hourIn(z.tz);
        const isDay = h >= 7 && h < 20;
        return (
          <div className="clock-row" key={z.id}>
            <span className="clock-flag">{FLAGS[z.tz] || '🌐'}</span>
            <span className="clock-label">{z.label}</span>
            <span style={{ fontSize: 11 }}>{isDay ? '☀️' : '🌙'}</span>
            <span className="clock-time">{timeIn(z.tz)}</span>
            <button className="clock-remove" title="×" onClick={() => removeZone(z.id)}>✕</button>
          </div>
        );
      })}
      {!db.timezones.length && <div className="empty-note" style={{ padding: '8px 0' }}>—</div>}
      {adding && (
        <select className="select" style={{ marginTop: 8 }} defaultValue=""
          onChange={e => { if (e.target.value) addZone(e.target.value); }}>
          <option value="" disabled>{t('addClock')}…</option>
          {remaining.map(c => <option value={c.tz} key={c.tz}>{FLAGS[c.tz] || '🌐'} {c.label}</option>)}
        </select>
      )}
    </div>
  );
}
