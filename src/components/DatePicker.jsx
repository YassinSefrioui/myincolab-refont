import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { DOW_LABELS, LOCALES, fmtDateFull, toISODate } from '../lib/helpers.js';
import { useApp } from '../state/AppContext.jsx';

function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Sélecteur de date dynamique (mini-calendrier en popover), aligné sur la DA du site. */
export default function DatePicker({ value, onChange, min, placeholder, clearable = false }) {
  const { prefs, t } = useApp();
  const [open, setOpen] = useState(false);
  const [align, setAlign] = useState('left');
  const [cursor, setCursor] = useState(() => (value ? parseISO(value) : new Date()));
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function toggleOpen() {
    if (!open) {
      setCursor(value ? parseISO(value) : new Date());
      const rect = wrapRef.current.getBoundingClientRect();
      const bounds = wrapRef.current.closest('.modal, .proj-menu, .dp-panel, .tp-panel');
      const limit = bounds ? bounds.getBoundingClientRect().right : window.innerWidth - 16;
      setAlign(rect.left + 250 > limit ? 'right' : 'left');
    }
    setOpen(!open);
  }

  const locale = LOCALES[prefs.lang] || 'fr-FR';
  const y = cursor.getFullYear(), m = cursor.getMonth();
  const monthLabel = cursor.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const first = new Date(y, m, 1);
  let startDow = first.getDay() - 1;
  if (startDow < 0) startDow = 6;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayIso = toISODate(new Date());
  const dows = DOW_LABELS[prefs.lang] || DOW_LABELS.fr;

  function pick(day) {
    onChange(toISODate(new Date(y, m, day)));
    setOpen(false);
  }
  function move(delta) { setCursor(new Date(y, m + delta, 1)); }

  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(<span className="dp-cell pad" key={'pad' + i} />);
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = toISODate(new Date(y, m, day));
    const disabled = min ? iso < min : false;
    cells.push(
      <button
        type="button" key={day}
        className={`dp-cell${iso === todayIso ? ' today' : ''}${iso === value ? ' selected' : ''}`}
        disabled={disabled}
        onClick={() => pick(day)}
      >{day}</button>
    );
  }

  return (
    <div className="dp-wrap" ref={wrapRef}>
      <button type="button" className="input dp-trigger" onClick={toggleOpen}>
        <Icon name="calendar" />
        <span className={value ? 'dp-value' : 'dp-placeholder'}>{value ? fmtDateFull(value, prefs.lang) : (placeholder || t('selectDate'))}</span>
        {clearable && value && (
          <span className="dp-clear" onClick={e => { e.stopPropagation(); onChange(''); }} title={t('delete')}><Icon name="close" /></span>
        )}
      </button>
      {open && (
        <div className={`dp-panel${align === 'right' ? ' align-right' : ''}`}>
          <div className="dp-panel-head">
            <button type="button" className="dp-nav" onClick={() => move(-1)}><Icon name="chevron" style={{ transform: 'rotate(90deg)' }} /></button>
            <span className="dp-month">{monthLabel}</span>
            <button type="button" className="dp-nav" onClick={() => move(1)}><Icon name="chevron" style={{ transform: 'rotate(-90deg)' }} /></button>
          </div>
          <div className="dp-dow-row">
            {dows.map(d => <span key={d} className="dp-dow">{d}</span>)}
          </div>
          <div className="dp-grid">{cells}</div>
        </div>
      )}
    </div>
  );
}
