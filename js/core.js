// ============================================================
// INCO LAB — Noyau : état, persistance, helpers, icônes, modales
// ============================================================

const STORAGE_KEY = 'incolab-data-v1';
const SESSION_KEY = 'incolab-session-v1';
const PREFS_KEY = 'incolab-prefs-v1';

// ---------- État global ----------
const state = {
  user: null,               // utilisateur connecté
  view: 'home',
  projectView: 'kanban',    // kanban | list | analytics | templates | archived
  activeProjectId: 'launch',
  activeConvId: 'product',
  adminTab: 'dashboard',
  filesFolder: 'root',
  filesTab: 'all',          // all | mine | archived
  calCursor: new Date(),
  micOn: true,
  camOn: true,
  inCall: false,
  searchQuery: '',
  authMode: 'login',        // login | guest | forgot
};

let db = null;   // données persistées
let prefs = { theme: 'light', lang: 'fr' };

function loadDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { db = JSON.parse(raw); return; }
  } catch (e) { /* données corrompues → reseed */ }
  db = JSON.parse(JSON.stringify(SEED));
  saveDB();
}
function saveDB() { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) prefs = Object.assign(prefs, JSON.parse(raw));
  } catch (e) {}
  applyTheme();
}
function savePrefs() { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); }
function applyTheme() { document.documentElement.setAttribute('data-theme', prefs.theme); }

// ---------- i18n ----------
function t(key) {
  return (I18N[prefs.lang] && I18N[prefs.lang][key]) || I18N.fr[key] || key;
}

