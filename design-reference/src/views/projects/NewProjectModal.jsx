import { useState } from 'react';
import Avatar from '../../components/Avatar.jsx';
import { ModalHeader } from '../../components/Modal.jsx';
import { useApp } from '../../state/AppContext.jsx';

export default function NewProjectModal({ onCreated }) {
  const { db, updateDB, user, closeModal, logAudit, logActivity, toast, t } = useApp();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [members, setMembers] = useState([user.id]);

  function toggleMember(id) {
    setMembers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function createProject() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = 'p' + Date.now();
    updateDB(draft => {
      draft.projects.push({
        id, name: trimmed, archived: false, description: desc.trim(),
        members: members.length ? members : [user.id],
        columns: [
          { id: 'backlog', title: 'Backlog', cards: [] },
          { id: 'progress', title: 'In Progress', cards: [] },
          { id: 'review', title: 'Review', cards: [] },
          { id: 'done', title: 'Done', cards: [] },
        ],
      });
    });
    logAudit('PROJECT_CREATED', trimmed, false);
    logActivity(`<b>${user.name.split(' ')[0]}</b> a créé le projet <b>${trimmed}</b>`);
    closeModal();
    toast(t('taskCreated').replace('!', '') + ' ✓');
    if (onCreated) onCreated(id);
  }

  return (
    <>
      <ModalHeader title={t('newProject')} />
      <label className="field-label">{t('projectName')}</label>
      <input className="input" value={name} onChange={e => setName(e.target.value)} autoFocus />
      <label className="field-label">{t('description')}</label>
      <textarea className="textarea" value={desc} onChange={e => setDesc(e.target.value)} />
      <label className="field-label">{t('members')}</label>
      <div className="member-chips">
        {db.team.map(m => (
          <label className="member-chip" style={{ cursor: 'pointer' }} key={m.id}>
            <input type="checkbox" checked={members.includes(m.id)} onChange={() => toggleMember(m.id)} />
            <Avatar m={m} size="a20" /> {m.name}
          </label>
        ))}
      </div>
      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={closeModal}>{t('cancel')}</button>
        <button className="btn btn-primary" onClick={createProject}>{t('createProject')}</button>
      </div>
    </>
  );
}
