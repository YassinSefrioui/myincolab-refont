import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { SEED } from '../data.js';
import { I18N } from '../i18n.js';
import { buildGuestUser, GUEST_PERMISSION_KEYS, isGuestCodeExpired, nextId, nowTime } from '../lib/helpers.js';

const DEFAULT_HOME_WIDGETS = { clocks: true, activity: true, online: true, workload: true, decisions: true, myTasks: true, nextMeeting: true };

const STORAGE_KEY = 'incolab-data-v4';
const SESSION_KEY = 'incolab-session-v1';
const PREFS_KEY = 'incolab-prefs-v1';

const AppContext = createContext(null);

// Ajoute les départements/visibilité aux données déjà stockées (anciens schémas sans ces champs).
function migrateDB(db) {
  if (!db.departments) {
    const byName = new Map();
    db.team.forEach(m => {
      const name = m.job && m.job !== 'You' ? m.job : null;
      if (name && !byName.has(name)) byName.set(name, 'dept-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    });
    db.departments = [...byName.entries()].map(([name, id]) => ({ id, name }));
    db.team.forEach(m => {
      if (m.departmentId === undefined) {
        m.departmentId = (m.job && m.job !== 'You') ? byName.get(m.job) : null;
      }
      delete m.job;
    });
  }
  db.team.forEach(m => {
    if (!Array.isArray(m.hiddenProjectsOnProfile)) m.hiddenProjectsOnProfile = [];
  });
  if (!db.readMarkers) {
    db.readMarkers = {};
    Object.entries(db.messagesByConv || {}).forEach(([convId, list]) => {
      const lastId = list.length ? list[list.length - 1].id : 0;
      const p = db.projects.find(x => x.id === convId);
      const legacyUnread = p ? (p.unread || 0) : 0;
      db.readMarkers[convId] = Math.max(0, lastId - legacyUnread);
    });
  }
  db.projects.forEach(p => { delete p.unread; });
  // Aplatit l'ancien système de fils de discussion (threadReplies) en réponses citées inline.
  Object.values(db.messagesByConv || {}).forEach(list => {
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i];
      if (Array.isArray(m.threadReplies) && m.threadReplies.length) {
        let nid = nextId(list);
        const flattened = m.threadReplies.map(r => ({ ...r, id: nid++, replyTo: m.id }));
        list.splice(i + 1, 0, ...flattened);
      }
      delete m.threadReplies;
    }
  });
  db.files.forEach((f, i) => {
    if (f.ts) return;
    const txt = (f.time || '').toLowerCase();
    let hoursAgo = i * 3; // repli : étale les fichiers sans indice temporel exploitable
    const hMatch = txt.match(/(\d+)\s*h/);
    const jMatch = txt.match(/(\d+)\s*j/);
    if (txt.includes("aujourd'hui") || txt.includes('today')) hoursAgo = 1;
    else if (txt.includes('hier') || txt.includes('yesterday')) hoursAgo = 26;
    else if (hMatch) hoursAgo = Number(hMatch[1]);
    else if (jMatch) hoursAgo = Number(jMatch[1]) * 24 + 2;
    f.ts = Date.now() - hoursAgo * 3600000;
  });
  db.events.forEach(e => {
    if (!Array.isArray(e.hostIds)) e.hostIds = [e.hostId || 'you'];
    delete e.hostId;
  });
  (db.guestCodes || []).forEach(g => {
    if (!g.permissions) {
      const name = [g.firstName, g.lastName].filter(Boolean).join(' ');
      const oldProjectIds = Array.isArray(g.allowedProjectIds) ? g.allowedProjectIds : null;
      const oldViews = Array.isArray(g.allowedViews) ? g.allowedViews : null;
      g.name = name;
      g.email = g.email || '';
      g.validityType = 'time';
      g.durationDays = null;
      g.expiresAt = null;
      g.scopeProjectId = oldProjectIds && oldProjectIds.length ? oldProjectIds[0] : null;
      g.scopeGroupId = null;
      g.permissions = {};
      GUEST_PERMISSION_KEYS.forEach(k => { g.permissions[k] = (!oldViews || oldViews.includes(k)) ? 'execute' : 'none'; });
      delete g.firstName; delete g.lastName; delete g.allowedProjectIds; delete g.allowedViews;
    }
  });
  return db;
}

function loadDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return migrateDB(JSON.parse(raw));
  } catch (e) { /* données corrompues → reseed */ }
  const seeded = migrateDB(JSON.parse(JSON.stringify(SEED)));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}
function loadPrefs() {
  let prefs = { theme: 'light', lang: 'en', fontSize: 'medium' };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) prefs = Object.assign(prefs, JSON.parse(raw));
  } catch (e) { /* ignore */ }
  return prefs;
}