// ---------- Helpers ----------
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function el(id) { return document.getElementById(id); }
function member(id) { return db.team.find(m => m.id === id) || { name: '?', initials: '?', color: '#9298ab', presence: 'offline' }; }
function labelColor(name) {
  const l = db.labels.find(l => l.name === name);
  return l ? l.color : '#9298ab';
}
function project(id) { return db.projects.find(p => p.id === id); }
function allCards(p) { return p.columns.flatMap(c => c.cards); }
function findCard(cardId) {
  for (const p of db.projects) {
    for (const col of p.columns) {
      const card = col.cards.find(c => c.id === cardId);
      if (card) return { project: p, column: col, card };
    }
  }
  return null;
}
function nextId(list) { return list.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1; }
function nowTime() {
  return new Date().toLocaleTimeString(prefs.lang === 'en' ? 'en-US' : 'fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function avatarHTML(m, size = 'a30', withPresence = false) {
  const pres = withPresence ? `<span class="presence ${esc(m.presence || 'offline')}"></span>` : '';
  return `<span class="avatar ${size}" style="background:${esc(m.color)}" title="${esc(m.name)}">${esc(m.initials)}${pres}</span>`;
}

const PRIO_STYLE = {
  LOW:    'background:rgba(75,179,122,.15);color:#3a9d68',
  MEDIUM: 'background:rgba(91,141,239,.15);color:#4a76d0',
  HIGH:   'background:rgba(240,160,75,.18);color:#d18334',
  URGENT: 'background:rgba(229,72,77,.15);color:#e5484d',
};
function prioBadge(p) {
  return `<span class="prio-flag" style="${PRIO_STYLE[p] || ''}">${esc(t('prio_' + p))}</span>`;
}

// ---------- Icônes SVG (style géométrique minimal, cf. DA) ----------
const ICONS = {
  home: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 10 3.5l7 6V16a1 1 0 0 1-1 1h-4v-4.5H8V17H4a1 1 0 0 1-1-1V9.5Z"/></svg>',
  boards: '<svg viewBox="0 0 20 20" fill="currentColor"><rect x="3" y="4" width="4" height="12" rx="1.2"/><rect x="8.5" y="4" width="4" height="8" rx="1.2"/><rect x="14" y="4" width="4" height="10" rx="1.2"/></svg>',
  messages: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M3.5 4h13a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H8l-3.6 2.8c-.5.4-1.4 0-1.4-.7V5.5A1.5 1.5 0 0 1 3.5 4Z"/></svg>',
  files: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h3.2l1.6 1.8h6.2A1.5 1.5 0 0 1 17 8.3v6.2a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5v-8Z"/></svg>',
  meet: '<svg viewBox="0 0 20 20" fill="currentColor"><rect x="2.5" y="6" width="10" height="8" rx="1.6"/><path d="M13.5 9.4 17 7v6l-3.5-2.4v-1.2Z"/></svg>',
  calendar: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3" y="4.5" width="14" height="12" rx="1.6"/><path d="M3 8.5h14M7 3v3M13 3v3"/></svg>',
  groups: '<svg viewBox="0 0 20 20" fill="currentColor"><circle cx="7" cy="7.5" r="2.6"/><circle cx="13.6" cy="8.5" r="2.1"/><path d="M2.5 15.5c0-2.3 2-4 4.5-4s4.5 1.7 4.5 4v.5h-9v-.5Z"/><path d="M12.6 15.9v-.4c0-1.3-.5-2.4-1.4-3.2.7-.4 1.5-.7 2.4-.7 2.1 0 3.9 1.5 3.9 3.5v.8h-4.9Z"/></svg>',
  announce: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 8.5v3a1 1 0 0 0 1 1h1.5l1 3.5a.8.8 0 0 0 .77.6h1.1a.6.6 0 0 0 .58-.76L8.1 12.9h1.4l6 3.1a.7.7 0 0 0 1-.62V4.6a.7.7 0 0 0-1-.62l-6 3.1H4a1 1 0 0 0-1 1.42Z"/></svg>',
  admin: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2.8 16.5 5v4.6c0 4-2.8 6.9-6.5 7.9-3.7-1-6.5-3.9-6.5-7.9V5L10 2.8Z"/><path d="m7.5 9.8 1.8 1.8 3.2-3.4"/></svg>',
  search: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="8.8" cy="8.8" r="5.3"/><path d="m17 17-4.4-4.4"/></svg>',
  bell: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3a4.6 4.6 0 0 0-4.6 4.6c0 3.5-1.4 4.9-1.4 4.9h12s-1.4-1.4-1.4-4.9A4.6 4.6 0 0 0 10 3Z"/><path d="M8.5 15.5a1.6 1.6 0 0 0 3 0"/></svg>',
  sun: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="10" cy="10" r="3.4"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4"/></svg>',
  moon: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M16.6 12.2A6.9 6.9 0 0 1 7.8 3.4a.5.5 0 0 0-.65-.62 7.6 7.6 0 1 0 10.07 10.07.5.5 0 0 0-.62-.65Z"/></svg>',
  mic: '<svg viewBox="0 0 20 20" fill="currentColor"><rect x="7.6" y="2.8" width="4.8" height="8.6" rx="2.4"/><path d="M5 9.5a5 5 0 0 0 10 0h-1.5a3.5 3.5 0 0 1-7 0H5Z"/><rect x="9.3" y="14.3" width="1.4" height="2.9" rx=".7"/></svg>',
  micOff: '<svg viewBox="0 0 20 20" fill="currentColor"><rect x="7.6" y="2.8" width="4.8" height="8.6" rx="2.4"/><path d="M5 9.5a5 5 0 0 0 10 0h-1.5a3.5 3.5 0 0 1-7 0H5Z"/><rect x="9.3" y="14.3" width="1.4" height="2.9" rx=".7"/><path d="m4 3 12 14" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>',
  cam: '<svg viewBox="0 0 20 20" fill="currentColor"><rect x="2.5" y="6" width="10" height="8" rx="1.6"/><path d="M13.5 9.4 17 7v6l-3.5-2.4v-1.2Z"/></svg>',
  camOff: '<svg viewBox="0 0 20 20" fill="currentColor"><rect x="2.5" y="6" width="10" height="8" rx="1.6"/><path d="M13.5 9.4 17 7v6l-3.5-2.4v-1.2Z"/><path d="m3 3.5 14 13" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>',
  leave: '<svg viewBox="0 0 20 20" fill="currentColor"><rect x="2" y="8.6" width="16" height="3" rx="1.5"/></svg>',
  plus: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M10 4v12M4 10h12"/></svg>',
  clip: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m14.5 8.9-4.9 4.9a3.1 3.1 0 0 1-4.4-4.4l5.6-5.6a2.1 2.1 0 0 1 3 3l-5.6 5.6a1.05 1.05 0 0 1-1.5-1.5l4.9-4.9"/></svg>',
  send: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M2.8 9.2 16.6 3.3a.6.6 0 0 1 .8.76L12 17.1a.6.6 0 0 1-1.12.03l-1.9-4.62-4.6-1.94a.6.6 0 0 1 .02-1.12l7.5-2.72"/></svg>',
  spark: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2.5c.5 3.6 1.9 5 5.5 5.5-3.6.5-5 1.9-5.5 5.5-.5-3.6-1.9-5-5.5-5.5 3.6-.5 5-1.9 5.5-5.5Z"/><path d="M15.4 12.4c.3 1.7.9 2.3 2.6 2.6-1.7.3-2.3.9-2.6 2.6-.3-1.7-.9-2.3-2.6-2.6 1.7-.3 2.3-.9 2.6-2.6Z"/></svg>',
  check: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m4 10.5 4 4 8-9"/></svg>',
  phone: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M4.2 3h3l1.3 3.6-1.8 1.4a10.8 10.8 0 0 0 5.3 5.3l1.4-1.8L17 12.8v3a1.2 1.2 0 0 1-1.3 1.2C8.9 16.6 3.4 11.1 3 4.3A1.2 1.2 0 0 1 4.2 3Z"/></svg>',
  folder: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h3.2l1.6 1.8h6.2A1.5 1.5 0 0 1 17 8.3v6.2a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5v-8Z"/></svg>',
};
function icon(name) { return ICONS[name] || ''; }

// ---------- Toasts ----------
function toast(msg) {
  const root = el('toast-root');
  const node = document.createElement('div');
  node.className = 'toast';
  node.innerHTML = `<span style="width:14px;height:14px;display:inline-flex">${icon('check')}</span>${esc(msg)}`;
  root.appendChild(node);
  setTimeout(() => {
    node.style.transition = 'opacity .3s ease';
    node.style.opacity = '0';
    setTimeout(() => node.remove(), 320);
  }, 2400);
}

// ---------- Modales ----------
function openModal(html, { wide = false } = {}) {
  const root = el('modal-root');
  root.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true">${html}</div>
    </div>`;
  el('modal-overlay').addEventListener('mousedown', e => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
  const first = root.querySelector('input, textarea, select');
  if (first) setTimeout(() => first.focus(), 60);
}
function closeModal() { el('modal-root').innerHTML = ''; }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function modalHeader(title) {
  return `<div class="modal-title">${esc(title)}
    <button class="modal-close" onclick="closeModal()" aria-label="${esc(t('close'))}">✕</button></div>`;
}

// ---------- Journal d'audit + activité ----------
function logAudit(action, detail, sensitive = false) {
  db.auditLogs.unshift({
    id: nextId(db.auditLogs), action, user: state.user ? state.user.id : 'guest',
    detail, time: nowTime(), sensitive,
  });
}
function logActivity(html) {
  db.activity.unshift(html);
  db.activity = db.activity.slice(0, 12);
}
function notify(text, view = 'home') {
  db.notifications.unshift({ id: nextId(db.notifications), text, when: nowTime(), read: false, view });
}
