// ============================================================
// INCO LAB — Vues : Accueil, Projets/Kanban, Calendrier
// ============================================================

// ---------------- ACCUEIL ----------------
function renderHome() {
  const me = state.user;
  const h = new Date().getHours();
  const greet = h < 12 ? t('greetingMorning') : h < 18 ? t('greetingAfternoon') : t('greetingEvening');
  const firstName = me.name.split(' ')[0];

  const openCards = db.projects.filter(p => !p.archived)
    .flatMap(p => allCards(p).filter(c => !c.done).map(c => ({ ...c, projectName: p.name, projectId: p.id })));
  const mine = openCards.filter(c => c.assignee === me.id);
  // Repli fidèle à la DA : si rien ne m'est assigné, afficher les tâches à échéance
  const myCards = mine.length ? mine : openCards.filter(c => c.due);
  const dueToday = myCards.filter(c => c.due && /aujourd|today|oggi|hoy/i.test(c.due)).length;
  const unread = db.channels.reduce((s, c) => s + c.unread, 0);
  const eventsToday = db.events.filter(e => e.offset === 0).length;
  const nextEvt = db.events.slice().sort((a, b) => a.offset - b.offset)[0];

  const tasksHTML = myCards.length
    ? myCards.slice(0, 6).map(c => `
      <div class="task-row">
        <div style="display:flex;align-items:center;gap:10px;min-width:0">
          <span class="task-check${c.done ? ' done' : ''}" onclick="toggleTaskDone(${c.id})">${icon('check')}</span>
          <span class="task-title" onclick="openTaskModal(${c.id})">${esc(c.title)}</span>
        </div>
        <span class="task-due${/aujourd|today|oggi|hoy/i.test(c.due || '') ? ' overdue' : ''}">${esc(c.due || c.projectName)}</span>
      </div>`).join('')
    : `<div class="empty-note">🎉 ${esc(t('noResults'))}</div>`;

  el('content').innerHTML = `
    <div class="view-anim">
      <h1 class="home-greeting">${esc(greet)}, ${esc(firstName)}</h1>
      <p class="home-sub">${esc(t('homeSub'))}</p>

      <div class="stats-row">
        <div class="card stat-card" onclick="go('projects')">
          <div class="stat-value">${dueToday}</div><div class="stat-label">${esc(t('tasksDueToday'))}</div>
        </div>
        <div class="card stat-card" onclick="go('messages')">
          <div class="stat-value">${unread}</div><div class="stat-label">${esc(t('unreadMessages'))}</div>
        </div>
        <div class="card stat-card" onclick="go('calendar')">
          <div class="stat-value">${eventsToday}</div><div class="stat-label">${esc(t('meetingsToday'))}</div>
        </div>
        <div class="card stat-card" onclick="go('projects')">
          <div class="stat-value">${myCards.length}</div><div class="stat-label">${esc(t('openIssues'))}</div>
        </div>
      </div>

      <div class="home-cols">
        <div class="card home-left">
          <div style="font-size:13px;font-weight:700;margin-bottom:12px">${esc(t('myTasks'))}</div>
          ${tasksHTML}
        </div>
        <div class="home-right">
          <div class="card">
            <div class="section-label">${esc(t('nextMeeting'))}</div>
            <div style="font-size:14px;font-weight:700">${esc(nextEvt ? nextEvt.title : '—')}</div>
            <div style="font-size:12px;color:var(--text-2);margin:3px 0 10px">
              ${nextEvt ? esc((nextEvt.offset === 0 ? t('today') : '+' + nextEvt.offset + ' j') + (nextEvt.time ? ' · ' + nextEvt.time : '')) : ''}
              ${nextEvt ? ' · ' + nextEvt.with.slice(0, 3).map(id => esc(member(id).name.split(' ')[0])).join(', ') + (nextEvt.with.length > 3 ? ' +' + (nextEvt.with.length - 3) : '') : ''}
            </div>
            <button class="btn btn-primary" onclick="go('meet')">${esc(t('join'))}</button>
          </div>
          <div class="card">
            <div class="section-label">${esc(t('recentActivity'))}</div>
            ${db.activity.slice(0, 5).map(a => `<div class="activity-row">${a}</div>`).join('')}
          </div>
        </div>
      </div>
    </div>`;
}

