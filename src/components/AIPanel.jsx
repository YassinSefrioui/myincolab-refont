import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { allCards, discussionUnreadTotal } from '../lib/helpers.js';
import { useApp } from '../state/AppContext.jsx';

function aiAnswer(db, user, lang, q) {
  const needle = q.toLowerCase();
  const en = lang === 'en';
  const myCards = db.projects.filter(p => !p.archived)
    .flatMap(p => allCards(p).filter(c => c.assignee === user.id && !c.done));
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
    const unread = discussionUnreadTotal(db);
    return en ? `You have ${unread} unread message(s) across your project discussions.` : `Vous avez ${unread} message(s) non lu(s) dans vos discussions de projet.`;
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

export default function AIPanel() {
  const { db, user, prefs, ui, aiOpen, setAiOpen, aiHistory, setAiHistory, t } = useApp();
  const [input, setInput] = useState('');
  const bodyRef = useRef(null);

  useEffect(() => {
    if (aiOpen && !aiHistory.length) {
      setAiHistory([{ who: 'bot', text: prefs.lang === 'en'
        ? 'Hi! I\'m the INCO LAB assistant. Ask me about your tasks, meetings or messages.'
        : 'Bonjour ! Je suis l\'assistant INCO LAB. Posez-moi une question sur vos tâches, réunions ou messages.' }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiOpen]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [aiHistory, aiOpen]);

  // Masquée sur la page Messages : la discussion a déjà son propre résumé IA dans l'en-tête.
  useEffect(() => { if (ui.view === 'messages') setAiOpen(false); }, [ui.view, setAiOpen]);

  if (!user || ui.view === 'messages') return null;

  function ask() {
    const q = input.trim();
    if (!q) return;
    setAiHistory(h => [...h, { who: 'me', text: q }]);
    setInput('');
    setTimeout(() => {
      setAiHistory(h => [...h, { who: 'bot', text: aiAnswer(db, user, prefs.lang, q) }]);
    }, 700);
  }

  return (
    <>
      <button id="fab-ai-btn" className="fab-ai" title={t('aiAssistant')} onClick={() => setAiOpen(o => !o)}>
        <Icon name="spark" />
      </button>
      {aiOpen && (
        <div className="ai-panel" id="ai-panel">
          <div className="ai-head">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 16, height: 16, display: 'inline-flex', color: 'var(--accent)' }}><Icon name="spark" /></span>
              {t('aiAssistant')}
            </span>
            <button className="modal-close" onClick={() => setAiOpen(false)}>✕</button>
          </div>
          <div className="ai-body" id="ai-body" ref={bodyRef}>
            {aiHistory.map((m, i) => <div className={`ai-bubble ${m.who === 'bot' ? 'bot' : 'me'}`} key={i}>{m.text}</div>)}
          </div>
          <div className="ai-foot">
            <input
              className="input" id="ai-input" placeholder={t('askAnything')} style={{ flex: 1 }}
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') ask(); }}
            />
            <button className="btn btn-primary" onClick={ask}>
              <span style={{ width: 13, height: 13, display: 'inline-flex' }}><Icon name="send" /></span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
