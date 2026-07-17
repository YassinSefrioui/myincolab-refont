import { useApp } from '../state/AppContext.jsx';

export function ModalHeader({ title }) {
  const { closeModal, t } = useApp();
  return (
    <div className="modal-title">
      {title}
      <button className="modal-close" onClick={closeModal} aria-label={t('close')}>✕</button>
    </div>
  );
}

export default function ModalRoot() {
  const { modal, closeModal } = useApp();
  if (!modal) return null;
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) closeModal(); }}>
      <div className={`modal${modal.wide ? ' wide' : ''}`} role="dialog" aria-modal="true">
        {modal.content}
      </div>
    </div>
  );
}
