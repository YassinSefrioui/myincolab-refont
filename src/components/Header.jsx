import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import Avatar from './Avatar.jsx';
import ProfileMenu from './ProfileMenu.jsx';
import { useApp } from '../state/AppContext.jsx';

const MENU_CLOSE_MS = 220;

export default function Header() {
  const { db, prefs, toggleTheme, user, ui, setUi, notifOpen, setNotifOpen, t } = useApp();
  // 'closed' | 'open' | 'closing' — le menu reste monté pendant 'closing' le temps
  // que l'animation de "réenroulement" vers le haut se joue avant de disparaître.
  const [profileState, setProfileState] = useState('closed');
  const profileWrapRef = useRef(null);
  const closeTimer = useRef(null);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  function openProfile() { clearTimeout(closeTimer.current); setProfileState('open'); }
  function closeProfile() {
    setProfileState(s => (s === 'open' ? 'closing' : s));
    closeTimer.current = setTimeout(() => setProfileState('closed'), MENU_CLOSE_MS);
  }
  function toggleProfile() { profileState === 'open' ? closeProfile() : openProfile(); }

  useEffect(() => {
    if (profileState !== 'open') return;
    function onDown(e) { if (profileWrapRef.current && !profileWrapRef.current.contains(e.target)) closeProfile(); }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileState]);

  // Ferme le menu profil dès qu'on navigue ailleurs, pour éviter qu'il ne
  // reste ouvert (et refasse son animation d'ouverture) par-dessus la nouvelle page.
  useEffect(() => { setProfileState('closed'); clearTimeout(closeTimer.current); }, [ui.view]);

  if (!user) return null;
  const unread = db.notifications.filter(n => !n.read).length;
  return (
    <header id="app-header" className="app-header">
      <div className="header-search">
        <Icon name="search" />
        <input
          id="global-search"
          placeholder={t('search')}
          value={ui.searchQuery}
          onChange={e => setUi({ searchQuery: e.target.value })}
        />
      </div>
      <div className="header-right">
        <button className="icon-btn" onClick={toggleTheme} title={t('theme')}>
          <Icon name={prefs.theme === 'light' ? 'moon' : 'sun'} />
        </button>
        <button className="icon-btn" onClick={() => setNotifOpen(o => !o)} title={t('notifications')}>
          <Icon name="bell" />
          {unread > 0 && <span className="dot" />}
        </button>
        <div className="profile-menu-wrap" ref={profileWrapRef}>
          <Avatar m={user} size="a30" withPresence onClick={toggleProfile} />
          {profileState !== 'closed' && <ProfileMenu closing={profileState === 'closing'} onClose={closeProfile} />}
        </div>
      </div>
    </header>
  );
}
