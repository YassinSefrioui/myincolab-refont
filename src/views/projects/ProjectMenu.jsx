import { useEffect, useRef, useState } from 'react';
import { ModalHeader } from '../../components/Modal.jsx';
import Icon from '../../components/Icon.jsx';
import MemberPicker from '../../components/MemberPicker.jsx';
import { useApp } from '../../state/AppContext.jsx';

function EditProjectModal({ projectId }) {
  const { db, updateDB, closeModal, logAudit, toast, t } = useApp();
  const p = db.projects.find(x => x.id === projectId);
  const [name, setName] = useState(p ? p.name : '');
  const [desc, setDesc] = useState(p ? (p.description || '') : '');
  const [leadId, setLeadId] = useState(p ? p.leadId : null);
  if (!p) return null;

  const leadCandidates = p.members.map(id => db.team.find(m => m.id === id)).filter(Boolean);

  function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    updateDB(draft => {
      const dp = draft.projects.find(x => x.id === projectId);
      if (!dp) return;
      dp.name = trimmed;
      dp.description = desc.trim();
      if (leadId && dp.members.includes(leadId)) dp.leadId = leadId;
    });
    logAudit('PROJECT_UPDATED', trimmed, false);
    closeModal();
    toast(t('projectUpdated'));
  }

  return (
    <>
      <ModalHeader title={t('editProject')} />
      <label className="field-label">{t('projectName')}</label>
      <input className="input" value={name} autoFocus
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); }} />
      <label className="field-label">{t('description')}</label>
      <textarea className="textarea" value={desc} onChange={e => setDesc(e.target.value)} />
      <label className="field-label">{t('projectLead')}</label>
      <MemberPicker candidates={leadCandidates} selected={leadId} onChange={id => setLeadId(id)} multi={false} placeholder={t('projectLead')} />
      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={closeModal}>{t('cancel')}</button>
        <button className="btn btn-primary" onClick={save}>{t('save')}</button>
      </div>
    </>
  );
}

function DeleteModal({ projectId, onAfterRemove }) {
  const { db, updateDB, closeModal, logAudit, toast, t } = useApp();
  const p = db.projects.find(x => x.id === projectId);
  if (!p) return null;

  function doDelete() {
    updateDB(draft => {
      draft.projects = draft.projects.filter(x => x.id !== projectId);
      delete draft.messagesByConv[projectId];
    });
    logAudit('PROJECT_DELETED', p.name, true);
    closeModal();
    toast(t('projectDeleted'));
    if (onAfterRemove) onAfterRemove();
  }

  return (
    <>
      <ModalHeader title={t('deleteProject')} />
      <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '4px 0 0' }}>
        {t('confirmDeleteProject')} <b style={{ color: 'var(--text)' }}>{p.name}</b>
      </p>
      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={closeModal}>{t('cancel')}</button>
        <button className="btn btn-danger" onClick={doDelete}>{t('deleteProject')}</button>
      </div>
    </>
  );
}

/**
 * Menu contextuel ⋯ d'un projet : renommer, archiver/désarchiver, supprimer.
 * Utilisé sur les cartes de la liste et dans l'en-tête du détail projet.
 */
export default function ProjectMenu({ projectId, onAfterRemove }) {
  const { db, updateDB, openModal, logAudit, toast, t } = useApp();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const p = db.projects.find(x => x.id === projectId);

  useEffect(() => {
    if (!open) return;
    const onDown = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  if (!p) return null;

  function toggleArchive() {
    setOpen(false);
    updateDB(draft => {
      const dp = draft.projects.find(x => x.id === projectId);
      if (dp) dp.archived = !dp.archived;
    });
    logAudit(p.archived ? 'PROJECT_UNARCHIVED' : 'PROJECT_ARCHIVED', p.name, false);
    toast(p.archived ? t('projectUnarchived') : t('projectArchived'));
    if (!p.archived && onAfterRemove) onAfterRemove();
  }

  function toggleCompleted() {
    setOpen(false);
    updateDB(draft => {
      const dp = draft.projects.find(x => x.id === projectId);
      if (dp) dp.completed = !dp.completed;
    });
    logAudit(p.completed ? 'PROJECT_REOPENED' : 'PROJECT_COMPLETED', p.name, false);
    toast(p.completed ? t('projectReopened') : t('projectMarkedCompleted'));
  }

  return (
    <span className="proj-menu-wrap" ref={wrapRef} onClick={e => e.stopPropagation()}>
      <button className="proj-menu-btn" title={t('projectOptions')} onClick={() => setOpen(o => !o)}>⋯</button>
      {open && (
        <div className="proj-menu">
          <button className="proj-menu-item" onClick={() => { setOpen(false); openModal(<EditProjectModal projectId={projectId} />, { wide: true }); }}>
            <Icon name="edit" /> {t('editProject')}
          </button>
          <button className="proj-menu-item" onClick={toggleCompleted}>
            <Icon name="check" /> {p.completed ? t('markProjectActive') : t('markProjectCompleted')}
          </button>
          <button className="proj-menu-item" onClick={toggleArchive}>
            <Icon name="box" /> {p.archived ? t('unarchiveProject') : t('archiveProject')}
          </button>
          <div className="proj-menu-sep" />
          <button className="proj-menu-item danger" onClick={() => { setOpen(false); openModal(<DeleteModal projectId={projectId} onAfterRemove={onAfterRemove} />); }}>
            <Icon name="trash" /> {t('deleteProject')}
          </button>
        </div>
      )}
    </span>
  );
}
