import { useEffect } from 'react';
import Icon from './Icon.jsx';
import Avatar from './Avatar.jsx';
import { ModalHeader } from './Modal.jsx';
import { useApp } from '../state/AppContext.jsx';

const PRESENCE_CHOICES = ['online', 'away', 'busy', 'offline'];
const LANG_CHOICES = [['en', 'EN'], ['fr', 'FR'], ['es', 'ES'], ['it', 'IT'], ['zh', '中文']];

function LegalModal() {
  const { closeModal, t } = useApp();
  return (
    <>
      <ModalHeader title={t('legalMentions')} />
      <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6 }}>{t('legalMentionsBody')}</p>
      <div className="modal-foot">
        <button className="btn btn-primary" onClick={closeModal}>{t('close')}</button>
      </div>
    </>
  );
}

export default function ProfileMenu({ onClose }) {
  const { user, setUser, updateDB, prefs, setLang, go, openModal, logout, toast, t } = useApp();

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function setPresence(p) {
    updateDB(draft => { const m = draft.team.find(x => x.id === user.id); if (m) m.presence = p; });
    setUser(u => ({ ...u, presence: p }));
    toast(t(p));
  }
  function openSettings() { go('profile'); onClose(); }
  function openLegal() { openModal(<LegalModal />); onClose(); }
  function doLogout() { logout(); onClose(); }

  return (
    <div className="profile-menu">
      <div className="profile-menu-head">
        <Avatar m={user} size="a30" withPresence />
        <div style={{ minWidth: 0 }}>
          <div className="profile-menu-name">{user.name}</div>
          <div className="profile-menu-email">{user.email}</div>
        </div>
      </div>

      <div className="profile-menu-section-label">{t('presenceStatus')}</div>
      <div className="profile-menu-presence-row">
        {PRESENCE_CHOICES.map(p => (
          <button key={p} className={`presence-chip pr-${p}${user.presence === p ? ' active' : ''}`} onClick={() => setPresence(p)}>
            <Icon name="presence" className={`dot-${p}`} />
            {t(p)}
          </button>
        ))}
      </div>

      <div className="profile-menu-sep" />
      <button className="profile-menu-item" onClick={openSettings}>
        <Icon name="settings" /> {t('settings')}
      </button>

      <div className="profile-menu-section-label">{t('language')}</div>
      <div className="profile-menu-lang-row">
        {LANG_CHOICES.map(([k, lbl]) => (
          <button key={k} className={`chip-btn${prefs.lang === k ? ' active' : ''}`} onClick={() => setLang(k)}>{lbl}</button>
        ))}
      </div>

      <div className="profile-menu-sep" />
      <button className="profile-menu-item" onClick={openLegal}>
        <Icon name="legal" /> {t('legalMentions')}
      </button>

      <div className="profile-menu-sep" />
      <button className="profile-menu-item danger" onClick={doLogout}>
        <Icon name="logout" /> {t('logout')}
      </button>
    </div>
  );
}
