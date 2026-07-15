// ============================================================
// INCO LAB — Coquille, routeur, recherche, notifications,
// assistant IA, fond dynamique, démarrage
// ============================================================

// ---------- Navigation (DA Compass : icône + libellé, 88px) ----------
const NAV_ITEMS = [
  { key: 'home',          icon: 'home',     label: () => t('home') },
  { key: 'projects',      icon: 'boards',   label: () => t('projects') },
  { key: 'messages',      icon: 'messages', label: () => t('messages'), badge: () => db.channels.reduce((s, c) => s + c.unread, 0) },
  { key: 'files',         icon: 'files',    label: () => t('files') },
  { key: 'meet',          icon: 'meet',     label: () => t('meet') },
  { key: 'calendar',      icon: 'calendar', label: () => t('calendar') },
  { key: 'groups',        icon: 'groups',   label: () => t('groups') },
  { key: 'announcements', icon: 'announce', label: () => t('announcements') },
  { key: 'admin',         icon: 'admin',    label: () => t('admin'), adminOnly: true },
];

const VIEWS = {
  home: renderHome,
  projects: renderProjects,
  messages: renderMessages,
  files: renderFiles,
  meet: renderMeet,
  calendar: renderCalendar,
  groups: renderGroups,
  announcements: renderAnnouncements,
  admin: renderAdmin,
  profile: renderProfile,
};

function go(view) {
  state.view = view;
  closeModal();
  el('notif-panel').hidden = true;
  el('search-panel').hidden = true;
  renderShell();
  render();
}

function render() {
  const sec = el('secondary-col');
  if (state.view !== 'messages') sec.hidden = true;
  (VIEWS[state.view] || renderHome)();
  renderNav();
}

// ---------- Nav gauche ----------
function renderNav() {
  const nav = el('left-nav');
  const items = NAV_ITEMS.filter(it => !it.adminOnly || state.user.role === 'ADMIN');
  nav.innerHTML = `
    <img class="nav-logo" src="assets/logo.jpeg" alt="INCO LAB" onclick="go('home')" />
    ${items.map(it => {
      const badge = it.badge ? it.badge() : 0;
      return `
      <button class="nav-item${state.view === it.key ? ' active' : ''}" onclick="go('${it.key}')" title="${esc(it.label())}">
        ${icon(it.icon)}
        <span>${esc(it.label())}</span>
        ${badge > 0 ? `<span class="badge">${badge}</span>` : ''}
      </button>`;
    }).join('')}
    <span class="nav-user" onclick="go('profile')" title="${esc(t('profile'))}">
      ${avatarHTML(state.user, 'a30', true)}
    </span>`;
}

// ---------- Header ----------
function renderHeader() {
  const unread = db.notifications.filter(n => !n.read).length;
  el('app-header').innerHTML = `
    <div class="header-search">
      ${icon('search')}
      <input id="global-search" placeholder="${esc(t('search'))}" value="${esc(state.searchQuery)}"
        oninput="onSearchInput(this.value)" onfocus="if(this.value)onSearchInput(this.value)" />
    </div>
    <div class="header-right">
      <button class="icon-btn" onclick="toggleTheme()" title="${esc(t('theme'))}">${icon(prefs.theme === 'light' ? 'moon' : 'sun')}</button>
      <button class="icon-btn" onclick="toggleNotifPanel()" title="${esc(t('notifications'))}">
        ${icon('bell')}
        ${unread > 0 ? '<span class="dot"></span>' : ''}
      </button>
      <span style="cursor:pointer" onclick="go('profile')">${avatarHTML(state.user, 'a30', true)}</span>
    </div>`;
}

function renderShell() {
  renderNav();
  renderHeader();
  ensureAIFab();
}

// ---------- Recherche globale ----------
function onSearchInput(q) {
  state.searchQuery = q;
  const panel = el('search-panel');
  if (!q.trim()) { panel.hidden = true; return; }
  const needle = q.trim().toLowerCase();
  const hits = [];

  db.projects.filter(p => !p.archived).forEach(p => {
    if (p.name.toLowerCase().includes(needle)) hits.push({ type: '📋', text: p.name, run: `state.activeProjectId='${p.id}';state.projectView='kanban';go('projects')` });
    allCards(p).forEach(c => {
      if (c.title.toLowerCase().includes(needle)) hits.push({ type: '☑️', text: c.title + ' · ' + p.name, run: `state.activeProjectId='${p.id}';go('projects');openTaskModal(${c.id})` });
    });
  });
  Object.entries(db.messagesByConv).forEach(([convId, msgs]) => {
    msgs.forEach(m => {
      if (m.text.toLowerCase().includes(needle)) hits.push({ type: '💬', text: m.text.slice(0, 60) + ' · ' + convLabel(convId), run: `state.activeConvId='${convId}';go('messages')` });
    });
  });
  db.files.forEach(f => {
    if (f.name.toLowerCase().includes(needle)) hits.push({ type: '📄', text: f.name, run: `state.filesFolder='${f.folder}';state.filesTab='all';go('files')` });
  });
  db.team.forEach(m => {
    if (m.name.toLowerCase().includes(needle)) hits.push({ type: '👤', text: m.name + ' · ' + (m.job || m.role), run: `go('groups')` });
  });
  db.events.forEach(e => {
    if (e.title.toLowerCase().includes(needle)) hits.push({ type: '📅', text: e.title, run: `go('calendar')` });
  });

  panel.hidden = false;
  panel.innerHTML = `
    <div class="section-label">${esc(t('searchResults'))} (${hits.length})</div>
    ${hits.length ? hits.slice(0, 12).map(h => `
      <div class="notif-row" onclick="el('search-panel').hidden=true;state.searchQuery='';${h.run}">
        <span>${h.type}</span><div>${esc(h.text)}</div>
      </div>`).join('') : `<div class="empty-note">${esc(t('noResults'))}</div>`}`;
}
document.addEventListener('mousedown', e => {
  const panel = el('search-panel');
  if (!panel.hidden && !panel.contains(e.target) && e.target.id !== 'global-search') panel.hidden = true;
  const notif = el('notif-panel');
  if (!notif.hidden && !notif.contains(e.target) && !e.target.closest('.icon-btn')) notif.hidden = true;
});