export function AppProvider({ children }) {
  const [db, setDb] = useState(loadDB);
  const [prefs, setPrefs] = useState(loadPrefs);
  const [user, setUser] = useState(null);
  const [booted, setBooted] = useState(false);

  const [ui, setUiState] = useState({
    view: 'home',
    activeProjectId: 'launch',
    activeConvId: 'launch',
    adminTab: 'dashboard',
    filesFolder: 'root',
    filesTab: 'all',
    calCursor: new Date(),
    micOn: true,
    camOn: true,
    searchQuery: '',
    authMode: 'login',
    projectsTab: 'active',
    joinEventId: null,
  });
  const setUi = useCallback(patch => setUiState(prev => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) })), []);

  const [modal, setModal] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiHistory, setAiHistory] = useState([]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', prefs.theme);
    document.documentElement.setAttribute('data-fontsize', prefs.fontSize || 'medium');
    document.documentElement.lang = prefs.lang;
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }, [prefs]);

  // Restore session on boot
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const { id, guestCodeId } = JSON.parse(raw);
        if (id === 'guest') {
          const gc = db.guestCodes.find(g => g.id === guestCodeId);
          if (gc && gc.active && !isGuestCodeExpired(gc)) setUser(buildGuestUser(gc));
        } else {
          const m = db.team.find(x => x.id === id);
          if (m && !m.locked) setUser({ ...m });
        }
      }
    } catch (e) { /* session invalide */ }
    setBooted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateDB = useCallback(mutator => {
    setDb(prev => {
      const draft = structuredClone(prev);
      mutator(draft);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      return draft;
    });
  }, []);

  const t = useCallback(key => (I18N[prefs.lang] && I18N[prefs.lang][key]) || I18N.fr[key] || key, [prefs.lang]);

  const toast = useCallback(msg => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, msg }]);
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 2400);
  }, []);

  const openModal = useCallback((content, opts = {}) => setModal({ content, wide: !!opts.wide }), []);
  const closeModal = useCallback(() => setModal(null), []);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') closeModal(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeModal]);

  const logAudit = useCallback((action, detail, sensitive = false) => {
    updateDB(draft => {
      draft.auditLogs.unshift({ id: nextId(draft.auditLogs), action, user: user ? user.id : 'guest', detail, time: nowTime(prefs.lang), sensitive });
    });
  }, [updateDB, user, prefs.lang]);

  const logActivity = useCallback(html => {
    updateDB(draft => {
      draft.activity.unshift(html);
      draft.activity = draft.activity.slice(0, 12);
    });
  }, [updateDB]);

  const notify = useCallback((text, view = 'home') => {
    updateDB(draft => {
      draft.notifications.unshift({ id: nextId(draft.notifications), text, when: nowTime(prefs.lang), read: false, view });
    });
  }, [updateDB, prefs.lang]);

  const go = useCallback(view => {
    setUi({ view });
    closeModal();
    setNotifOpen(false);
    setUi(prev => ({ ...prev, searchQuery: '' }));
  }, [setUi, closeModal]);

  const setLang = useCallback(lang => setPrefs(p => ({ ...p, lang })), []);
  const setTheme = useCallback(theme => setPrefs(p => ({ ...p, theme })), []);
  const setFontSize = useCallback(fontSize => setPrefs(p => ({ ...p, fontSize })), []);
  const toggleTheme = useCallback(() => setPrefs(p => ({ ...p, theme: p.theme === 'light' ? 'dark' : 'light' })), []);
  const toggleHomeWidget = useCallback(key => setPrefs(p => ({
    ...p,
    homeWidgets: { ...DEFAULT_HOME_WIDGETS, ...p.homeWidgets, [key]: !(p.homeWidgets ? p.homeWidgets[key] !== false : true) },
  })), []);
  const setHomeTasksLimit = useCallback(n => setPrefs(p => ({ ...p, homeTasksLimit: n })), []);

  const startSession = useCallback(m => {
    setUser({ ...m });
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: m.id, guestCodeId: m.guestCodeId || null })); } catch (e) { /* ignore */ }
    logAudit('LOGIN', m.email, false);
    setUi(prev => ({ ...prev, view: 'home' }));
    toast(t('welcome') + ', ' + m.name.split(' ')[0] + ' 👋');
  }, [logAudit, setUi, toast, t]);

  const logout = useCallback(() => {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
    setUser(null);
    setNotifOpen(false);
    setAiOpen(false);
  }, []);

  // Simulated presence, mirrors original 25s interval
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => {
      updateDB(draft => {
        const others = draft.team.filter(m => m.id !== user.id);
        if (!others.length) return;
        const pick = others[Math.floor(Math.random() * others.length)];
        const states = ['online', 'away', 'busy', 'offline'];
        pick.presence = states[Math.floor(Math.random() * states.length)];
      });
    }, 25000);
    return () => clearInterval(id);
  }, [user, updateDB]);

  const value = useMemo(() => ({
    db, updateDB,
    prefs, setLang, setTheme, setFontSize, toggleTheme, toggleHomeWidget, setHomeTasksLimit,
    user, setUser, startSession, logout,
    ui, setUi, go,
    t,
    toast, toasts,
    modal, openModal, closeModal,
    notifOpen, setNotifOpen,
    aiOpen, setAiOpen, aiHistory, setAiHistory,
    logAudit, logActivity, notify,
    booted,
  }), [db, updateDB, prefs, setLang, setTheme, setFontSize, toggleTheme, toggleHomeWidget, setHomeTasksLimit, user, startSession, logout, ui, setUi, go, t, toast, toasts, modal, openModal, closeModal, notifOpen, aiOpen, aiHistory, logAudit, logActivity, notify, booted]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
