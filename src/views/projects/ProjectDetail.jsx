import { useRef, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import Avatar from '../../components/Avatar.jsx';
import DueTag from '../../components/DueTag.jsx';
import PrioBadge from '../../components/PrioBadge.jsx';
import MemberPicker from '../../components/MemberPicker.jsx';
import MemberProfileModal from '../../components/MemberProfileModal.jsx';
import ProjectMenu from './ProjectMenu.jsx';
import ProjectSwitcher from './ProjectSwitcher.jsx';
import NewTaskModal from './NewTaskModal.jsx';
import TaskModal from './TaskModal.jsx';
import { allCards, departmentName, hasGuestExecute, member, nextId, toISODate, fmtDate, unreadCount } from '../../lib/helpers.js';
import { useApp } from '../../state/AppContext.jsx';

function KanbanCard({ card, onOpen, onDragStart, onDragEnd, dragging }) {
  const { db, user } = useApp();
  const m = member(db, card.assignee);
  const canEdit = hasGuestExecute(user, 'projects');
  return (
    <div
      className={`kanban-card${dragging ? ' dragging' : ''}`}
      draggable={canEdit}
      onDragStart={() => canEdit && onDragStart(card.id)}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(card.id)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <span className="pill" style={{ background: 'var(--accent-soft-2)', color: 'var(--accent)' }}>{card.label}</span>
        <PrioBadge p={card.priority} />
      </div>
      <div className="kanban-card-title">{card.title}</div>
      {card.subtasks.length > 0 && (
        <div style={{ fontSize: 10, color: 'var(--muted)', margin: '-4px 0 8px' }}>
          ☑ {card.subtasks.filter(s => s.done).length}/{card.subtasks.length}
        </div>
      )}
      <div className="kanban-card-foot">
        <Avatar m={m} size="a20" />
        <div className="kanban-meta">
          {card.due && <DueTag due={card.due} />}
          {card.comments.length > 0 && <span><span className="cdot" />{card.comments.length}</span>}
        </div>
      </div>
    </div>
  );
}

const COL_NAMES_KEY = { backlog: null, progress: 'col_progress', review: 'col_review', done: 'col_done' };

function ProjectFilesTab({ p }) {
  const { db, updateDB, user, toast, logAudit, logActivity, t } = useApp();
  const uploadRef = useRef(null);
  const files = db.files.filter(f => f.where === p.name);

  function uploadFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    const size = f.size > 1048576 ? (f.size / 1048576).toFixed(1) + ' Mo' : Math.max(1, Math.round(f.size / 1024)) + ' Ko';
    updateDB(draft => {
      const existing = draft.files.find(x => x.name === f.name && x.where === p.name);
      if (existing) {
        existing.version++;
        existing.time = t('today');
      } else {
        draft.files.unshift({ id: nextId(draft.files), name: f.name, size, from: user.id, where: p.name, time: t('today'), folder: 'root', version: 1 });
      }
    });
    logAudit('FILE_UPLOADED', f.name, false);
    logActivity(`<b>${user.name.split(' ')[0]}</b> a téléversé <b>${f.name}</b>`);
    toast(t('upload') + ' ✓');
    e.target.value = '';
  }
  function renameFile(id) {
    const f = db.files.find(x => x.id === id);
    if (!f) return;
    const name = prompt(t('rename'), f.name);
    if (!name) return;
    updateDB(draft => { const df = draft.files.find(x => x.id === id); if (df) df.name = name.trim(); });
  }
  function deleteFile(id) {
    updateDB(draft => { draft.files = draft.files.filter(x => x.id !== id); });
    toast(t('delete') + ' ✓');
  }

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button className="btn btn-primary btn-sm" onClick={() => uploadRef.current?.click()}>↑ {t('upload')}</button>
        <input type="file" ref={uploadRef} hidden onChange={uploadFile} />
      </div>
      <div className="files-list">
        {files.map(f => (
          <div className="file-row" key={f.id} onClick={() => toast(t('download') + ' : ' + f.name)}>
            <span className="file-glyph" />
            <div className="file-main">
              <div className="file-name">
                {f.name}
                {f.version > 1 && <span className="tag-soft" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}> v{f.version}</span>}
              </div>
              <div className="file-meta">{member(db, f.from).name} · {f.time}</div>
            </div>
            <div className="file-actions">
              <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); renameFile(f.id); }}>{t('rename')}</button>
              <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); deleteFile(f.id); }}>{t('delete')}</button>
            </div>
            <div className="file-size">{f.size}</div>
          </div>
        ))}
        {!files.length && <div className="empty-note">{t('noResults')}</div>}
      </div>
    </div>
  );
}