// ---------- Notifications ----------
function toggleNotifPanel() {
  const panel = el('notif-panel');
  if (!panel.hidden) { panel.hidden = true; return; }
  panel.hidden = false;
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span style="font-size:13px;font-weight:700">${esc(t('notifications'))}</span>
      <span class="link-accent" style="font-size:11px" onclick="markAllRead()">${esc(t('markAllRead'))}</span>
    </div>
    ${db.notifications.length ? db.notifications.slice(0, 15).map(n => `
      <div class="notif-row${n.read ? '' : ' unread'}" onclick="openNotif(${n.id})">
        <div style="min-width:0">
          <div>${n.text}</div>
          <div class="when">${esc(n.when)}</div>
        </div>
      </div>`).join('') : `<div class="empty-note">${esc(t('noNotif'))}</div>`}`;
}
function markAllRead() {
  db.notifications.forEach(n => n.read = true);
  saveDB(); el('notif-panel').hidden = true; renderHeader();
}
function openNotif(id) {
  const n = db.notifications.find(x => x.id === id);
  if (!n) return;
  n.read = true;
  saveDB();
  go(n.view || 'home');
}

// ---------- Assistant IA ----------
function ensureAIFab() {
  if (el('fab-ai-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'fab-ai-btn';
  btn.className = 'fab-ai';
  btn.title = t('aiAssistant');
  btn.innerHTML = icon('spark');
  btn.onclick = toggleAIPanel;
  document.body.appendChild(btn);
}
let aiHistory = [];
function toggleAIPanel() {
  const panel = el('ai-panel');
  if (!panel.hidden) { panel.hidden = true; return; }
  panel.hidden = false;
  if (!aiHistory.length) {
    aiHistory.push({ who: 'bot', text: prefs.lang === 'en'
      ? 'Hi! I\'m the INCO LAB assistant. Ask me about your tasks, meetings or messages.'
      : 'Bonjour ! Je suis l\'assistant INCO LAB. Posez-moi une question sur vos tâches, réunions ou messages.' });
  }
  renderAIPanel();
}
function renderAIPanel() {
  const panel = el('ai-panel');
  panel.innerHTML = `
    <div class="ai-head">
      <span style="display:flex;align-items:center;gap:8px"><span style="width:16px;height:16px;display:inline-flex;color:var(--accent)">${icon('spark')}</span>${esc(t('aiAssistant'))}</span>
      <button class="modal-close" onclick="el('ai-panel').hidden=true">✕</button>
    </div>
    <div class="ai-body" id="ai-body">
      ${aiHistory.map(m => `<div class="ai-bubble ${m.who === 'bot' ? 'bot' : 'me'}">${esc(m.text)}</div>`).join('')}
    </div>
    <div class="ai-foot">
      <input class="input" id="ai-input" placeholder="${esc(t('askAnything'))}" onkeydown="if(event.key==='Enter')askAI()" style="flex:1" />
      <button class="btn btn-primary" onclick="askAI()">${icon('send').replace('<svg', '<svg style="width:13px;height:13px"')}</button>
    </div>`;
  const body = el('ai-body');
  body.scrollTop = body.scrollHeight;
  el('ai-input').focus();
}
function askAI() {
  const input = el('ai-input');
  const q = input.value.trim();
  if (!q) return;
  aiHistory.push({ who: 'me', text: q });
  renderAIPanel();
  setTimeout(() => {
    aiHistory.push({ who: 'bot', text: aiAnswer(q) });
    renderAIPanel();
  }, 700);
}
function aiAnswer(q) {
  const needle = q.toLowerCase();
  const en = prefs.lang === 'en';
  const myCards = db.projects.filter(p => !p.archived)
    .flatMap(p => allCards(p).filter(c => c.assignee === state.user.id && !c.done));
  if (/t[âa]che|task|tarea|attivit/.test(needle)) {
    if (!myCards.length) return en ? 'You have no open tasks. Nice!' : 'Vous n\'avez aucune tâche ouverte. Bravo !';
    return (en ? `You have ${myCards.length} open task(s): ` : `Vous avez ${myCards.length} tâche(s) ouverte(s) : `)
      + myCards.slice(0, 4).map(c => c.title + (c.due ? ` (${c.due})` : '')).join(' · ');
  }
  if (/r[ée]union|meeting|riunion|reuni[óo]n|calendrier|calendar/.test(needle)) {
    const next = db.events.slice().sort((a, b) => a.offset - b.offset)[0];
    return next
      ? (en ? `Next meeting: "${next.title}"` : `Prochaine réunion : « ${next.title} »`) + (next.time ? ' · ' + next.time : '') + (next.offset === 0 ? (en ? ' today' : ' aujourd\'hui') : ` (+${next.offset} j)`)
      : (en ? 'No upcoming meetings.' : 'Aucune réunion à venir.');
  }
  if (/message|non lu|unread|mensaje|messagg/.test(needle)) {
    const unread = db.channels.reduce((s, c) => s + c.unread, 0);
    return en ? `You have ${unread} unread message(s) across your channels.` : `Vous avez ${unread} message(s) non lu(s) dans vos canaux.`;
  }
  if (/projet|project|progett|proyect/.test(needle)) {
    const ps = db.projects.filter(p => !p.archived);
    return (en ? 'Active projects: ' : 'Projets actifs : ') + ps.map(p => {
      const cards = allCards(p);
      const done = cards.filter(c => c.done).length;
      return `${p.name} (${Math.round(done / (cards.length || 1) * 100)}%)`;
    }).join(' · ');
  }
  if (/fichier|file|archivo|document/.test(needle)) {
    return (en ? `${db.files.length} files stored. Latest: ` : `${db.files.length} fichiers stockés. Dernier : `) + (db.files[0] ? db.files[0].name : '—');
  }
  return en
    ? 'I can help with your tasks, projects, meetings, messages and files. Try "my tasks" or "next meeting".'
    : 'Je peux vous aider sur vos tâches, projets, réunions, messages et fichiers. Essayez « mes tâches » ou « prochaine réunion ».';
}

// ---------- Fond dynamique (orbes animés, réagit au thème + souris) ----------
(function initBackground() {
  const canvas = el('bg-canvas');
  const ctx = canvas.getContext('2d');
  let w, h;
  const mouse = { x: .5, y: .5 };
  const ORBS = [
    { hue: [108, 139, 245], r: .34, sx: .18, sy: .28, ax: .13, ay: .10, spx: .00021, spy: .00017, ph: 0 },
    { hue: [155, 123, 240], r: .30, sx: .82, sy: .22, ax: .11, ay: .13, spx: .00017, spy: .00023, ph: 2.1 },
    { hue: [42, 157, 143],  r: .28, sx: .70, sy: .80, ax: .14, ay: .09, spx: .00019, spy: .00015, ph: 4.2 },
    { hue: [224, 96, 122],  r: .22, sx: .25, sy: .78, ax: .09, ay: .12, spx: .00024, spy: .00019, ph: 1.3 },
  ];
  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', e => {
    mouse.x = e.clientX / window.innerWidth;
    mouse.y = e.clientY / window.innerHeight;
  });
  resize();
  function frame(ts) {
    ctx.clearRect(0, 0, w, h);
    const dark = prefs.theme === 'dark';
    const alpha = dark ? .14 : .16;
    ORBS.forEach(o => {
      const px = (mouse.x - .5) * .05;
      const py = (mouse.y - .5) * .05;
      const x = (o.sx + Math.sin(ts * o.spx + o.ph) * o.ax + px) * w;
      const y = (o.sy + Math.cos(ts * o.spy + o.ph) * o.ay + py) * h;
      const r = o.r * Math.min(w, h) * (1 + Math.sin(ts * .0003 + o.ph) * .08);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${o.hue[0]},${o.hue[1]},${o.hue[2]},${alpha})`);
      g.addColorStop(1, `rgba(${o.hue[0]},${o.hue[1]},${o.hue[2]},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

// ---------- Simulation de présence (rend l'espace vivant) ----------
setInterval(() => {
  if (!state.user) return;
  const others = db.team.filter(m => m.id !== state.user.id);
  const pick = others[Math.floor(Math.random() * others.length)];
  const states = ['online', 'away', 'busy', 'offline'];
  pick.presence = states[Math.floor(Math.random() * states.length)];
  saveDB();
  if (state.view === 'messages') render();
  renderNav();
  renderHeader();
}, 25000);

// ---------- Démarrage ----------
(function boot() {
  loadPrefs();
  loadDB();
  document.documentElement.lang = prefs.lang;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const { id } = JSON.parse(raw);
      const m = id === 'guest'
        ? { id: 'guest', name: 'Invité', initials: 'IN', color: '#9298ab', role: 'GUEST', email: 'guest@incolab.com', presence: 'online' }
        : db.team.find(x => x.id === id);
      if (m && !m.locked) {
        state.user = { ...m };
        el('app-root').hidden = false;
        renderShell();
        render();
        return;
      }
    }
  } catch (e) { /* session invalide */ }
  renderAuth();
})();
