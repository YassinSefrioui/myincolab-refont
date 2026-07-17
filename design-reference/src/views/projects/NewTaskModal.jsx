import { useState } from 'react';
import { ModalHeader } from '../../components/Modal.jsx';
import { useApp } from '../../state/AppContext.jsx';
import { allCards } from '../../lib/helpers.js';

export default function NewTaskModal({ project, colId = 'backlog' }) {
  const { db, updateDB, user, closeModal, logActivity, notify, toast, t } = useApp();
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState(user.id);
  const [prio, setPrio] = useState('MEDIUM');
  const [label, setLabel] = useState(db.labels[0]?.name || '');
  const [due, setDue] = useState('');

  function createTask() {
    const trimmed = title.trim();
    if (!trimmed) return;
    const id = Math.max(0, ...db.projects.flatMap(pr => allCards(pr).map(c => c.id))) + 1;
    updateDB(draft => {
      const p = draft.projects.find(x => x.id === project.id);
      const col = p.columns.find(c => c.id === colId) || p.columns[0];
      col.cards.push({ id, title: trimmed, assignee, label, due: due.trim() || null, priority: prio, comments: [], subtasks: [], deps: [], done: false });
    });
    logActivity(`<b>${user.name.split(' ')[0]}</b> a créé <b>${trimmed}</b>`);
    notify(`${t('newTask')} : <b>${trimmed}</b>`, 'projects');
    closeModal();
    toast(t('taskCreated'));
  }

  return (
    <>
      <ModalHeader title={t('newTask')} />
      <label className="field-label">{t('description')}</label>
      <input className="input" placeholder={t('newTask') + '…'} value={title} onChange={e => setTitle(e.target.value)} autoFocus />
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label className="field-label">{t('assignee')}</label>
          <select className="select" value={assignee} onChange={e => setAssignee(e.target.value)}>
            {project.members.map(id => {
              const m = db.team.find(x => x.id === id);
              return <option value={id} key={id}>{m ? m.name : id}</option>;
            })}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label className="field-label">{t('priority')}</label>
          <select className="select" value={prio} onChange={e => setPrio(e.target.value)}>
            {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(x => <option value={x} key={x}>{t('prio_' + x)}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label className="field-label">{t('labels')}</label>
          <select className="select" value={label} onChange={e => setLabel(e.target.value)}>
            {db.labels.map(l => <option key={l.name}>{l.name}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label className="field-label">{t('dueDate')}</label>
          <input className="input" placeholder="ex : 18 juil." value={due} onChange={e => setDue(e.target.value)} />
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={closeModal}>{t('cancel')}</button>
        <button className="btn btn-primary" onClick={createTask}>{t('create')}</button>
      </div>
    </>
  );
}