function toggleTaskDone(cardId) {
  const found = findCard(cardId);
  if (!found) return;
  found.card.done = !found.card.done;
  if (found.card.done) {
    const doneCol = found.project.columns.find(c => c.id === 'done');
    if (doneCol && found.column !== doneCol) {
      found.column.cards = found.column.cards.filter(c => c.id !== cardId);
      doneCol.cards.push(found.card);
    }
    logActivity(`<b>${esc(state.user.name.split(' ')[0])}</b> a terminé <b>${esc(found.card.title)}</b>`);
  }
  saveDB();
  render();
  toast(t('taskUpdated'));
}

// ---------------- PROJETS ----------------
function renderProjects() {
  const tabs = [
    ['kanban', t('kanbanView')], ['list', t('listView')], ['analytics', t('analyticsView')],
    ['templates', t('templates')], ['archived', t('archived')],
  ];
  const visible = db.projects.filter(p => !p.archived);
  const proj = project(state.activeProjectId);
  const activeProj = (proj && !proj.archived) ? proj : visible[0];
  if (activeProj) state.activeProjectId = activeProj.id;

  let body = '';
  if (state.projectView === 'templates') body = renderTemplates();
  else if (state.projectView === 'archived') body = renderArchivedProjects();
  else if (!activeProj) body = `<div class="empty-note">${esc(t('noResults'))} — <span class="link-accent" onclick="openNewProjectModal()">${esc(t('newProject'))}</span></div>`;
  else if (state.projectView === 'list') body = renderProjectList(activeProj);
  else if (state.projectView === 'analytics') body = renderProjectAnalytics(activeProj);
  else body = renderKanban(activeProj);

  const switcher = (state.projectView === 'templates' || state.projectView === 'archived') ? '' : `
    <div class="board-switcher">
      ${visible.map(p => `<button class="tab${p.id === state.activeProjectId ? ' active' : ''}" onclick="switchProject('${p.id}')">${esc(p.name)}</button>`).join('')}
      <button class="btn btn-ghost btn-sm" onclick="openNewProjectModal()">+ ${esc(t('newProject'))}</button>
    </div>`;

  el('content').innerHTML = `
    <div class="view-anim">
      <div class="boards-head">
        <div class="tabs" style="margin:0">
          ${tabs.map(([k, lbl]) => `<button class="tab${state.projectView === k ? ' active' : ''}" onclick="setProjectView('${k}')">${esc(lbl)}</button>`).join('')}
        </div>
        ${activeProj && state.projectView === 'kanban' ? `<button class="btn btn-primary" onclick="openNewTaskModal()">+ ${esc(t('newTask'))}</button>` : ''}
      </div>
      ${switcher}
      ${body}
    </div>`;
  if (state.projectView === 'kanban' && activeProj) bindDragDrop();
}

function setProjectView(v) { state.projectView = v; render(); }
function switchProject(id) { state.activeProjectId = id; render(); }

function kanbanCardHTML(card) {
  const m = member(card.assignee);
  return `
    <div class="kanban-card" draggable="true" data-card="${card.id}" onclick="openTaskModal(${card.id})">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
        <span class="pill" style="background:${esc(labelColor(card.label))}">${esc(card.label)}</span>
        ${prioBadge(card.priority)}
      </div>
      <div class="kanban-card-title">${esc(card.title)}</div>
      ${card.subtasks.length ? `<div style="font-size:10px;color:var(--muted);margin:-4px 0 8px">☑ ${card.subtasks.filter(s => s.done).length}/${card.subtasks.length}</div>` : ''}
      <div class="kanban-card-foot">
        ${avatarHTML(m, 'a20')}
        <div class="kanban-meta">
          ${card.due ? `<span>${esc(card.due)}</span>` : ''}
          ${card.comments.length ? `<span><span class="cdot"></span>${card.comments.length}</span>` : ''}
        </div>
      </div>
    </div>`;
}

function renderKanban(p) {
  const colNames = { backlog: 'Backlog', progress: t('col_progress'), review: t('col_review'), done: t('col_done') };
  return `
    <h2 class="page-title" style="margin-top:2px">${esc(p.name)}
      <span style="font-size:11.5px;font-weight:600;color:var(--muted);margin-left:8px">
        ${p.members.map(id => avatarHTML(member(id), 'a20')).join(' ')}
      </span>
    </h2>
    <div class="kanban">
      ${p.columns.map(col => `
        <div class="kanban-col" data-col="${col.id}">
          <div class="kanban-col-title"><span>${esc(colNames[col.id] || col.title)} · ${col.cards.length}</span></div>
          ${col.cards.map(kanbanCardHTML).join('')}
          <button class="add-card-btn" onclick="openNewTaskModal('${col.id}')">${esc(t('addCard'))}</button>
        </div>`).join('')}
    </div>`;
}

