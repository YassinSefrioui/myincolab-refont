export function member(db, id) {
  return db.team.find(m => m.id === id) || { name: '?', initials: '?', color: '#9298ab', presence: 'offline' };
}
export function labelColor(db, name) {
  const l = db.labels.find(l => l.name === name);
  return l ? l.color : '#9298ab';
}
export function departmentName(db, id) {
  if (!id) return '';
  const d = (db.departments || []).find(x => x.id === id);
  return d ? d.name : '';
}
export function visibleProjectsForProfile(db, memberId) {
  const m = db.team.find(x => x.id === memberId);
  const hidden = new Set((m && m.hiddenProjectsOnProfile) || []);
  return db.projects.filter(p => !p.archived && p.members.includes(memberId) && !hidden.has(p.id));
}
export function project(db, id) {
  return db.projects.find(p => p.id === id);
}
export function allCards(p) {
  return p.columns.flatMap(c => c.cards);
}
export function findCard(db, cardId) {
  for (const p of db.projects) {
    for (const col of p.columns) {
      const card = col.cards.find(c => c.id === cardId);
      if (card) return { project: p, column: col, card };
    }
  }
  return null;
}
export function nextId(list) {
  return list.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1;
}
export const LOCALES = { fr: 'fr-FR', en: 'en-US', es: 'es-ES', it: 'it-IT', zh: 'zh-CN' };

