import { dueInfo, fmtDate } from '../lib/helpers.js';
import { useApp } from '../state/AppContext.jsx';

/**
 * Badge d'échéance : date courte + compte à rebours de jours,
 * teinté selon l'urgence (ok / bientôt / aujourd'hui / en retard).
 */
export default function DueTag({ due, compact = false }) {
  const { prefs, t } = useApp();
  if (!due) return null;
  const info = dueInfo(due, t);
  if (!info) return <span className="due-tag t-ok">{due}</span>;
  return (
    <span className={`due-tag t-${info.tone}`} title={fmtDate(due, prefs.lang)}>
      {!compact && <>{fmtDate(due, prefs.lang)} · </>}
      {info.text}
    </span>
  );
}
