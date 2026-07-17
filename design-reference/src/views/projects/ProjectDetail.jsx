import { useRef, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import Avatar from '../../components/Avatar.jsx';
import PrioBadge from '../../components/PrioBadge.jsx';
import ProjectSwitcher from './ProjectSwitcher.jsx';
import NewTaskModal from './NewTaskModal.jsx';
import TaskModal from './TaskModal.jsx';
import { member } from '../../lib/helpers.js';
import { useApp } from '../../state/AppContext.jsx';

function KanbanCard({ card, onOpen, onDragStart, onDragEnd, dragging }) {
  const { db } = useApp();
  const m = member(db, card.assignee);
  return (
    <div
      className={`kanban-card${dragging ? ' dragging' : ''}`}
      draggable="true"
      onDragStart={() => onDragStart(card.id)}
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
          {card.due && <span>{card.due}</span>}
          {card.comments.length > 0 && <span><span className="cdot" />{card.comments.length}</span>}
        </div>
      </div>
    </div>
  );
}

const COL_NAMES_KEY = { backlog: null, progress: 'col_progress', review: 'col_review', done: 'col_done' };

export default function ProjectDetail({ projectId, onSwitch, onBack }) {
  const { db, updateDB, user, openModal, logActivity, notify, setUi, t } = useApp();
  const p = db.projects.find(x => x.id === projectId);
  const dragId = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

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
          {p.unread > 0 && (
            <span style={{
              minWidth: 15, height: 15, padding: '0 4px', borderRadius: 8,
              background: 'var(--notif-dot)', color: '#fff', fontSize: 9, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>{p.unread}</span>
          )}
        </button>
        <button className="btn btn-primary" onClick={() => openNewTaskModal('backlog')}>
          + {t('newTask')}
        </button>
      </div>
      {p.description && <div style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '6px 0 16px' }}>{p.description}</div>}

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
            <button className="add-card-btn" onClick={() => openNewTaskModal(col.id)}>{t('addCard')}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
