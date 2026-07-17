import { useState } from 'react';
import { ModalHeader } from '../../components/Modal.jsx';
import MemberPicker from '../../components/MemberPicker.jsx';
import { useApp } from '../../state/AppContext.jsx';

export default function NewProjectModal({ onCreated }) {
  const { db, updateDB, user, closeModal, logAudit, logActivity, toast, t } = useApp();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [members, setMembers] = useState([user.id]);
  const [templateId, setTemplateId] = useState(null);

  function pickTemplate(id) {
    setTemplateId(id);
    if (id) {
      const tpl = db.templates.find(x => x.id === id);
      if (tpl && !name.trim()) setName(tpl.name);
    }
  }

  function createProject() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = 'p' + Date.now();
    const tpl = templateId ? db.templates.find(x => x.id === templateId) : null;
    const backlogCards = tpl
      ? tpl.tasks.map((title, i) => ({
          id: i + 1, title, assignee: user.id, label: tpl.label, due: null,
          priority: 'MEDIUM', comments: [], subtasks: [], deps: [], done: false,
        }))
      : [];
    updateDB(draft => {
      draft.projects.push({
        id, name: trimmed, archived: false, description: desc.trim(),
        members: members.length ? members : [user.id],
        columns: [
          { id: 'backlog', title: 'Backlog', cards: backlogCards },
          { id: 'progress', title: 'In Progress', cards: [] },
          { id: 'review', title: 'Review', cards: [] },
          { id: 'done', title: 'Done', cards: [] },
        ],
      });
    });
    logAudit('PROJECT_CREATED', trimmed + (tpl ? ` (${t('fromTemplate')} : ${tpl.name})` : ''), false);
    logActivity(`<b>${user.name.split(' ')[0]}</b> a créé le projet <b>${trimmed}</b>`);
    closeModal();
    toast(t('taskCreated').replace('!', '') + ' ✓');
    if (onCreated) onCreated(id);
  }

  return (
    <>
      <ModalHeader title={t('newProject')} />
      <label className="field-label">{t('fromTemplate')}</label>
      <div className="tabs" style={{ marginBottom: 4 }}>
        <button className={`tab${templateId === null ? ' active' : ''}`} onClick={() => pickTemplate(null)}>
          {t('blankProject')}
        </button>
        {db.templates.map(tpl => (
          <button key={tpl.id} className={`tab${templateId === tpl.id ? ' active' : ''}`} onClick={() => pickTemplate(tpl.id)}>
            {tpl.name} <span style={{ fontWeight: 500, opacity: .65 }}>· {tpl.tasks.length} {t('templateTasks')}</span>
          </button>
        ))}
      </div>
      <label className="field-label">{t('projectName')}</label>
      <input className="input" value={name} onChange={e => setName(e.target.value)} autoFocus />
      <label className="field-label">{t('description')}</label>
      <textarea className="textarea" value={desc} onChange={e => setDesc(e.target.value)} />
      <label className="field-label">{t('members')}</label>
      <MemberPicker candidates={db.team.filter(m => !m.locked)} selected={members} onChange={setMembers} />

      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={closeModal}>{t('cancel')}</button>
        <button className="btn btn-primary" onClick={createProject}>{t('createProject')}</button>
      </div>
    </>
  );
}
