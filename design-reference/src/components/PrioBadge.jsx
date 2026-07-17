import { PRIO_STYLE } from '../lib/helpers.js';
import { useApp } from '../state/AppContext.jsx';

export default function PrioBadge({ p }) {
  const { t } = useApp();
  return <span className="prio-flag" style={PRIO_STYLE[p] || {}}>{t('prio_' + p)}</span>;
}