function ProjectDecisionsTab({ p }) {
  const { db, updateDB, user, prefs, logActivity, openModal, t } = useApp();
  const [text, setText] = useState('');
  const decisions = p.decisions || [];

  function addDecision() {
    const v = text.trim();
    if (!v) return;
    updateDB(draft => {
      const dp = draft.projects.find(x => x.id === p.id);
      if (!dp.decisions) dp.decisions = [];
      dp.decisions.unshift({ id: nextId(dp.decisions), text: v, by: user.id, date: toISODate(new Date()) });
    });
    logActivity(`<b>${user.name.split(' ')[0]}</b> a enregistré une décision sur <b>${p.name}</b>`);
    setText('');
  }
  function deleteDecision(id) {
    updateDB(draft => {
      const dp = draft.projects.find(x => x.id === p.id);
      if (dp && dp.decisions) dp.decisions = dp.decisions.filter(d => d.id !== id);
    });
  }

  return (
    <div style={{ marginTop: 14, maxWidth: 720 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input" style={{ flex: 1 }} placeholder={t('newDecision')}
          value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addDecision(); }}
        />
        <button className="btn btn-primary" onClick={addDecision}>+ {t('create')}</button>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        {decisions.length ? decisions.map(d => {
          const m = member(db, d.by);
          return (
            <div className="decision-row" key={d.id}>
              <Avatar m={m} size="a30" />
              <div className="decision-body">
                <div className="decision-title">{d.text}</div>
                <div className="decision-meta">
                  <span className="name-link" onClick={() => openModal(<MemberProfileModal memberId={m.id} />)}>{m.name}</span> · {fmtDate(d.date, prefs.lang)}
                </div>
              </div>
              <button className="decision-del" title={t('delete')} onClick={() => deleteDecision(d.id)}>
                <Icon name="trash" />
              </button>
            </div>
          );
        }) : <div className="empty-note">{t('noDecisions')}</div>}
      </div>
    </div>
  );
}