// Glisser-déposer natif HTML5
let dragCardId = null;
function bindDragDrop() {
  document.querySelectorAll('.kanban-card').forEach(node => {
    node.addEventListener('dragstart', e => {
      dragCardId = Number(node.dataset.card);
      node.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    node.addEventListener('dragend', () => node.classList.remove('dragging'));
  });
  document.querySelectorAll('.kanban-col').forEach(colNode => {
    colNode.addEventListener('dragover', e => { e.preventDefault(); colNode.classList.add('drag-over'); });
    colNode.addEventListener('dragleave', () => colNode.classList.remove('drag-over'));
    colNode.addEventListener('drop', e => {
      e.preventDefault();
      colNode.classList.remove('drag-over');
      moveCard(dragCardId, colNode.dataset.col);
    });
  });
}
function moveCard(cardId, colId) {
  const found = findCard(cardId);
  if (!found || found.column.id === colId) return;
  const target = found.project.columns.find(c => c.id === colId);
  if (!target) return;
  found.column.cards = found.column.cards.filter(c => c.id !== cardId);
  found.card.done = colId === 'done';
  target.cards.push(found.card);
  logActivity(`<b>${esc(state.user.name.split(' ')[0])}</b> a déplacé <b>${esc(found.card.title)}</b>`);
  notify(`<b>${esc(found.card.title)}</b> → ${esc(target.title)}`, 'projects');
  saveDB();
  render();
}

function renderProjectList(p) {
  const cards = allCards(p);
  return `
    <h2 class="page-title" style="margin-top:2px">${esc(p.name)}</h2>
    <div class="card" style="padding:4px 16px">
      <table class="table">
        <thead><tr><th>${esc(t('newTask')).replace('Nouvelle ', '').replace('New ', '')}</th><th>${esc(t('assignee'))}</th><th>${esc(t('priority'))}</th><th>${esc(t('dueDate'))}</th><th>${esc(t('status'))}</th></tr></thead>
        <tbody>
          ${cards.map(c => {
            const col = p.columns.find(col => col.cards.includes(c));
            return `<tr style="cursor:pointer" onclick="openTaskModal(${c.id})">
              <td>${esc(c.title)}</td>
              <td>${avatarHTML(member(c.assignee), 'a20')} ${esc(member(c.assignee).name)}</td>
              <td>${prioBadge(c.priority)}</td>
              <td>${esc(c.due || '—')}</td>
              <td><span class="tag-soft" style="background:var(--accent-soft);color:var(--accent)">${esc(col ? col.title : '')}</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderProjectAnalytics(p) {
  const cards = allCards(p);
  const total = cards.length || 1;
  const done = cards.filter(c => c.done).length;
  const byPrio = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map(prio => ({ prio, n: cards.filter(c => c.priority === prio).length }));
  const byMember = p.members.map(id => ({ m: member(id), n: cards.filter(c => c.assignee === id).length }));
  return `
    <h2 class="page-title" style="margin-top:2px">${esc(p.name)} — ${esc(t('analyticsView'))}</h2>
    <div class="admin-grid">
      <div class="card"><div class="stat-value">${Math.round(done / total * 100)}%</div><div class="stat-label">${esc(t('progress'))}</div></div>
      <div class="card"><div class="stat-value">${cards.length}</div><div class="stat-label">${esc(t('activeTasks'))}</div></div>
      <div class="card"><div class="stat-value">${p.members.length}</div><div class="stat-label">${esc(t('members'))}</div></div>
    </div>
    <div class="home-cols">
      <div class="card home-left">
        <div class="section-label">${esc(t('priority'))}</div>
        ${byPrio.map(({ prio, n }) => `
          <div style="display:flex;align-items:center;gap:10px;padding:7px 0">
            <span style="width:80px">${prioBadge(prio)}</span>
            <div class="bar-track" style="flex:1"><div class="bar-fill" style="width:${Math.round(n / total * 100)}%"></div></div>
            <span style="font-size:11.5px;color:var(--muted);width:20px;text-align:right">${n}</span>
          </div>`).join('')}
      </div>
      <div class="card home-left">
        <div class="section-label">${esc(t('members'))}</div>
        ${byMember.map(({ m, n }) => `
          <div style="display:flex;align-items:center;gap:10px;padding:7px 0">
            ${avatarHTML(m, 'a20')}
            <span style="font-size:12.5px;flex:1">${esc(m.name)}</span>
            <div class="bar-track" style="flex:1"><div class="bar-fill" style="width:${Math.round(n / total * 100)}%;background:${esc(m.color)}"></div></div>
            <span style="font-size:11.5px;color:var(--muted);width:20px;text-align:right">${n}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

function renderTemplates() {
  return `
    <h2 class="page-title" style="margin-top:2px">${esc(t('templates'))}</h2>
    <div class="project-grid">
      ${db.templates.map(tpl => `
        <div class="card project-tile">
          <div style="font-size:13.5px;font-weight:700;margin-bottom:6px">${esc(tpl.name)}</div>
          <div style="font-size:11.5px;color:var(--muted);margin-bottom:10px">${tpl.tasks.length} ${esc(t('activeTasks')).toLowerCase()} · <span class="pill" style="background:${esc(labelColor(tpl.label))}">${esc(tpl.label)}</span></div>
          ${tpl.tasks.map(x => `<div style="font-size:12px;color:var(--text-2);padding:3px 0">• ${esc(x)}</div>`).join('')}
          <div style="display:flex;gap:6px;margin-top:12px">
            <button class="btn btn-primary btn-sm" onclick="applyTemplate('${tpl.id}')">${esc(t('applyTemplate'))}</button>
            <button class="btn btn-ghost btn-sm" onclick="deleteTemplate('${tpl.id}')">${esc(t('delete'))}</button>
          </div>
        </div>`).join('')}
      <div class="card project-tile" style="display:flex;align-items:center;justify-content:center;min-height:120px;border-style:dashed" onclick="openNewTemplateModal()">
        <span class="link-accent">+ ${esc(t('newTemplate'))}</span>
      </div>
    </div>`;
}

function applyTemplate(tplId) {
  const tpl = db.templates.find(x => x.id === tplId);
  const p = db.projects.find(x => !x.archived);
  if (!tpl || !p) return;
  const backlog = p.columns[0];
  let id = Math.max(0, ...db.projects.flatMap(pr => allCards(pr).map(c => c.id))) + 1;
  tpl.tasks.forEach(title => {
    backlog.cards.push({ id: id++, title, assignee: state.user.id, label: tpl.label, due: null, priority: 'MEDIUM', comments: [], subtasks: [], deps: [], done: false });
  });
  saveDB();
  state.projectView = 'kanban';
  state.activeProjectId = p.id;
  render();
  toast(t('templateApplied'));
}
function deleteTemplate(tplId) {
  db.templates = db.templates.filter(x => x.id !== tplId);
  saveDB(); render();
}
function openNewTemplateModal() {
  openModal(`
    ${modalHeader(t('newTemplate'))}
    <label class="field-label">${esc(t('templateName'))}</label>
    <input class="input" id="tpl-name" />
    <label class="field-label">${esc(t('activeTasks'))} (1 / ligne)</label>
    <textarea class="textarea" id="tpl-tasks"></textarea>
    <label class="field-label">${esc(t('labels'))}</label>
    <select class="select" id="tpl-label">${db.labels.map(l => `<option>${esc(l.name)}</option>`).join('')}</select>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">${esc(t('cancel'))}</button>
      <button class="btn btn-primary" onclick="createTemplate()">${esc(t('create'))}</button>
    </div>`);
}
function createTemplate() {
  const name = el('tpl-name').value.trim();
  const tasks = el('tpl-tasks').value.split('\n').map(x => x.trim()).filter(Boolean);
  if (!name || !tasks.length) return;
  db.templates.push({ id: 't' + Date.now(), name, tasks, label: el('tpl-label').value });
  saveDB(); closeModal(); render(); toast(t('templateCreated'));
}

function renderArchivedProjects() {
  const archived = db.projects.filter(p => p.archived);
  return `
    <h2 class="page-title" style="margin-top:2px">${esc(t('archived'))}</h2>
    ${archived.length ? `<div class="project-grid">
      ${archived.map(p => `
        <div class="card project-tile">
          <div style="font-size:13.5px;font-weight:700">${esc(p.name)}</div>
          <div style="font-size:11.5px;color:var(--muted);margin:4px 0 12px">${allCards(p).length} ${esc(t('activeTasks')).toLowerCase()} · ${p.members.length} ${esc(t('members')).toLowerCase()}</div>
          <button class="btn btn-ghost btn-sm" onclick="toggleArchiveProject('${p.id}')">${esc(t('restore'))}</button>
        </div>`).join('')}
    </div>` : `<div class="empty-note">${esc(t('noResults'))}</div>`}`;
}
function toggleArchiveProject(id) {
  const p = project(id);
  if (!p) return;
  p.archived = !p.archived;
  saveDB(); render();
  toast(p.archived ? t('archive') : t('restore'));
}

function openNewProjectModal() {
  openModal(`
    ${modalHeader(t('newProject'))}
    <label class="field-label">${esc(t('projectName'))}</label>
    <input class="input" id="np-name" />
    <label class="field-label">${esc(t('description'))}</label>
    <textarea class="textarea" id="np-desc"></textarea>
    <label class="field-label">${esc(t('members'))}</label>
    <div class="member-chips">
      ${db.team.map(m => `<label class="member-chip" style="cursor:pointer">
        <input type="checkbox" value="${m.id}" class="np-member" ${m.id === state.user.id ? 'checked' : ''}/>
        ${avatarHTML(m, 'a20')} ${esc(m.name)}
      </label>`).join('')}
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">${esc(t('cancel'))}</button>
      <button class="btn btn-primary" onclick="createProject()">${esc(t('createProject'))}</button>
    </div>`);
}
function createProject() {
  const name = el('np-name').value.trim();
  if (!name) return;
  const members = [...document.querySelectorAll('.np-member:checked')].map(x => x.value);
  const id = 'p' + Date.now();
  db.projects.push({
    id, name, archived: false, description: el('np-desc').value.trim(),
    members: members.length ? members : [state.user.id],
    columns: [
      { id: 'backlog', title: 'Backlog', cards: [] },
      { id: 'progress', title: 'In Progress', cards: [] },
      { id: 'review', title: 'Review', cards: [] },
      { id: 'done', title: 'Done', cards: [] },
    ],
  });
  logAudit('PROJECT_CREATED', name, false);
  logActivity(`<b>${esc(state.user.name.split(' ')[0])}</b> a créé le projet <b>${esc(name)}</b>`);
  saveDB(); closeModal();
  state.activeProjectId = id;
  state.projectView = 'kanban';
  render();
  toast(t('taskCreated').replace('!', '') + ' ✓');
}

// ---------- Fiche tâche (création / édition) ----------
function openNewTaskModal(colId = 'backlog') {
  const p = project(state.activeProjectId);
  if (!p) return;
  openModal(`
    ${modalHeader(t('newTask'))}
    <label class="field-label">${esc(t('description'))}</label>
    <input class="input" id="nt-title" placeholder="${esc(t('newTask'))}…" />
    <div style="display:flex;gap:10px">
      <div style="flex:1">
        <label class="field-label">${esc(t('assignee'))}</label>
        <select class="select" id="nt-assignee">
          ${p.members.map(id => `<option value="${id}" ${id === state.user.id ? 'selected' : ''}>${esc(member(id).name)}</option>`).join('')}
        </select>
      </div>
      <div style="flex:1">
        <label class="field-label">${esc(t('priority'))}</label>
        <select class="select" id="nt-prio">
          ${['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(x => `<option value="${x}" ${x === 'MEDIUM' ? 'selected' : ''}>${esc(t('prio_' + x))}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="display:flex;gap:10px">
      <div style="flex:1">
        <label class="field-label">${esc(t('labels'))}</label>
        <select class="select" id="nt-label">${db.labels.map(l => `<option>${esc(l.name)}</option>`).join('')}</select>
      </div>
      <div style="flex:1">
        <label class="field-label">${esc(t('dueDate'))}</label>
        <input class="input" id="nt-due" placeholder="ex : 18 juil." />
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">${esc(t('cancel'))}</button>
      <button class="btn btn-primary" onclick="createTask('${colId}')">${esc(t('create'))}</button>
    </div>`);
}
function createTask(colId) {
  const p = project(state.activeProjectId);
  const title = el('nt-title').value.trim();
  if (!p || !title) return;
  const col = p.columns.find(c => c.id === colId) || p.columns[0];
  const id = Math.max(0, ...db.projects.flatMap(pr => allCards(pr).map(c => c.id))) + 1;
  col.cards.push({
    id, title, assignee: el('nt-assignee').value, label: el('nt-label').value,
    due: el('nt-due').value.trim() || null, priority: el('nt-prio').value,
    comments: [], subtasks: [], deps: [], done: false,
  });
  logActivity(`<b>${esc(state.user.name.split(' ')[0])}</b> a créé <b>${esc(title)}</b>`);
  notify(`${esc(t('newTask'))} : <b>${esc(title)}</b>`, 'projects');
  saveDB(); closeModal(); render(); toast(t('taskCreated'));
}

function openTaskModal(cardId) {
  const found = findCard(cardId);
  if (!found) return;
  const { project: p, column: col, card } = found;
  const depsOk = card.deps.every(d => { const f = findCard(d); return f && f.card.done; });
  openModal(`
    ${modalHeader(card.title)}
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:2px 0 6px">
      <span class="pill" style="background:${esc(labelColor(card.label))}">${esc(card.label)}</span>
      ${prioBadge(card.priority)}
      <span class="tag-soft" style="background:var(--accent-soft);color:var(--accent)">${esc(col.title)}</span>
      <span style="font-size:11px;color:var(--muted)">${esc(p.name)}</span>
    </div>

    <div style="display:flex;gap:10px">
      <div style="flex:1">
        <label class="field-label">${esc(t('assignee'))}</label>
        <select class="select" id="tk-assignee">
          ${p.members.map(id => `<option value="${id}" ${id === card.assignee ? 'selected' : ''}>${esc(member(id).name)}</option>`).join('')}
        </select>
      </div>
      <div style="flex:1">
        <label class="field-label">${esc(t('priority'))}</label>
        <select class="select" id="tk-prio">
          ${['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(x => `<option value="${x}" ${x === card.priority ? 'selected' : ''}>${esc(t('prio_' + x))}</option>`).join('')}
        </select>
      </div>
      <div style="flex:1">
        <label class="field-label">${esc(t('dueDate'))}</label>
        <input class="input" id="tk-due" value="${esc(card.due || '')}" />
      </div>
    </div>

    ${card.deps.length ? `
      <label class="field-label">${esc(t('dependencies'))}</label>
      <div style="font-size:12px;color:${depsOk ? 'var(--success)' : 'var(--warning)'}">
        ${card.deps.map(d => { const f = findCard(d); return f ? `${f.card.done ? '✅' : '⏳'} ${esc(f.card.title)}` : ''; }).join('<br>')}
      </div>` : ''}

    <label class="field-label">${esc(t('subtasks'))} (${card.subtasks.filter(s => s.done).length}/${card.subtasks.length})</label>
    <div id="tk-subtasks">
      ${card.subtasks.map((s, i) => `
        <div class="task-row" style="padding:6px 0">
          <div style="display:flex;align-items:center;gap:10px">
            <span class="task-check${s.done ? ' done' : ''}" onclick="toggleSubtask(${card.id},${i})">${icon('check')}</span>
            <span style="font-size:12.5px;${s.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(s.text)}</span>
          </div>
        </div>`).join('')}
    </div>
    <input class="input" id="tk-newsub" placeholder="${esc(t('addSubtask'))}" onkeydown="if(event.key==='Enter')addSubtask(${card.id})" style="margin-top:6px" />

    <label class="field-label">${esc(t('comments'))} (${card.comments.length})</label>
    <div style="max-height:150px;overflow-y:auto">
      ${card.comments.map(c => `
        <div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--border-lt)">
          ${avatarHTML(member(c.user), 'a20')}
          <div style="min-width:0">
            <span style="font-size:11.5px;font-weight:700">${esc(member(c.user).name)}</span>
            <span style="font-size:10px;color:var(--muted);margin-left:6px">${esc(c.time)}</span>
            <div style="font-size:12px;color:var(--text-2)">${esc(c.text)}</div>
          </div>
        </div>`).join('') || `<div class="empty-note" style="padding:8px 0">—</div>`}
    </div>
    <input class="input" id="tk-newcomment" placeholder="${esc(t('addComment'))}" onkeydown="if(event.key==='Enter')addComment(${card.id})" style="margin-top:6px" />

    <div class="modal-foot">
      <button class="btn btn-danger" onclick="deleteTask(${card.id})">${esc(t('deleteTask'))}</button>
      <button class="btn btn-primary" onclick="saveTask(${card.id})">${esc(t('saveTask'))}</button>
    </div>`, { wide: true });
}
function toggleSubtask(cardId, i) {
  const f = findCard(cardId);
  if (!f) return;
  f.card.subtasks[i].done = !f.card.subtasks[i].done;
  saveDB(); openTaskModal(cardId);
}
function addSubtask(cardId) {
  const f = findCard(cardId);
  const v = el('tk-newsub').value.trim();
  if (!f || !v) return;
  f.card.subtasks.push({ text: v, done: false });
  saveDB(); openTaskModal(cardId);
}
function addComment(cardId) {
  const f = findCard(cardId);
  const v = el('tk-newcomment').value.trim();
  if (!f || !v) return;
  f.card.comments.push({ user: state.user.id, text: v, time: nowTime() });
  logActivity(`<b>${esc(state.user.name.split(' ')[0])}</b> a commenté <b>${esc(f.card.title)}</b>`);
  saveDB(); openTaskModal(cardId);
}
function saveTask(cardId) {
  const f = findCard(cardId);
  if (!f) return;
  f.card.assignee = el('tk-assignee').value;
  f.card.priority = el('tk-prio').value;
  f.card.due = el('tk-due').value.trim() || null;
  saveDB(); closeModal(); render(); toast(t('taskUpdated'));
}
function deleteTask(cardId) {
  const f = findCard(cardId);
  if (!f) return;
  f.column.cards = f.column.cards.filter(c => c.id !== cardId);
  saveDB(); closeModal(); render(); toast(t('taskDeleted'));
}

// ---------------- CALENDRIER ----------------
function renderCalendar() {
  const cur = state.calCursor;
  const y = cur.getFullYear(), m = cur.getMonth();
  const today = new Date();
  const monthName = cur.toLocaleDateString(prefs.lang === 'en' ? 'en-US' : prefs.lang === 'es' ? 'es-ES' : prefs.lang === 'it' ? 'it-IT' : 'fr-FR', { month: 'long', year: 'numeric' });

  const first = new Date(y, m, 1);
  let start = first.getDay() - 1;         // semaine commençant lundi
  if (start < 0) start = 6;
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const eventDate = evt => {
    const d = new Date(today);
    d.setDate(d.getDate() + evt.offset);
    return d;
  };
  const eventsOn = (day) => db.events.filter(e => {
    const d = eventDate(e);
    return d.getFullYear() === y && d.getMonth() === m && d.getDate() === day;
  });

  let cells = '';
  const dows = { fr: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'], en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], es: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'], it: ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'] };
  (dows[prefs.lang] || dows.fr).forEach(d => { cells += `<div class="cal-dow">${d}</div>`; });
  for (let i = 0; i < start; i++) cells += `<div class="cal-cell other"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === day;
    const evts = eventsOn(day);
    cells += `
      <div class="cal-cell${isToday ? ' today' : ''}" onclick="openNewEventModal(${day})" title="${esc(t('newEvent'))}">
        <div class="cal-daynum">${day}</div>
        ${evts.map(e => `<div class="cal-event" onclick="event.stopPropagation();showEvent(${e.id})">${e.allDay ? '◆ ' : (e.time ? e.time + ' ' : '')}${esc(e.title)}</div>`).join('')}
      </div>`;
  }

  const upcoming = db.events.slice().sort((a, b) => a.offset - b.offset).slice(0, 5);
  el('content').innerHTML = `
    <div class="view-anim">
      <div class="cal-head">
        <h2 class="page-title" style="margin:0">${esc(t('calendar'))}</h2>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn btn-ghost btn-sm" onclick="calMove(-1)">←</button>
          <span class="cal-month">${esc(monthName)}</span>
          <button class="btn btn-ghost btn-sm" onclick="calMove(1)">→</button>
          <button class="btn btn-ghost btn-sm" onclick="calToday()">${esc(t('today'))}</button>
          <button class="btn btn-primary btn-sm" onclick="openNewEventModal()">+ ${esc(t('newEvent'))}</button>
        </div>
      </div>
      <div class="home-cols">
        <div style="flex:2.5;min-width:340px"><div class="cal-grid">${cells}</div></div>
        <div class="card" style="flex:1;min-width:220px">
          <div class="section-label">${esc(t('upcomingEvents'))}</div>
          ${upcoming.map(e => `
            <div class="task-row" style="cursor:pointer" onclick="showEvent(${e.id})">
              <div>
                <div style="font-size:12.5px;font-weight:600">${esc(e.title)}</div>
                <div style="font-size:11px;color:var(--muted)">${e.offset === 0 ? esc(t('today')) : '+' + e.offset + ' j'}${e.allDay ? ' · ' + esc(t('allDay')) : (e.time ? ' · ' + e.time : '')}</div>
              </div>
              <span style="display:flex">${e.with.slice(0, 3).map(id => avatarHTML(member(id), 'a20')).join('')}</span>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
}
function calMove(delta) {
  state.calCursor = new Date(state.calCursor.getFullYear(), state.calCursor.getMonth() + delta, 1);
  render();
}
function calToday() { state.calCursor = new Date(); render(); }

function openNewEventModal(day = null) {
  openModal(`
    ${modalHeader(t('newEvent'))}
    <label class="field-label">${esc(t('eventTitle'))}</label>
    <input class="input" id="ev-title" />
    <div style="display:flex;gap:10px;align-items:flex-end">
      <div style="flex:1">
        <label class="field-label">${esc(t('dueDate'))} (jours à partir d'aujourd'hui)</label>
        <input class="input" id="ev-offset" type="number" value="${day !== null ? Math.max(0, day - new Date().getDate()) : 0}" min="0" />
      </div>
      <div style="flex:1">
        <label class="field-label">Heure</label>
        <input class="input" id="ev-time" type="time" value="10:00" />
      </div>
    </div>
    <label class="field-label" style="display:flex;align-items:center;gap:8px;cursor:pointer">
      <input type="checkbox" id="ev-allday" /> ${esc(t('allDay'))}
    </label>
    <label class="field-label">${esc(t('members'))}</label>
    <div class="member-chips">
      ${db.team.map(m => `<label class="member-chip" style="cursor:pointer">
        <input type="checkbox" value="${m.id}" class="ev-member" ${m.id === state.user.id ? 'checked' : ''}/>
        ${avatarHTML(m, 'a20')} ${esc(m.name)}
      </label>`).join('')}
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">${esc(t('cancel'))}</button>
      <button class="btn btn-primary" onclick="createEvent()">${esc(t('createEvent'))}</button>
    </div>`);
}
function createEvent() {
  const title = el('ev-title').value.trim();
  if (!title) return;
  const allDay = el('ev-allday').checked;
  db.events.push({
    id: nextId(db.events), title,
    offset: Math.max(0, parseInt(el('ev-offset').value, 10) || 0),
    time: allDay ? '' : el('ev-time').value, allDay,
    with: [...document.querySelectorAll('.ev-member:checked')].map(x => x.value),
  });
  notify(`${esc(t('newEvent'))} : <b>${esc(title)}</b>`, 'calendar');
  saveDB(); closeModal(); render(); toast(t('createEvent') + ' ✓');
}
function showEvent(id) {
  const e = db.events.find(x => x.id === id);
  if (!e) return;
  openModal(`
    ${modalHeader(e.title)}
    <div style="font-size:12.5px;color:var(--text-2);margin:8px 0">
      ${e.offset === 0 ? esc(t('today')) : '+' + e.offset + ' j'} ${e.allDay ? '· ' + esc(t('allDay')) : (e.time ? '· ' + e.time : '')}
    </div>
    <div class="member-chips">
      ${e.with.map(id => `<span class="member-chip">${avatarHTML(member(id), 'a20')} ${esc(member(id).name)}</span>`).join('')}
    </div>
    <div class="modal-foot">
      <button class="btn btn-danger" onclick="deleteEvent(${e.id})">${esc(t('delete'))}</button>
      <button class="btn btn-primary" onclick="closeModal();go('meet')">${esc(t('join'))}</button>
    </div>`);
}
function deleteEvent(id) {
  db.events = db.events.filter(x => x.id !== id);
  saveDB(); closeModal(); render();
}
