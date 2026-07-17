import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { SEED } from '../data.js';
import { I18N } from '../i18n.js';
import { nextId, nowTime } from '../lib/helpers.js';

const STORAGE_KEY = 'incolab-data-v3';
const SESSION_KEY = 'incolab-session-v1';
const PREFS_KEY = 'incolab-prefs-v1';

const AppContext = createContext(null);

function loadDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* données corrompues → reseed */ }
  const seeded = JSON.parse(JSON.stringify(SEED));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}
function loadPrefs() {
  let prefs = { theme: 'light', lang: 'fr' };
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
  });
  const setUi = useCallback(patch => setUiState(prev => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) })), []);

  const [modal, setModal] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiHistory, setAiHistory] = useState([]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', prefs.theme);
    document.documentElement.lang = prefs.lang;
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }, [prefs]);

  // Restore session on boot
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const { id } = JSON.parse(raw);
        const m = id === 'guest'
          ? { id: 'guest', name: 'Invité', initials: 'IN', color: '#9298ab', role: 'GUEST', email: 'guest@incolab.com', presence: 'online' }
          : db.team.find(x => x.id === id);
        if (m && !m.locked) setUser({ ...m });
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
  const toggleTheme = useCallback(() => setPrefs(p => ({ ...p, theme: p.theme === 'light' ? 'dark' : 'light' })), []);

  const startSession = useCallback(m => {
    setUser({ ...m });
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: m.id })); } catch (e) { /* ignore */ }
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
    prefs, setLang, setTheme, toggleTheme,
    user, setUser, startSession, logout,
    ui, setUi, go,
    t,
    toast, toasts,
    modal, openModal, closeModal,
    notifOpen, setNotifOpen,
    aiOpen, setAiOpen, aiHistory, setAiHistory,
    logAudit, logActivity, notify,
    booted,
  }), [db, updateDB, prefs, setLang, setTheme, toggleTheme, user, startSession, logout, ui, setUi, go, t, toast, toasts, modal, openModal, closeModal, notifOpen, aiOpen, aiHistory, logAudit, logActivity, notify, booted]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
