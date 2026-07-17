import { useEffect, useRef } from 'react';
import BackgroundCanvas from './components/BackgroundCanvas.jsx';
import NavRail from './components/NavRail.jsx';
import Header from './components/Header.jsx';
import SecondaryCol from './components/SecondaryCol.jsx';
import NotifPanel from './components/NotifPanel.jsx';
import SearchPanel from './components/SearchPanel.jsx';
import AIPanel from './components/AIPanel.jsx';
import ModalRoot from './components/Modal.jsx';
import ToastRoot from './components/ToastRoot.jsx';
import CallIsland from './components/CallIsland.jsx';
import TourOverlay from './components/TourOverlay.jsx';
import Auth from './views/Auth.jsx';
import Home from './views/Home.jsx';
import Projects from './views/Projects.jsx';
import Messages from './views/messages/Messages.jsx';
import Meet from './views/Meet.jsx';
import Files from './views/Files.jsx';
import Calendar from './views/Calendar.jsx';
import Groups from './views/Groups.jsx';
import Announcements from './views/Announcements.jsx';
import Admin from './views/Admin.jsx';
import Profile from './views/Profile.jsx';
import Tutorial from './views/Tutorial.jsx';
import { useApp } from './state/AppContext.jsx';

const VIEWS = {
  home: Home,
  projects: Projects,
  messages: Messages,
  files: Files,
  meet: Meet,
  calendar: Calendar,
  groups: Groups,
  announcements: Announcements,
  tutorial: Tutorial,
  admin: Admin,
  profile: Profile,
};

export default function App() {
  const { user, booted, ui, setNotifOpen, setUi } = useApp();
  const contentRef = useRef(null);

  useEffect(() => {
    function onDown(e) {
      const notif = document.getElementById('notif-panel');
      if (notif && !notif.contains(e.target) && !e.target.closest('.icon-btn')) setNotifOpen(false);
      const search = document.getElementById('search-panel');
      if (search && !search.contains(e.target) && e.target.id !== 'global-search') setUi({ searchQuery: '' });
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [setNotifOpen, setUi]);

  if (!booted) return null;

  if (!user) {
    return (
      <>
        <BackgroundCanvas />
        <Auth />
        <ToastRoot />
      </>
    );
  }

  const ViewComponent = VIEWS[ui.view] || Home;

  return (
    <>
      <BackgroundCanvas />
      <div id="app-root" className="app-shell">
        <NavRail />
        <div className="app-main">
          <Header />
          <div className="app-body">
            <SecondaryCol />
            <main id="content" className="content" tabIndex={-1} ref={contentRef}>
              <ViewComponent />
            </main>
          </div>
        </div>
      </div>
      <NotifPanel />
      <SearchPanel />
      <AIPanel />
      <ModalRoot />
      <ToastRoot />
      <CallIsland />
      <TourOverlay />
    </>
  );
}
