import { useApp } from '../state/AppContext.jsx';

export default function NotifPanel() {
  const { db, updateDB, notifOpen, setNotifOpen, go, t } = useApp();
  if (!notifOpen) return null;

  function markAllRead() {
    updateDB(draft => { draft.notifications.forEach(n => n.read = true); });
    setNotifOpen(false);
  }
  function openNotif(id) {
    const n = db.notifications.find(x => x.id === id);
    if (!n) return;
    updateDB(draft => { const dn = draft.notifications.find(x => x.id === id); if (dn) dn.read = true; });
    setNotifOpen(false);
    go(n.view || 'home');
  }

  return (
    <div className="notif-panel" id="notif-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{t('notifications')}</span>
        <span className="link-accent" style={{ fontSize: 11 }} onClick={markAllRead}>{t('markAllRead')}</span>
      </div>
      {db.notifications.length ? db.notifications.slice(0, 15).map(n => (
        <div className={`notif-row${n.read ? '' : ' unread'}`} key={n.id} onClick={() => openNotif(n.id)}>
          <div style={{ minWidth: 0 }}>
            <div dangerouslySetInnerHTML={{ __html: n.text }} />
            <div className="when">{n.when}</div>
          </div>
        </div>
      )) : <div className="empty-note">{t('noNotif')}</div>}
    </div>
  );
}
