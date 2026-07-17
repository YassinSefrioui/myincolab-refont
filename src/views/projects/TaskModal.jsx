import { useState } from 'react';
import { ModalHeader } from '../../components/Modal.jsx';
import Avatar from '../../components/Avatar.jsx';
import DueTag from '../../components/DueTag.jsx';
import Icon from '../../components/Icon.jsx';
import PrioBadge from '../../components/PrioBadge.jsx';
import MemberPicker from '../../components/MemberPicker.jsx';
import DatePicker from '../../components/DatePicker.jsx';
import { useApp } from '../../state/AppContext.jsx';
import { findCard, labelColor, member, nowTime } from '../../lib/helpers.js';

export default function TaskModal({ cardId }) {
  const { db, updateDB, user, closeModal, logActivity, toast, t } = useApp();
  const [newSub, setNewSub] = useState('');
  const [newComment, setNewComment] = useState('');

  const found = findCard(db, cardId);
  if (!found) return null;
  const { project: p, column: col, card } = found;
  const depsOk = card.deps.every(d => { const f = findCard(db, d); return f && f.card.done; });

  const [assignee, setAssignee] = useState(card.assignee);
  const [prio, setPrio] = useState(card.priority);
  const [due, setDue] = useState(card.due || '');

  function toggleSubtask(i) {
    updateDB(draft => {
      const f = findCard(draft, cardId);
      if (f) f.card.subtasks[i].done = !f.card.subtasks[i].done;
    });
  }
  function addSubtask() {
    const v = newSub.trim();
    if (!v) return;
    updateDB(draft => {
      const f = findCard(draft, cardId);
      if (f) f.card.subtasks.push({ text: v, done: false });
    });
    setNewSub('');
  }
  function addComment() {
    const v = newComment.trim();
    if (!v) return;
    updateDB(draft => {
      const f = findCard(draft, cardId);
      if (f) f.card.comments.push({ user: user.id, text: v, time: nowTime() });
    });
    logActivity(`<b>${user.name.split(' ')[0]}</b> a commenté <b>${card.title}</b>`);
    setNewComment('');
  }
  function saveTask() {
    updateDB(draft => {
      const f = findCard(draft, cardId);
      if (!f) return;
      f.card.assignee = assignee || f.card.assignee;
      f.card.priority = prio;
      f.card.due = due || null;
    });
    closeModal();
    toast(t('taskUpdated'));
  }
  function deleteTask() {
    updateDB(draft => {
      const f = findCard(draft, cardId);
      if (!f) return;
      f.column.cards = f.column.cards.filter(c => c.id !== cardId);
    });
    closeModal();
    toast(t('taskDeleted'));
  }

  return (
    <>
      <ModalHeader title={card.title} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '2px 0 6px' }}>
        <span className="pill" style={{ background: labelColor(db, card.label) }}>{card.label}</span>
        <PrioBadge p={card.priority} />
        <span className="tag-soft" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{col.title}</span>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{p.name}</span>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label className="field-label">{t('assignee')}</label>
          <MemberPicker
            candidates={p.members.map(id => db.team.find(x => x.id === id)).filter(Boolean)}
            selected={assignee} onChange={setAssignee} multi={false}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="field-label">{t('priority')}</label>
          <select className="select" value={prio} onChange={e => setPrio(e.target.value)}>
            {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(x => <option value={x} key={x}>{t('prio_' + x)}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label className="field-label">
            {t('dueDate')} {due && <DueTag due={due} compact />}
          </label>
          <DatePicker value={due} onChange={setDue} clearable />
        </div>
      </div>

      {card.deps.length > 0 && (
        <>
          <label className="field-label">{t('dependencies')}</label>
          <div style={{ fontSize: 12, color: depsOk ? 'var(--success)' : 'var(--warning)' }}>
            {card.deps.map(d => {
              const f = findCard(db, d);
              return f ? <div key={d}>{f.card.done ? '✅' : '⏳'} {f.card.title}</div> : null;
            })}
          </div>
        </>
      )}

      <label className="field-label">{t('subtasks')} ({card.subtasks.filter(s => s.done).length}/{card.subtasks.length})</label>
      <div>
        {card.subtasks.map((s, i) => (
          <div className="task-row" style={{ padding: '6px 0' }} key={i}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className={`task-check${s.done ? ' done' : ''}`} onClick={() => toggleSubtask(i)}>
                <Icon name="check" />
              </span>
              <span style={{ fontSize: 12.5, textDecoration: s.done ? 'line-through' : 'none', color: s.done ? 'var(--muted)' : undefined }}>{s.text}</span>
            </div>
          </div>
        ))}
      </div>
      <input className="input" placeholder={t('addSubtask')} value={newSub}
        onChange={e => setNewSub(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') addSubtask(); }}
        style={{ marginTop: 6 }} />

      <label className="field-label">{t('comments')} ({card.comments.length})</label>
      <div style={{ maxHeight: 150, overflowY: 'auto' }}>
        {card.comments.length ? card.comments.map((c, i) => (
          <div style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-lt)' }} key={i}>
            <Avatar m={member(db, c.user)} size="a20" />
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700 }}>{member(db, c.user).name}</span>
              <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 6 }}>{c.time}</span>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{c.text}</div>
            </div>
          </div>
        )) : <div className="empty-note" style={{ padding: '8px 0' }}>—</div>}
      </div>
      <input className="input" placeholder={t('addComment')} value={newComment}
        onChange={e => setNewComment(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') addComment(); }}
        style={{ marginTop: 6 }} />

      <div className="modal-foot">
        <button className="btn btn-danger" onClick={deleteTask}>{t('deleteTask')}</button>
        <button className="btn btn-primary" onClick={saveTask}>{t('saveTask')}</button>
      </div>
    </>
  );
}