function ProjectMembersTab({ p }) {
  const { db, updateDB, user, logActivity, toast, openModal, t } = useApp();
  const candidates = db.team.filter(m => !p.members.includes(m.id) && !m.locked);

  function addMember(id) {
    if (!id) return;
    updateDB(draft => {
      const dp = draft.projects.find(x => x.id === p.id);
      if (dp && !dp.members.includes(id)) dp.members.push(id);
    });
    logActivity(`<b>${user.name.split(' ')[0]}</b> a ajouté <b>${member(db, id).name}</b> à <b>${p.name}</b>`);
    toast(t('addMember') + ' ✓');
  }
  function removeMember(id) {
    updateDB(draft => {
      const dp = draft.projects.find(x => x.id === p.id);
      if (dp) dp.members = dp.members.filter(x => x !== id);
    });
  }

  return (
    <div style={{ marginTop: 14, maxWidth: 560 }}>
      {candidates.length > 0 && (
        <>
          <label className="field-label">{t('addMember')}</label>
          <MemberPicker candidates={candidates} selected={null} multi={false} onChange={addMember} />
        </>
      )}
      <div className="card" style={{ marginTop: 12 }}>
        {p.members.map(id => {
          const m = member(db, id);
          return (
            <div className="decision-row" key={id}>
              <Avatar m={m} size="a30" withPresence />
              <div className="decision-body">
                <div className="decision-title">
                  <span className="name-link" onClick={() => openModal(<MemberProfileModal memberId={id} />)}>{m.name}</span>{' '}
                  {m.role && <span className={`role-badge role-${m.role}`}>{m.role}</span>}
                </div>
                <div className="decision-meta">{[departmentName(db, m.departmentId), m.email].filter(Boolean).join(' · ')}</div>
              </div>
              {p.members.length > 1 && (
                <button className="decision-del" title={t('delete')} onClick={() => removeMember(id)}>
                  <Icon name="trash" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ProjectDetail({ projectId, onSwitch, onBack }) {
  const { db, updateDB, user, openModal, logActivity, notify, setUi, t } = useApp();
  const p = db.projects.find(x => x.id === projectId);
  const dragId = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [tab, setTab] = useState('tasks');

  if (!p) return <div className="empty-note view-anim">{t('noResults')}</div>;

  function openTaskModal(cardId) { openModal(<TaskModal cardId={cardId} />, { wide: true }); }
  function openNewTaskModal(colId) { openModal(<NewTaskModal project={p} colId={colId} />); }

  function moveCard(cardId, colId) {
    updateDB(draft => {
      const dp = draft.projects.find(x => x.id === projectId);
      let found = null;
      for (const col of dp.columns) {
        const card = col.cards.find(c => c.id === cardId);
        if (card) { found = { column: col, card }; break; }
      }
      if (!found || found.column.id === colId) return;
      const target = dp.columns.find(c => c.id === colId);
      if (!target) return;
      found.column.cards = found.column.cards.filter(c => c.id !== cardId);
      found.card.done = colId === 'done';
      target.cards.push(found.card);
    });
    const card = p.columns.flatMap(c => c.cards).find(c => c.id === cardId);
    const target = p.columns.find(c => c.id === colId);
    if (card && target) {
      logActivity(`<b>${user.name.split(' ')[0]}</b> a déplacé <b>${card.title}</b>`);
      notify(`<b>${card.title}</b> → ${target.title}`, 'projects');
    }
  }

  const projFilesCount = db.files.filter(f => f.where === p.name).length;
  const TABS = [
    { id: 'tasks', icon: 'tasks', label: t('tasks'), count: allCards(p).length },
    { id: 'files', icon: 'files', label: t('files'), count: projFilesCount },
    { id: 'decisions', icon: 'book', label: t('decisions'), count: (p.decisions || []).length },
    { id: 'members', icon: 'groups', label: t('members'), count: p.members.length },
  ];

  return (
    <div className="view-anim">
      <div className="proj-detail-head">
        <button className="proj-back" onClick={onBack} title={t('projects')}><Icon name="chevron" /></button>
        <ProjectSwitcher activeId={projectId} onSwitch={onSwitch} />
        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', display: 'flex', gap: 2 }}>
          {p.members.map(id => <Avatar key={id} m={member(db, id)} size="a20" />)}
        </span>
        <button
          className="btn btn-ghost"
          style={{ marginLeft: 'auto', position: 'relative' }}
          onClick={() => setUi({ view: 'messages', activeConvId: p.id })}
        >
          <Icon name="messages" style={{ width: 13, height: 13 }} /> {t('openDiscussion')}
          {unreadCount(db, p.id) > 0 && (
            <span style={{
              minWidth: 15, height: 15, padding: '0 4px', borderRadius: 8,
              background: 'var(--notif-dot)', color: '#fff', fontSize: 9, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>{unreadCount(db, p.id)}</span>
          )}
        </button>
        {hasGuestExecute(user, 'projects') && (
          <button className="btn btn-primary" onClick={() => openNewTaskModal('backlog')}>
            + {t('newTask')}
          </button>
        )}
        <ProjectMenu projectId={projectId} onAfterRemove={onBack} />
      </div>
      {p.description && <div style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '6px 0 0' }}>{p.description}</div>}

      <div className="proj-tabbar">
        {TABS.map(tb => (
          <button key={tb.id} className={`tab${tab === tb.id ? ' active' : ''}`} onClick={() => setTab(tb.id)}>
            <Icon name={tb.icon} /> {tb.label} <span className="count">{tb.count}</span>
          </button>
        ))}
      </div>

      {tab === 'tasks' && (
        <div className="kanban" style={{ marginTop: 14 }}>
          {p.columns.map(col => (
            <div
              key={col.id}
              className={`kanban-col${dragOverCol === col.id ? ' drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOverCol(col.id); }}
              onDragLeave={() => setDragOverCol(prev => (prev === col.id ? null : prev))}
              onDrop={e => {
                e.preventDefault();
                setDragOverCol(null);
                if (dragId.current != null) moveCard(dragId.current, col.id);
              }}
            >
              <div className="kanban-col-title">
                <span>{col.id === 'backlog' ? col.title : t(COL_NAMES_KEY[col.id])} · {col.cards.length}</span>
              </div>
              {col.cards.map(card => (
                <KanbanCard
                  key={card.id}
                  card={card}
                  onOpen={openTaskModal}
                  dragging={dragging === card.id}
                  onDragStart={id => { dragId.current = id; setDragging(id); }}
                  onDragEnd={() => setDragging(null)}
                />
              ))}
              {hasGuestExecute(user, 'projects') && (
                <button className="add-card-btn" onClick={() => openNewTaskModal(col.id)}>{t('addCard')}</button>
              )}
            </div>
          ))}
        </div>
      )}
      {tab === 'files' && <ProjectFilesTab p={p} />}
      {tab === 'decisions' && <ProjectDecisionsTab p={p} />}
      {tab === 'members' && <ProjectMembersTab p={p} />}
    </div>
  );
}
