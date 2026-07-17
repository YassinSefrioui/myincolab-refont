import Icon from './Icon.jsx';
import { useApp } from '../state/AppContext.jsx';

export default function ToastRoot() {
  const { toasts } = useApp();
  return (
    <div className="toast-root" aria-live="polite">
      {toasts.map(tst => (
        <div className="toast" key={tst.id}>
          <span style={{ width: 14, height: 14, display: 'inline-flex' }}><Icon name="check" /></span>
          {tst.msg}
        </div>
      ))}
    </div>
  );
}
