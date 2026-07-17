export function member(db, id) {
  return db.team.find(m => m.id === id) || { name: '?', initials: '?', color: '#9298ab', presence: 'offline' };
}
export function labelColor(db, name) {
  const l = db.labels.find(l => l.name === name);
  return l ? l.color : '#9298ab';
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
export function nowTime(lang) {
  return new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : 'fr-FR', { hour: '2-digit', minute: '2-digit' });
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
  return allCards(p).filter(c => !c.done && /en retard|overdue|atrasad|ritardo/i.test(c.due || '')).length;
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

export function discussionUnreadTotal(db) {
  return db.projects.reduce((s, p) => s + (p.unread || 0), 0);
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
