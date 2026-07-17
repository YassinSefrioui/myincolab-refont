import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

function buildSlots(step) {
  const out = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += step) {
      out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return out;
}
const SLOTS = buildSlots(15);

/** Sélecteur d'heure dynamique (liste défilante en popover), aligné sur la DA du site. */
export default function TimePicker({ value, onChange, placeholder = '--:--' }) {
  const [open, setOpen] = useState(false);
  const [align, setAlign] = useState('left');
  const wrapRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    const id = requestAnimationFrame(() => {
      const active = panelRef.current?.querySelector('.tp-item.active');
      if (active) active.scrollIntoView({ block: 'center' });
    });
    return () => { document.removeEventListener('mousedown', onDown); cancelAnimationFrame(id); };
  }, [open]);

  function toggleOpen() {
    if (!open) {
      const rect = wrapRef.current.getBoundingClientRect();
      const bounds = wrapRef.current.closest('.modal, .proj-menu, .dp-panel, .tp-panel');
      const limit = bounds ? bounds.getBoundingClientRect().right : window.innerWidth - 16;
      setAlign(rect.left + 130 > limit ? 'right' : 'left');
    }
    setOpen(!open);
  }
  function pick(v) { onChange(v); setOpen(false); }

  return (
    <div className="dp-wrap" ref={wrapRef}>
      <button type="button" className="input dp-trigger" onClick={toggleOpen}>
        <Icon name="clock" />
        <span className={value ? 'dp-value' : 'dp-placeholder'}>{value || placeholder}</span>
      </button>
      {open && (
        <div className={`tp-panel${align === 'right' ? ' align-right' : ''}`} ref={panelRef}>
          {SLOTS.map(s => (
            <button type="button" key={s} className={`tp-item${s === value ? ' active' : ''}`} onClick={() => pick(s)}>{s}</button>
          ))}
        </div>
      )}
    </div>
  );
}