export function nowTime(lang) {
  return new Date().toLocaleTimeString(LOCALES[lang] || 'fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/* ---------- Échéances (dates ISO AAAA-MM-JJ) ---------- */
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function toISODate(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Jours restants jusqu'à l'échéance (négatif = en retard), null si pas une date ISO. */
export function daysLeft(due) {
  if (!due || !ISO_RE.test(due)) return null;
  const [y, m, d] = due.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
}

export function fmtDate(due, lang) {
  if (!due || !ISO_RE.test(due)) return due || '';
  const [y, m, d] = due.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(LOCALES[lang] || 'fr-FR', { day: 'numeric', month: 'short' });
}

/** Date complète lisible ("17 juillet 2026") à partir d'une date ISO AAAA-MM-JJ. */
export function fmtDateFull(due, lang) {
  if (!due || !ISO_RE.test(due)) return due || '';
  const [y, m, d] = due.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(LOCALES[lang] || 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export const DOW_LABELS = {
  fr: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  es: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
  it: ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'],
  zh: ['一', '二', '三', '四', '五', '六', '日'],
};

/** Date + heure lisibles à partir d'un timestamp (epoch ms), ex. "14 juil. · 09:32". */
export function fmtDateTime(ts, lang) {
  if (!ts) return '';
  const d = new Date(ts);
  const locale = LOCALES[lang] || 'fr-FR';
  const date = d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

/* ---------- Type de fichier (icône + couleur) d'après l'extension ---------- */
const FILE_KINDS = {
  pdf: { icon: 'filePdf', color: 'var(--danger)' },
  doc: { icon: 'fileDoc', color: 'var(--accent)' }, docx: { icon: 'fileDoc', color: 'var(--accent)' },
  txt: { icon: 'fileDoc', color: 'var(--accent)' }, rtf: { icon: 'fileDoc', color: 'var(--accent)' },
  xls: { icon: 'fileSheet', color: 'var(--success)' }, xlsx: { icon: 'fileSheet', color: 'var(--success)' },
  csv: { icon: 'fileSheet', color: 'var(--success)' },
  png: { icon: 'fileImage', color: '#9b7bf0' }, jpg: { icon: 'fileImage', color: '#9b7bf0' },
  jpeg: { icon: 'fileImage', color: '#9b7bf0' }, gif: { icon: 'fileImage', color: '#9b7bf0' },
  svg: { icon: 'fileImage', color: '#9b7bf0' }, fig: { icon: 'fileImage', color: '#9b7bf0' },
  sketch: { icon: 'fileImage', color: '#9b7bf0' },
};
export function fileKind(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return FILE_KINDS[ext] || { icon: 'files', color: 'var(--muted)' };
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp']);
const VIDEO_EXTS = new Set(['mp4', 'mov', 'webm', 'avi', 'mkv']);
/** Classe une pièce jointe en 'image' | 'video' | 'document' d'après son extension. */
export function mediaKind(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (VIDEO_EXTS.has(ext)) return 'video';
  return 'document';
}

/** Libellé + tonalité du compte à rebours d'échéance. */
export function dueInfo(due, t) {
  const n = daysLeft(due);
  if (n === null) return null;
  if (n < 0) return { n, text: t('daysOverdueFmt').replace('{n}', -n), tone: 'overdue' };
  if (n === 0) return { n, text: t('dueTodayShort'), tone: 'today' };
  if (n === 1) return { n, text: t('dueTomorrowShort'), tone: 'soon' };
  return { n, text: t('daysLeftFmt').replace('{n}', n), tone: n <= 3 ? 'soon' : 'ok' };
}

export const PRIO_STYLE = {
  LOW:    { background: 'rgba(75,179,122,.15)', color: '#3a9d68' },
  MEDIUM: { background: 'rgba(91,141,239,.15)', color: '#4a76d0' },
  HIGH:   { background: 'rgba(240,160,75,.18)', color: '#d18334' },
  URGENT: { background: 'rgba(229,72,77,.15)', color: '#e5484d' },
};

export function projectDone(p) {
  const cards = allCards(p);
  return cards.length > 0 && cards.every(c => c.done);
}
export function projectProgress(p) {
  const cards = allCards(p);
  if (!cards.length) return 0;
  return Math.round(cards.filter(c => c.done).length / cards.length * 100);
}
export function projectOverdueCount(p) {
  return allCards(p).filter(c => {
    if (c.done) return false;
    const n = daysLeft(c.due);
    return n !== null && n < 0;
  }).length;
}

export function convLabel(db, id) {
  const p = db.projects.find(x => x.id === id);
  if (p) return p.name;
  const dm = db.dms.find(d => d.id === id);
  if (dm) return member(db, dm.user).name;
  const gc = db.groupChats.find(g => g.id === id);
  if (gc) return gc.name;
  return id;
}

/** Nombre de messages non lus dans une conversation, basé sur le marqueur de lecture. */
export function unreadCount(db, convId) {
  const list = db.messagesByConv[convId] || [];
  if (!list.length) return 0;
  const marker = (db.readMarkers && db.readMarkers[convId]) || 0;
  return list.filter(m => m.id > marker).length;
}
/** Marque une conversation comme lue jusqu'au dernier message (à appeler dans un updateDB). */
export function markConvRead(draft, convId) {
  const list = draft.messagesByConv[convId] || [];
  const lastId = list.length ? list[list.length - 1].id : 0;
  if (!draft.readMarkers) draft.readMarkers = {};
  draft.readMarkers[convId] = lastId;
}
export function discussionUnreadTotal(db) {
  const ids = [
    ...db.projects.filter(p => !p.archived).map(p => p.id),
    ...db.dms.map(d => d.id),
    ...db.groupChats.map(g => g.id),
  ];
  return ids.reduce((s, id) => s + unreadCount(db, id), 0);
}

/** Décisions de tous les projets actifs, les plus récentes en premier. */
export function recentDecisions(db, limit = 5) {
  return db.projects
    .filter(p => !p.archived)
    .flatMap(p => (p.decisions || []).map(d => ({ ...d, projectName: p.name, projectId: p.id })))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id))
    .slice(0, limit);
}

/** Nombre de tâches actives (non terminées) par membre, à travers les projets actifs. */
export function taskCountByMember(db) {
  const counts = new Map();
  db.projects.filter(p => !p.archived).forEach(p => {
    allCards(p).filter(c => !c.done).forEach(c => {
      counts.set(c.assignee, (counts.get(c.assignee) || 0) + 1);
    });
  });
  return db.team
    .filter(m => !m.locked)
    .map(m => ({ id: m.id, count: counts.get(m.id) || 0 }))
    .sort((a, b) => b.count - a.count);
}

export const QUICK_REACTIONS = ['👍', '❤️', '😄', '🎉', '👀'];

export function lastMessage(db, convId) {
  const list = db.messagesByConv[convId] || [];
  return list.length ? list[list.length - 1] : null;
}
export function previewText(db, m) {
  if (!m) return '';
  if (m.file) return '📎 ' + m.file.name;
  return m.text.length > 42 ? m.text.slice(0, 42) + '…' : m.text;
}

export const GUEST_PERMISSION_KEYS = ['projects', 'files', 'messages', 'meet', 'calendar', 'groups', 'announcements'];

export function isGuestCodeExpired(gc) {
  return !!(gc && gc.validityType === 'time' && gc.expiresAt && Date.now() > gc.expiresAt);
}

export function buildGuestUser(gc = {}) {
  const nameParts = (gc.name || '').trim().split(/\s+/).filter(Boolean);
  const fullName = nameParts.join(' ') || 'Invité';
  const initials = ((nameParts[0] || '')[0] || '') + ((nameParts[1] || '')[0] || '');
  const perms = gc.permissions || {};
  const allowedViews = GUEST_PERMISSION_KEYS.filter(k => perms[k] && perms[k] !== 'none');
  return {
    id: 'guest', name: fullName, initials: (initials || 'IN').toUpperCase(), color: '#9298ab',
    role: 'GUEST', email: gc.email || 'guest@incolab.com', presence: 'online',
    guestCodeId: gc.id || null,
    allowedProjectIds: gc.scopeProjectId ? [gc.scopeProjectId] : null,
    allowedGroupIds: gc.scopeGroupId ? [gc.scopeGroupId] : null,
    allowedViews,
    guestPermissions: perms,
  };
}

export function hasGuestExecute(user, key) {
  if (!user || user.role !== 'GUEST') return true;
  return !!(user.guestPermissions && user.guestPermissions[key] === 'execute');
}

export function visibleProjectsFor(db, user) {
  if (!user || !user.allowedProjectIds) return db.projects;
  return db.projects.filter(p => user.allowedProjectIds.includes(p.id));
}
