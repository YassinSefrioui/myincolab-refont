import { useEffect, useState } from 'react';
import { TOUR_STEPS } from '../lib/tourSteps.js';
import { useApp } from '../state/AppContext.jsx';

const TOOLTIP_W = 280;
const TOOLTIP_H_EST = 190;
const MARGIN = 14;

function clamp(v, min, max) { return Math.min(Math.max(v, min), max === undefined ? min : max); }

/** Choisit le côté (haut/bas/gauche/droite) avec le plus de place, puis calcule une position toujours dans l'écran. */
function placeTooltip(rect, vw, vh) {
  const spaceTop = rect.top;
  const spaceBottom = vh - rect.bottom;
  const spaceLeft = rect.left;
  const spaceRight = vw - rect.right;
  const maxH = Math.max(vh - MARGIN * 2, TOOLTIP_H_EST);

  let side = 'bottom';
  if (spaceBottom >= TOOLTIP_H_EST) side = 'bottom';
  else if (spaceTop >= TOOLTIP_H_EST) side = 'top';
  else if (spaceRight >= TOOLTIP_W + 24) side = 'right';
  else if (spaceLeft >= TOOLTIP_W + 24) side = 'left';
  else side = spaceBottom >= spaceTop ? 'bottom' : 'top';

  let top, left;
  if (side === 'bottom') { top = rect.bottom + 10; left = rect.left; }
  else if (side === 'top') { top = rect.top - TOOLTIP_H_EST - 10; left = rect.left; }
  else if (side === 'right') { left = rect.right + 10; top = rect.top; }
  else { left = rect.left - TOOLTIP_W - 10; top = rect.top; }

  top = clamp(top, MARGIN, Math.max(MARGIN, vh - TOOLTIP_H_EST - MARGIN));
  left = clamp(left, MARGIN, Math.max(MARGIN, vw - TOOLTIP_W - MARGIN));
  return { top, left, maxH };
}

export default function TourOverlay() {
  const { tourKey, endTour, t } = useApp();
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState(null);

  const steps = tourKey ? TOUR_STEPS[tourKey] : null;
  const step = steps ? steps[stepIndex] : null;

  useEffect(() => { setStepIndex(0); }, [tourKey]);

  // Localise l'élément ciblé (avec quelques tentatives : le DOM de la page
  // qu'on vient d'ouvrir n'est pas toujours peint au tout premier rendu).
  useEffect(() => {
    if (!step) { setRect(null); return; }
    let tries = 0;
    let raf;
    function locate() {
      const el = document.querySelector(step.target);
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setRect(el.getBoundingClientRect());
        return;
      }
      tries += 1;
      if (tries < 20) raf = requestAnimationFrame(locate);
      else endTour();
    }
    locate();
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Recale le spotlight au scroll/resize.
  useEffect(() => {
    if (!step) return;
    function recalc() {
      const el = document.querySelector(step.target);
      if (el) setRect(el.getBoundingClientRect());
    }
    window.addEventListener('resize', recalc);
    window.addEventListener('scroll', recalc, true);
    return () => { window.removeEventListener('resize', recalc); window.removeEventListener('scroll', recalc, true); };
  }, [step]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') endTour(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [endTour]);

  if (!tourKey || !steps || !step || !rect) return null;

  const vw = window.innerWidth, vh = window.innerHeight;
  const isLast = stepIndex === steps.length - 1;
  const { top: tooltipTop, left: tooltipLeft, maxH: tooltipMaxH } = placeTooltip(rect, vw, vh);

  function next() { setStepIndex(i => Math.min(i + 1, steps.length - 1)); }
  function prev() { setStepIndex(i => Math.max(i - 1, 0)); }

  return (
    <div className="tour-root">
      <div className="tour-mask" style={{ top: 0, left: 0, width: '100%', height: Math.max(0, rect.top - 6) }} />
      <div className="tour-mask" style={{ top: rect.top + rect.height + 6, left: 0, width: '100%', height: Math.max(0, vh - (rect.top + rect.height + 6)) }} />
      <div className="tour-mask" style={{ top: rect.top - 6, left: 0, width: Math.max(0, rect.left - 6), height: rect.height + 12 }} />
      <div className="tour-mask" style={{ top: rect.top - 6, left: rect.left + rect.width + 6, width: Math.max(0, vw - (rect.left + rect.width + 6)), height: rect.height + 12 }} />
      <div className="tour-spot" style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }} />

      <div
        className="tour-tooltip"
        style={{ top: tooltipTop, left: tooltipLeft, width: TOOLTIP_W, maxHeight: tooltipMaxH }}
      >
        <div className="tour-tooltip-step">{stepIndex + 1} / {steps.length}</div>
        <div className="tour-tooltip-title">{t(step.titleKey)}</div>
        <div className="tour-tooltip-body">{t(step.bodyKey)}</div>
        <div className="tour-tooltip-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={endTour}>{t('tourSkip')}</button>
          <span style={{ flex: 1 }} />
          {stepIndex > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={prev}>{t('tourPrev')}</button>}
          <button type="button" className="btn btn-primary btn-sm" onClick={isLast ? endTour : next}>{isLast ? t('tourFinish') : t('tourNext')}</button>
        </div>
      </div>
    </div>
  );
}
