// ============================================================
// INCO LAB — Vues : Messages, Meet, Fichiers, Groupes,
// Annonces, Admin, Profil, Connexion
// ============================================================

// ---------------- MESSAGES ----------------
function convLabel(id) {
  const ch = db.channels.find(c => c.id === id);
  if (ch) return '#' + ch.name;
  const dm = db.dms.find(d => d.id === id);
  if (dm) return member(dm.user).name;
  const gc = db.groupChats.find(g => g.id === id);
  if (gc) return gc.name;
  return id;
}

function renderMessagesSidebar() {
  const col = el('secondary-col');
  col.hidden = false;
  col.innerHTML = `
    <div class="sec-head">
      <div class="section-label">${esc(t('channels'))}</div>
      <button class="sec-add" title="${esc(t('newChannel'))}" onclick="openNewChannelModal()">＋</button>
    </div>
    ${db.channels.map(c => `
      <div class="chan-item${state.activeConvId === c.id ? ' active' : ''}" onclick="switchConv('${c.id}')">
        <span class="chan-name"><span style="color:var(--muted)">#</span><span class="nm">${esc(c.name)}</span></span>
        ${c.unread > 0 ? `<span class="unread">${c.unread}</span>` : ''}
      </div>`).join('')}

    <div class="sec-head" style="margin-top:10px">
      <div class="section-label">${esc(t('directMessages'))}</div>
      <button class="sec-add" title="${esc(t('newConversation'))}" onclick="openNewDMModal()">＋</button>
    </div>
    ${db.dms.map(d => {
      const m = member(d.user);
      return `<div class="chan-item${state.activeConvId === d.id ? ' active' : ''}" onclick="switchConv('${d.id}')">
        <span class="chan-name">${avatarHTML(m, 'a20', true)}<span class="nm">${esc(m.name)}</span></span>
      </div>`;
    }).join('')}

    <div class="sec-head" style="margin-top:10px">
      <div class="section-label">${esc(t('groupChats'))}</div>
      <button class="sec-add" onclick="openNewGroupChatModal()">＋</button>
    </div>
    ${db.groupChats.map(g => `
      <div class="chan-item${state.activeConvId === g.id ? ' active' : ''}" onclick="switchConv('${g.id}')">
        <span class="chan-name"><span style="color:var(--muted)">👥</span><span class="nm">${esc(g.name)}</span></span>
      </div>`).join('')}

    <div class="sec-head" style="margin-top:10px">
      <div class="section-label">${esc(t('voiceChannels'))}</div>
    </div>
    ${db.voiceChannels.map(v => `
      <div class="chan-item" onclick="go('meet')">
        <span class="chan-name"><span style="color:var(--muted)">🔊</span><span class="nm">${esc(v.name)}</span></span>
        ${v.live ? `<span class="tag-soft" style="background:rgba(75,179,122,.15);color:var(--success);font-size:8.5px">● ${esc(t('inCall'))}</span>` : ''}
      </div>`).join('')}`;
}

function renderMessages() {
  renderMessagesSidebar();
  const msgs = db.messagesByConv[state.activeConvId] || [];
  const label = convLabel(state.activeConvId);
  el('content').innerHTML = `
    <div class="chat-view view-anim">
      <div class="chat-head">
        <div class="chat-title">${esc(label)}</div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="aiSummarizeConv()">${icon('spark').replace('<svg', '<svg style="width:12px;height:12px"')} ${esc(t('aiSummary'))}</button>
          <button class="btn btn-ghost btn-sm" onclick="go('meet')">${icon('phone').replace('<svg', '<svg style="width:12px;height:12px"')} ${esc(t('startCall'))}</button>
        </div>
      </div>
      <div id="ai-summary-slot"></div>
      <div class="chat-scroll" id="chat-scroll">
        ${msgs.map(m => {
          const u = member(m.user);
          return `
          <div class="msg">
            ${avatarHTML(u, 'a30', true)}
            <div style="min-width:0">
              <div class="msg-head">
                <span class="msg-name">${esc(u.name)}</span>
                <span class="msg-time">${esc(m.time)}</span>
              </div>
              <div class="msg-text">${esc(m.text)}</div>
              ${m.file ? `<div class="file-chip" onclick="toast(t('download')+' : '+${JSON.stringify(esc(m.file.name))})"><span class="sq"></span><span class="fn">${esc(m.file.name)}</span><span class="fs">${esc(m.file.size)}</span></div>` : ''}
              ${m.thread ? `<div class="thread-link" onclick="toast('${m.thread} ${esc(t('replies'))}')">${m.thread} ${esc(t('replies'))}</div>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>
      <div class="typing-note" id="typing-note"></div>
      <div class="chat-input-bar">
        <input id="chat-input" placeholder="${esc(t('messagePlaceholder'))} ${esc(label)}" onkeydown="if(event.key==='Enter')sendMessage()" />
        <button class="chat-tool" title="${esc(t('attachFile'))}" onclick="el('chat-file').click()">${icon('clip')}</button>
        <input type="file" id="chat-file" hidden onchange="attachChatFile(this)" />
        <button class="chat-tool" title="${esc(t('send'))}" onclick="sendMessage()" style="color:var(--accent)">${icon('send')}</button>
      </div>
    </div>`;
  const scroller = el('chat-scroll');
  scroller.scrollTop = scroller.scrollHeight;
}

function switchConv(id) {
  state.activeConvId = id;
  const ch = db.channels.find(c => c.id === id);
  if (ch) ch.unread = 0;
  saveDB();
  render();
}

function sendMessage(fileInfo = null) {
  const input = el('chat-input');
  const text = input.value.trim();
  if (!text && !fileInfo) return;
  const list = db.messagesByConv[state.activeConvId] || (db.messagesByConv[state.activeConvId] = []);
  list.push({ id: nextId(list), user: state.user.id, text: text || fileInfo.name, time: nowTime(), file: fileInfo });
  saveDB();
  render();
  // réponse simulée pour rendre l'app vivante
  simulateReply(state.activeConvId);
}

function attachChatFile(inputEl) {
  const f = inputEl.files[0];
  if (!f) return;
  const size = f.size > 1048576 ? (f.size / 1048576).toFixed(1) + ' Mo' : Math.max(1, Math.round(f.size / 1024)) + ' Ko';
  db.files.unshift({ id: nextId(db.files), name: f.name, size, from: state.user.id, where: convLabel(state.activeConvId), time: t('today'), folder: 'root', version: 1 });
  sendMessage({ name: f.name, size });
  toast(t('attachFile') + ' ✓');
}

const REPLY_POOL = [
  { user: 'ava', text: 'Bien noté 👍' },
  { user: 'priya', text: 'Je regarde ça tout de suite.' },
  { user: 'marcus', text: 'Top, merci !' },
  { user: 'tomas', text: 'Ça marche de mon côté ✅' },
];
function simulateReply(convId) {
  const dm = db.dms.find(d => d.id === convId);
  const pick = dm ? { user: dm.user, text: REPLY_POOL[Math.floor(Math.random() * REPLY_POOL.length)].text }
                  : REPLY_POOL[Math.floor(Math.random() * REPLY_POOL.length)];
  const note = el('typing-note');
  if (note) note.textContent = member(pick.user).name + '…';
  setTimeout(() => {
    const list = db.messagesByConv[convId];
    if (!list) return;
    list.push({ id: nextId(list), user: pick.user, text: pick.text, time: nowTime() });
    saveDB();
    if (state.view === 'messages' && state.activeConvId === convId) render();
    else {
      const ch = db.channels.find(c => c.id === convId);
      if (ch) ch.unread++;
      notify(`<b>${esc(member(pick.user).name)}</b> : ${esc(pick.text)}`, 'messages');
      saveDB();
      renderHeader();
    }
  }, 1400 + Math.random() * 1200);
}

function aiSummarizeConv() {
  const slot = el('ai-summary-slot');
  const msgs = db.messagesByConv[state.activeConvId] || [];
  slot.innerHTML = `<div class="ai-summary-box">⏳ ${esc(prefs.lang === 'en' ? 'Analyzing conversation…' : 'Analyse de la conversation…')}</div>`;
  setTimeout(() => {
    const people = [...new Set(msgs.map(m => member(m.user).name.split(' ')[0]))];
    slot.innerHTML = `
      <div class="ai-summary-box">
        <b>✦ ${esc(t('aiSummary'))}</b> — ${msgs.length} messages · ${people.join(', ')}.<br>
        ${esc(prefs.lang === 'en'
          ? 'Key points: pricing keeps the 20% annual discount; onboarding mockups are on the launch board; the billing API discount param is live on staging and will be tested against checkout this afternoon.'
          : 'Points clés : la remise annuelle de 20 % est maintenue ; les maquettes d\'onboarding sont sur le tableau de lancement ; le paramètre de remise de l\'API de facturation est en staging et sera testé sur le checkout cet après-midi.')}
      </div>`;
  }, 900);
}

function openNewChannelModal() {
  openModal(`
    ${modalHeader(t('newChannel'))}
    <label class="field-label">#</label>
    <input class="input" id="nc-name" placeholder="nom-du-canal" />
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">${esc(t('cancel'))}</button>
      <button class="btn btn-primary" onclick="createChannel()">${esc(t('create'))}</button>
    </div>`);
}
function createChannel() {
  const name = el('nc-name').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (!name || db.channels.some(c => c.name === name)) return;
  db.channels.push({ id: name, name, unread: 0 });
  db.messagesByConv[name] = [];
  saveDB(); closeModal();
  switchConv(name);
  toast('#' + name + ' ✓');
}
function openNewDMModal() {
  const existing = db.dms.map(d => d.user);
  const candidates = db.team.filter(m => m.id !== state.user.id && !existing.includes(m.id));
  openModal(`
    ${modalHeader(t('newConversation'))}
    ${candidates.length ? `
      <label class="field-label">${esc(t('members'))}</label>
      <select class="select" id="nd-user">${candidates.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select>
      <div class="modal-foot">
        <button class="btn btn-ghost" onclick="closeModal()">${esc(t('cancel'))}</button>
        <button class="btn btn-primary" onclick="createDM()">${esc(t('create'))}</button>
      </div>` : `<div class="empty-note">${esc(t('noResults'))}</div>`}`);
}
function createDM() {
  const uid = el('nd-user').value;
  const id = 'dm-' + uid;
  db.dms.push({ id, user: uid });
  db.messagesByConv[id] = [];
  saveDB(); closeModal(); switchConv(id);
}
function openNewGroupChatModal() {
  openModal(`
    ${modalHeader(t('groupChats'))}
    <label class="field-label">${esc(t('groupName'))}</label>
    <input class="input" id="ngc-name" />
    <label class="field-label">${esc(t('members'))}</label>
    <div class="member-chips">
      ${db.team.filter(m => m.id !== state.user.id).map(m => `<label class="member-chip" style="cursor:pointer">
        <input type="checkbox" value="${m.id}" class="ngc-member" /> ${avatarHTML(m, 'a20')} ${esc(m.name)}
      </label>`).join('')}
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">${esc(t('cancel'))}</button>
      <button class="btn btn-primary" onclick="createGroupChat()">${esc(t('create'))}</button>
    </div>`);
}
function createGroupChat() {
  const name = el('ngc-name').value.trim();
  const members = [...document.querySelectorAll('.ngc-member:checked')].map(x => x.value);
  if (!name || !members.length) return;
  const id = 'gc-' + Date.now();
  db.groupChats.push({ id, name, members: [...members, state.user.id] });
  db.messagesByConv[id] = [];
  saveDB(); closeModal(); switchConv(id);
}

// ---------------- MEET ----------------
function renderMeet() {
  const meeting = db.meeting;
  el('content').innerHTML = `
    <div class="meet-view view-anim">
      <div class="chat-head">
        <div class="chat-title">${esc(meeting.title)}
          <span class="tag-soft" style="background:rgba(75,179,122,.15);color:var(--success);margin-left:8px">● ${esc(t('inCall'))}</span>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="copyCallLink()">${esc(t('copyCallLink'))}</button>
      </div>
      <div class="meet-grid">
        ${meeting.participants.map(pt => {
          const m = member(pt.id);
          const isMe = pt.id === state.user.id || (pt.id === 'you');
          const camOn = isMe ? state.camOn : pt.camOn;
          return `
          <div class="meet-tile${pt.speaking ? ' speaking' : ''}">
            ${camOn
              ? `<span class="avatar a52" style="background:${esc(m.color)}">${esc(m.initials)}</span>`
              : `<span class="avatar a52" style="background:var(--muted);opacity:.6">${esc(m.initials)}</span><span class="cam-off-note">${icon('camOff')}</span>`}
            <span class="name-chip">${esc(m.name)}${isMe ? ' (vous)' : ''}
              ${pt.speaking ? '<span class="speak-wave"><i></i><i></i><i></i></span>' : ''}
              ${(isMe && !state.micOn) ? '<span style="color:var(--danger);display:inline-flex;width:11px;height:11px">' + icon('micOff') + '</span>' : ''}
            </span>
          </div>`;
        }).join('')}
      </div>
      <div class="meet-controls">
        <button class="ctl-btn${state.micOn ? '' : ' off'}" onclick="toggleMic()" title="${esc(state.micOn ? t('micOn') : t('micOff'))}">${icon(state.micOn ? 'mic' : 'micOff')}</button>
        <button class="ctl-btn${state.camOn ? '' : ' off'}" onclick="toggleCam()" title="${esc(state.camOn ? t('camOn') : t('camOff'))}">${icon(state.camOn ? 'cam' : 'camOff')}</button>
        <button class="ctl-btn leave" onclick="leaveCall()" title="${esc(t('leaveCall'))}">${icon('leave')}</button>
      </div>
    </div>`;
}
function toggleMic() { state.micOn = !state.micOn; render(); toast(state.micOn ? t('micOn') : t('micOff')); }
function toggleCam() { state.camOn = !state.camOn; render(); toast(state.camOn ? t('camOn') : t('camOff')); }
function leaveCall() { toast(t('leaveCall') + ' ✓'); go('home'); }
function copyCallLink() {
  const link = 'https://myincolab.com/call/' + Math.random().toString(36).slice(2, 10);
  navigator.clipboard && navigator.clipboard.writeText(link);
  toast(t('copied'));
}

// ---------------- FICHIERS ----------------
function renderFiles() {
  const tabs = [['all', t('sharedFiles')], ['mine', t('myDocuments')], ['archived', t('archived')]];
  const showArchivedFolders = state.filesTab === 'archived';
  const folders = db.folders.filter(f => f.parent === state.filesFolder && f.archived === showArchivedFolders);
  let files = db.files.filter(f => f.folder === state.filesFolder);
  if (state.filesTab === 'mine') files = files.filter(f => f.from === state.user.id);
  if (state.filesTab === 'archived') files = [];

  const crumbs = [];
  let cur = db.folders.find(f => f.id === state.filesFolder);
  while (cur) { crumbs.unshift(cur); cur = db.folders.find(f => f.id === cur.parent); }

  el('content').innerHTML = `
    <div class="view-anim">
      <div class="boards-head">
        <h2 class="page-title" style="margin:0">${esc(t('files'))}</h2>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="openNewFolderModal()">📁 ${esc(t('newFolder'))}</button>
          <button class="btn btn-primary btn-sm" onclick="el('file-upload').click()">↑ ${esc(t('upload'))}</button>
          <input type="file" id="file-upload" hidden onchange="uploadFile(this)" />
        </div>
      </div>
      <div class="tabs">
        ${tabs.map(([k, lbl]) => `<button class="tab${state.filesTab === k ? ' active' : ''}" onclick="setFilesTab('${k}')">${esc(lbl)}</button>`).join('')}
      </div>
      <div class="crumbs">
        ${crumbs.map((c, i) => `<span class="crumb" onclick="openFolder('${c.id}')">${esc(c.name)}</span>${i < crumbs.length - 1 ? '<span>›</span>' : ''}`).join('')}
      </div>
      <div class="files-list">
        ${folders.map(f => `
          <div class="file-row" onclick="openFolder('${f.id}')">
            <span style="width:26px;height:20px;color:var(--warning);display:inline-flex;flex-shrink:0">${icon('folder')}</span>
            <div class="file-main"><div class="file-name">${esc(f.name)}</div>
              <div class="file-meta">${db.files.filter(x => x.folder === f.id).length} ${esc(t('files')).toLowerCase()}</div></div>
            <div class="file-actions">
              <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();toggleArchiveFolder('${f.id}')">${esc(f.archived ? t('restore') : t('archive'))}</button>
            </div>
          </div>`).join('')}
        ${files.map(f => `
          <div class="file-row" onclick="toast(t('download') + ' : ' + ${JSON.stringify(esc(''))} + '${esc(f.name)}')">
            <span class="file-glyph"></span>
            <div class="file-main">
              <div class="file-name">${esc(f.name)}${f.version > 1 ? ` <span class="tag-soft" style="background:var(--accent-soft);color:var(--accent)">v${f.version}</span>` : ''}</div>
              <div class="file-meta">${esc(member(f.from).name)} · ${esc(f.where)} · ${esc(f.time)}</div>
            </div>
            <div class="file-actions">
              <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();renameFile(${f.id})">${esc(t('rename'))}</button>
              <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();deleteFile(${f.id})">${esc(t('delete'))}</button>
            </div>
            <div class="file-size">${esc(f.size)}</div>
          </div>`).join('')}
        ${(!folders.length && !files.length) ? `<div class="empty-note">${esc(t('noResults'))}</div>` : ''}
      </div>
    </div>`;
}
function setFilesTab(k) { state.filesTab = k; state.filesFolder = 'root'; render(); }
function openFolder(id) { state.filesFolder = id; render(); }
function openNewFolderModal() {
  openModal(`
    ${modalHeader(t('newFolder'))}
    <label class="field-label">${esc(t('folderName'))}</label>
    <input class="input" id="nf-name" onkeydown="if(event.key==='Enter')createFolder()" />
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">${esc(t('cancel'))}</button>
      <button class="btn btn-primary" onclick="createFolder()">${esc(t('create'))}</button>
    </div>`);
}
function createFolder() {
  const name = el('nf-name').value.trim();
  if (!name) return;
  db.folders.push({ id: 'f' + Date.now(), name, parent: state.filesFolder, archived: false });
  saveDB(); closeModal(); render();
}
function toggleArchiveFolder(id) {
  const f = db.folders.find(x => x.id === id);
  if (!f) return;
  f.archived = !f.archived;
  saveDB(); render();
}
function uploadFile(inputEl) {
  const f = inputEl.files[0];
  if (!f) return;
  const size = f.size > 1048576 ? (f.size / 1048576).toFixed(1) + ' Mo' : Math.max(1, Math.round(f.size / 1024)) + ' Ko';
  const existing = db.files.find(x => x.name === f.name && x.folder === state.filesFolder);
  if (existing) {
    existing.version++;
    existing.time = t('today');
    toast('v' + existing.version + ' ✓');
  } else {
    db.files.unshift({ id: nextId(db.files), name: f.name, size, from: state.user.id, where: t('myDocuments'), time: t('today'), folder: state.filesFolder, version: 1 });
    toast(t('upload') + ' ✓');
  }
  logAudit('FILE_UPLOADED', f.name, false);
  logActivity(`<b>${esc(state.user.name.split(' ')[0])}</b> a téléversé <b>${esc(f.name)}</b>`);
  saveDB(); render();
}
function renameFile(id) {
  const f = db.files.find(x => x.id === id);
  if (!f) return;
  const name = prompt(t('rename'), f.name);
  if (!name) return;
  f.name = name.trim();
  saveDB(); render();
}
function deleteFile(id) {
  db.files = db.files.filter(x => x.id !== id);
  saveDB(); render(); toast(t('delete') + ' ✓');
}

// ---------------- GROUPES ----------------
function renderGroups() {
  const roots = db.groups.filter(g => !g.parent);
  const groupHTML = g => {
    const children = db.groups.filter(x => x.parent === g.id);
    return `
      <div class="card group-card">
        <div class="group-head">
          <div style="font-size:13.5px;font-weight:700">${esc(g.name)}
            <span style="font-size:11px;color:var(--muted);font-weight:400;margin-left:6px">${g.members.length} ${esc(t('members')).toLowerCase()}</span>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-ghost btn-sm" onclick="openAddMemberModal('${g.id}')">+ ${esc(t('addMember'))}</button>
            <button class="btn btn-ghost btn-sm" onclick="openNewGroupModal('${g.id}')">+ ${esc(t('addSubgroup'))}</button>
          </div>
        </div>
        <div class="member-chips">
          ${g.members.map(id => `<span class="member-chip">${avatarHTML(member(id), 'a20', true)} ${esc(member(id).name)}
            <span style="cursor:pointer;color:var(--muted)" onclick="removeGroupMember('${g.id}','${id}')" title="${esc(t('delete'))}">✕</span></span>`).join('')}
        </div>
        ${children.length ? `<div class="subgroup-wrap">${children.map(groupHTML).join('')}</div>` : ''}
      </div>`;
  };
  el('content').innerHTML = `
    <div class="view-anim">
      <div class="boards-head">
        <h2 class="page-title" style="margin:0">${esc(t('groups'))}</h2>
        <button class="btn btn-primary btn-sm" onclick="openNewGroupModal(null)">+ ${esc(t('newGroup'))}</button>
      </div>
      ${roots.map(groupHTML).join('')}
    </div>`;
}
function openNewGroupModal(parentId) {
  openModal(`
    ${modalHeader(parentId ? t('addSubgroup') : t('newGroup'))}
    <label class="field-label">${esc(t('groupName'))}</label>
    <input class="input" id="ng-name" />
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">${esc(t('cancel'))}</button>
      <button class="btn btn-primary" onclick="createGroup(${parentId ? `'${parentId}'` : 'null'})">${esc(t('create'))}</button>
    </div>`);
}
function createGroup(parentId) {
  const name = el('ng-name').value.trim();
  if (!name) return;
  db.groups.push({ id: 'g' + Date.now(), name, parent: parentId, members: [] });
  logAudit('GROUP_CREATED', name, false);
  saveDB(); closeModal(); render();
}
function openAddMemberModal(groupId) {
  const g = db.groups.find(x => x.id === groupId);
  const candidates = db.team.filter(m => !g.members.includes(m.id));
  openModal(`
    ${modalHeader(t('addMember') + ' — ' + g.name)}
    ${candidates.length ? `
      <select class="select" id="am-user" style="margin-top:10px">${candidates.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select>
      <div class="modal-foot">
        <button class="btn btn-ghost" onclick="closeModal()">${esc(t('cancel'))}</button>
        <button class="btn btn-primary" onclick="addGroupMember('${groupId}')">${esc(t('addMember'))}</button>
      </div>` : `<div class="empty-note">${esc(prefs.lang === 'en' ? 'All members are already in this group.' : 'Tous les membres sont déjà dans ce groupe.')}</div>`}`);
}
function addGroupMember(groupId) {
  const g = db.groups.find(x => x.id === groupId);
  g.members.push(el('am-user').value);
  saveDB(); closeModal(); render();
}
function removeGroupMember(groupId, userId) {
  const g = db.groups.find(x => x.id === groupId);
  g.members = g.members.filter(id => id !== userId);
  saveDB(); render();
}

// ---------------- ANNONCES ----------------
function renderAnnouncements() {
  const canPost = ['ADMIN', 'MANAGER'].includes(state.user.role);
  el('content').innerHTML = `
    <div class="view-anim">
      <div class="boards-head">
        <h2 class="page-title" style="margin:0">${esc(t('announcements'))}</h2>
        ${canPost ? `<button class="btn btn-primary btn-sm" onclick="openNewAnnouncementModal()">+ ${esc(t('newAnnouncement'))}</button>` : ''}
      </div>
      ${db.announcements.map(a => `
        <div class="card announce-card ${a.type}">
          <span class="tag-soft" style="${a.type === 'global' ? 'background:var(--accent-soft);color:var(--accent)' : 'background:rgba(240,160,75,.18);color:#d18334'}">
            ${esc(a.type === 'global' ? t('globalAnnouncement') : t('companyAnnouncement'))}
          </span>
          <div class="announce-title">${esc(a.title)}</div>
          <div class="announce-body">${esc(a.body)}</div>
          ${a.attachment ? `<div class="file-chip" onclick="toast(t('download'))"><span class="sq"></span><span class="fn">${esc(a.attachment)}</span></div>` : ''}
          <div class="announce-meta">${avatarHTML(member(a.by), 'a20')} ${esc(member(a.by).name)} · ${esc(a.time)}</div>
        </div>`).join('')}
    </div>`;
}
function openNewAnnouncementModal() {
  openModal(`
    ${modalHeader(t('newAnnouncement'))}
    <label class="field-label">Type</label>
    <select class="select" id="na-type">
      <option value="company">${esc(t('companyAnnouncement'))}</option>
      ${state.user.role === 'ADMIN' ? `<option value="global">${esc(t('globalAnnouncement'))}</option>` : ''}
    </select>
    <label class="field-label">${esc(t('announcementTitle'))}</label>
    <input class="input" id="na-title" />
    <label class="field-label">${esc(t('description'))}</label>
    <textarea class="textarea" id="na-body"></textarea>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">${esc(t('cancel'))}</button>
      <button class="btn btn-primary" onclick="createAnnouncement()">${esc(t('create'))}</button>
    </div>`);
}
function createAnnouncement() {
  const title = el('na-title').value.trim();
  const body = el('na-body').value.trim();
  if (!title || !body) return;
  db.announcements.unshift({ id: nextId(db.announcements), type: el('na-type').value, title, body, by: state.user.id, time: nowTime(), attachment: null });
  notify(`${esc(t('newAnnouncement'))} : <b>${esc(title)}</b>`, 'announcements');
  logAudit('ANNOUNCEMENT_POSTED', title, false);
  saveDB(); closeModal(); render(); toast(t('newAnnouncement') + ' ✓');
}

// ---------------- ADMIN ----------------
function renderAdmin() {
  if (state.user.role !== 'ADMIN') {
    el('content').innerHTML = `<div class="empty-note view-anim">⛔ ${esc(prefs.lang === 'en' ? 'Admin access required' : 'Accès administrateur requis')}</div>`;
    return;
  }
  const tabs = [
    ['dashboard', t('adminDashboard')], ['users', t('users')], ['audit', t('auditLogs')],
    ['guests', t('guestCodes')], ['locked', t('lockedAccounts')],
  ];
  let body = '';
  if (state.adminTab === 'users') body = renderAdminUsers();
  else if (state.adminTab === 'audit') body = renderAdminAudit();
  else if (state.adminTab === 'guests') body = renderAdminGuests();
  else if (state.adminTab === 'locked') body = renderAdminLocked();
  else body = renderAdminDashboard();

  el('content').innerHTML = `
    <div class="view-anim">
      <div class="tabs">
        ${tabs.map(([k, lbl]) => `<button class="tab${state.adminTab === k ? ' active' : ''}" onclick="setAdminTab('${k}')">${esc(lbl)}</button>`).join('')}
      </div>
      ${body}
    </div>`;
}
function setAdminTab(k) { state.adminTab = k; render(); }

function renderAdminDashboard() {
  const activeProjects = db.projects.filter(p => !p.archived).length;
  const tasks = db.projects.flatMap(allCards).filter(c => !c.done).length;
  return `
    <h2 class="page-title">${esc(t('adminDashboard'))}</h2>
    <div class="admin-grid">
      <div class="card"><div class="stat-value">${db.team.filter(m => !m.locked).length}</div><div class="stat-label">${esc(t('activeUsers'))}</div></div>
      <div class="card"><div class="stat-value">${activeProjects}</div><div class="stat-label">${esc(t('activeProjects'))}</div></div>
      <div class="card"><div class="stat-value">${tasks}</div><div class="stat-label">${esc(t('activeTasks'))}</div></div>
      <div class="card"><div class="stat-value">${db.files.length}</div><div class="stat-label">${esc(t('totalFiles'))}</div></div>
    </div>
    <div class="card">
      <div class="section-label">${esc(t('recentActivity'))}</div>
      ${db.auditLogs.slice(0, 6).map(l => `
        <div class="activity-row" style="display:flex;justify-content:space-between;gap:10px">
          <span>${l.sensitive ? '🔒 ' : ''}<b>${esc(l.action)}</b> — ${esc(l.detail)}</span>
          <span style="color:var(--muted);flex-shrink:0">${esc(l.time)}</span>
        </div>`).join('')}
    </div>`;
}
function renderAdminUsers() {
  return `
    <div class="boards-head">
      <h2 class="page-title" style="margin:0">${esc(t('users'))}</h2>
      <button class="btn btn-primary btn-sm" onclick="openNewUserModal()">+ ${esc(t('newUser'))}</button>
    </div>
    <div class="card" style="padding:4px 16px">
      <table class="table">
        <thead><tr><th>${esc(t('fullName'))}</th><th>${esc(t('email'))}</th><th>${esc(t('role'))}</th><th>${esc(t('status'))}</th><th>${esc(t('actions'))}</th></tr></thead>
        <tbody>
          ${db.team.map(m => `
            <tr>
              <td>${avatarHTML(m, 'a20', true)} ${esc(m.name)}</td>
              <td>${esc(m.email)}</td>
              <td>
                <select class="select" style="width:auto;padding:4px 8px;font-size:11px" onchange="changeRole('${m.id}', this.value)" ${m.id === state.user.id ? 'disabled' : ''}>
                  ${['ADMIN', 'MANAGER', 'EMPLOYEE'].map(r => `<option ${m.role === r ? 'selected' : ''}>${r}</option>`).join('')}
                </select>
              </td>
              <td><span class="tag-soft" style="${m.locked ? 'background:rgba(229,72,77,.15);color:var(--danger)' : 'background:rgba(75,179,122,.15);color:var(--success)'}">${esc(m.locked ? t('locked') : t('active'))}</span></td>
              <td>${m.id !== state.user.id ? `<button class="btn btn-ghost btn-sm" onclick="toggleLockUser('${m.id}')">${esc(m.locked ? t('unlock') : t('deactivate'))}</button>` : '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}
function openNewUserModal() {
  openModal(`
    ${modalHeader(t('createUser'))}
    <label class="field-label">${esc(t('fullName'))}</label>
    <input class="input" id="nu-name" />
    <label class="field-label">${esc(t('email'))}</label>
    <input class="input" id="nu-email" type="email" />
    <label class="field-label">${esc(t('role'))}</label>
    <select class="select" id="nu-role"><option>EMPLOYEE</option><option>MANAGER</option><option>ADMIN</option></select>
    <div class="demo-hint">${esc(prefs.lang === 'en' ? 'A welcome email with credentials will be sent automatically.' : 'Un e-mail de bienvenue avec les identifiants sera envoyé automatiquement.')}</div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">${esc(t('cancel'))}</button>
      <button class="btn btn-primary" onclick="createUser()">${esc(t('create'))}</button>
    </div>`);
}
const AVATAR_COLORS = ['#f0a04b', '#5b8def', '#9b7bf0', '#4bb37a', '#e0607a', '#2a9d8f', '#d18334', '#7c96f5'];
function createUser() {
  const name = el('nu-name').value.trim();
  const email = el('nu-email').value.trim();
  if (!name || !email) return;
  const initials = name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
  db.team.push({
    id: 'u' + Date.now(), name, email, role: el('nu-role').value, job: '',
    initials, color: AVATAR_COLORS[db.team.length % AVATAR_COLORS.length],
    presence: 'offline', locked: false,
  });
  logAudit('USER_CREATED', email, true);
  saveDB(); closeModal(); render(); toast(t('createUser') + ' ✓');
}
function changeRole(id, role) {
  const m = member(id);
  logAudit('ROLE_CHANGED', `${m.name} : ${m.role} → ${role}`, true);
  m.role = role;
  saveDB(); render();
}
function toggleLockUser(id) {
  const m = member(id);
  m.locked = !m.locked;
  logAudit(m.locked ? 'ACCOUNT_LOCKED' : 'ACCOUNT_UNLOCKED', m.email, true);
  saveDB(); render();
}
function renderAdminAudit() {
  return `
    <h2 class="page-title">${esc(t('auditLogs'))}</h2>
    <div class="card" style="padding:4px 16px">
      <table class="table">
        <thead><tr><th>Action</th><th>${esc(t('users'))}</th><th>Détail</th><th>⏱</th></tr></thead>
        <tbody>
          ${db.auditLogs.map(l => `
            <tr>
              <td>${l.sensitive ? '🔒 ' : ''}<b>${esc(l.action)}</b></td>
              <td>${esc(member(l.user).name)}</td>
              <td>${esc(l.detail)}</td>
              <td style="color:var(--muted)">${esc(l.time)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}
function renderAdminGuests() {
  return `
    <div class="boards-head">
      <h2 class="page-title" style="margin:0">${esc(t('guestCodes'))}</h2>
      <button class="btn btn-primary btn-sm" onclick="generateGuestCode()">+ ${esc(t('generateCode'))}</button>
    </div>
    <div class="card" style="padding:4px 16px">
      <table class="table">
        <thead><tr><th>Code</th><th>${esc(t('users'))}</th><th>Utilisations</th><th>${esc(t('status'))}</th><th>${esc(t('actions'))}</th></tr></thead>
        <tbody>
          ${db.guestCodes.map(g => `
            <tr>
              <td style="font-family:ui-monospace,monospace;font-weight:700">${esc(g.code)}</td>
              <td>${esc(member(g.createdBy).name)}</td>
              <td>${g.uses}/${g.max}</td>
              <td><span class="tag-soft" style="${g.active ? 'background:rgba(75,179,122,.15);color:var(--success)' : 'background:rgba(229,72,77,.15);color:var(--danger)'}">${esc(g.active ? t('active') : t('locked'))}</span></td>
              <td>
                <button class="btn btn-ghost btn-sm" onclick="copyGuestCode('${esc(g.code)}')">${esc(t('copied')).split(' ')[0]}</button>
                <button class="btn btn-ghost btn-sm" onclick="toggleGuestCode(${g.id})">${esc(g.active ? t('deactivate') : t('activate'))}</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}
function generateGuestCode() {
  const code = 'GUEST-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  db.guestCodes.unshift({ id: nextId(db.guestCodes), code, createdBy: state.user.id, uses: 0, max: 5, active: true });
  logAudit('GUEST_CODE_CREATED', code, true);
  saveDB(); render(); toast(prefs.lang === 'en' ? 'Guest code generated!' : 'Code invité généré !');
}
function copyGuestCode(code) {
  navigator.clipboard && navigator.clipboard.writeText(code);
  toast(t('copied'));
}
function toggleGuestCode(id) {
  const g = db.guestCodes.find(x => x.id === id);
  g.active = !g.active;
  saveDB(); render();
}
function renderAdminLocked() {
  const locked = db.team.filter(m => m.locked);
  return `
    <h2 class="page-title">${esc(t('lockedAccounts'))}</h2>
    ${locked.length ? `<div class="files-list">
      ${locked.map(m => `
        <div class="file-row">
          ${avatarHTML(m, 'a30')}
          <div class="file-main"><div class="file-name">${esc(m.name)}</div><div class="file-meta">${esc(m.email)}</div></div>
          <button class="btn btn-primary btn-sm" onclick="toggleLockUser('${m.id}')">${esc(t('unlock'))}</button>
        </div>`).join('')}
    </div>` : `<div class="card empty-note">✅ ${esc(t('noLockedAccounts'))}</div>`}`;
}

// ---------------- PROFIL ----------------
function renderProfile() {
  const me = state.user;
  const tzTime = tz => {
    try { return new Date().toLocaleTimeString(prefs.lang === 'en' ? 'en-US' : 'fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: tz }); }
    catch (e) { return '—'; }
  };
  el('content').innerHTML = `
    <div class="view-anim" style="max-width:660px">
      <h2 class="page-title">${esc(t('profile'))}</h2>
      <div class="card" style="margin-bottom:16px">
        <div class="profile-head">
          <span class="profile-avatar" style="background:${esc(me.color)}">${esc(me.initials)}</span>
          <div>
            <div style="font-size:16px;font-weight:700">${esc(me.name)} <span class="role-badge role-${esc(me.role)}">${esc(me.role)}</span></div>
            <div style="font-size:12px;color:var(--muted)">${esc(me.email)}</div>
            <div style="margin-top:8px;display:flex;align-items:center;gap:8px">
              <span style="font-size:11.5px;color:var(--text-2)">${esc(t('presenceStatus'))} :</span>
              <select class="select" style="width:auto;padding:4px 10px;font-size:11.5px" onchange="setPresence(this.value)">
                ${['online', 'away', 'busy', 'offline'].map(p => `<option value="${p}" ${me.presence === p ? 'selected' : ''}>${esc(t(p))}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <div style="flex:1;min-width:160px">
            <label class="field-label">${esc(t('language'))}</label>
            <select class="select" onchange="setLang(this.value)">
              ${[['fr', 'Français'], ['en', 'English'], ['es', 'Español'], ['it', 'Italiano']].map(([k, lbl]) => `<option value="${k}" ${prefs.lang === k ? 'selected' : ''}>${lbl}</option>`).join('')}
            </select>
          </div>
          <div style="flex:1;min-width:160px">
            <label class="field-label">${esc(t('theme'))}</label>
            <select class="select" onchange="setTheme(this.value)">
              <option value="light" ${prefs.theme === 'light' ? 'selected' : ''}>☀️ ${esc(t('light'))}</option>
              <option value="dark" ${prefs.theme === 'dark' ? 'selected' : ''}>🌙 ${esc(t('dark'))}</option>
            </select>
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="section-label">${esc(t('timezones'))}</div>
        ${db.timezones.map(z => `
          <div class="tz-row">
            <span>${esc(z.label)}</span>
            <span style="display:flex;align-items:center;gap:10px">
              <span class="tz-time">${tzTime(z.tz)}</span>
              <span style="cursor:pointer;color:var(--muted)" onclick="removeTimezone('${z.id}')">✕</span>
            </span>
          </div>`).join('')}
        <div style="display:flex;gap:8px;margin-top:12px">
          <select class="select" id="tz-choice" style="flex:1">
            ${SEED.timezoneChoices.filter(c => !db.timezones.some(z => z.tz === c.tz)).map(c => `<option value="${esc(c.tz)}">${esc(c.label)}</option>`).join('')}
          </select>
          <button class="btn btn-ghost" onclick="addTimezone()">+ ${esc(t('addTimezone'))}</button>
        </div>
      </div>

      <div class="card">
        <div class="section-label">${esc(t('changePassword'))}</div>
        <label class="field-label">${esc(t('currentPassword'))}</label>
        <input class="input" type="password" id="pw-cur" />
        <label class="field-label">${esc(t('newPassword'))}</label>
        <input class="input" type="password" id="pw-new" />
        <div class="modal-foot" style="margin-top:14px">
          <button class="btn btn-primary" onclick="updatePassword()">${esc(t('updatePassword'))}</button>
        </div>
      </div>

      <div style="margin-top:18px;text-align:right">
        <button class="btn btn-danger" onclick="logout()">${esc(t('logout'))}</button>
      </div>
    </div>`;
}
function setPresence(p) {
  state.user.presence = p;
  const m = member(state.user.id);
  if (m) m.presence = p;
  saveDB(); renderHeader(); toast(t(p));
}
function setLang(lang) { prefs.lang = lang; savePrefs(); renderShell(); render(); }
function setTheme(theme) { prefs.theme = theme; savePrefs(); applyTheme(); }
function toggleTheme() { setTheme(prefs.theme === 'light' ? 'dark' : 'light'); renderHeader(); if (state.view === 'profile') render(); }
function addTimezone() {
  const sel = el('tz-choice');
  if (!sel || !sel.value) return;
  const choice = SEED.timezoneChoices.find(c => c.tz === sel.value);
  db.timezones.push({ id: 'z' + Date.now(), label: choice.label, tz: choice.tz });
  saveDB(); render();
}
function removeTimezone(id) {
  db.timezones = db.timezones.filter(z => z.id !== id);
  saveDB(); render();
}
function updatePassword() {
  if (!el('pw-cur').value || !el('pw-new').value) return;
  logAudit('PASSWORD_CHANGED', state.user.email, true);
  saveDB();
  el('pw-cur').value = el('pw-new').value = '';
  toast(t('profileUpdated'));
}

// ---------------- CONNEXION ----------------
function renderAuth() {
  const root = el('auth-root');
  const mode = state.authMode;
  let form = '';
  if (mode === 'guest') {
    form = `
      <div class="auth-title">${esc(t('guestAccess'))}</div>
      <div class="auth-sub">${esc(t('guestCode'))}</div>
      <input class="input" id="guest-code" placeholder="GUEST-XXXX" style="margin-top:6px" onkeydown="if(event.key==='Enter')guestLogin()" />
      <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:14px;padding:10px" onclick="guestLogin()">${esc(t('enterAsGuest'))}</button>
      <div class="auth-alt"><span class="link-accent" onclick="setAuthMode('login')">${esc(t('backToLogin'))}</span></div>
      <div class="demo-hint">Démo : <b>GUEST-7F2K</b></div>`;
  } else if (mode === 'forgot') {
    form = `
      <div class="auth-title">${esc(t('forgotPassword'))}</div>
      <div class="auth-sub">${esc(t('email'))}</div>
      <input class="input" id="forgot-email" type="email" placeholder="vous@entreprise.com" style="margin-top:6px" />
      <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:14px;padding:10px" onclick="toast(t('resetSent'));setAuthMode('login')">${esc(t('send'))}</button>
      <div class="auth-alt"><span class="link-accent" onclick="setAuthMode('login')">${esc(t('backToLogin'))}</span></div>`;
  } else {
    form = `
      <div class="auth-title">${esc(t('loginTitle'))}</div>
      <div class="auth-sub">${esc(t('loginSub'))}</div>
      <label class="field-label">${esc(t('email'))}</label>
      <input class="input" id="login-email" type="email" value="sam@incolab.com" />
      <label class="field-label">${esc(t('password'))}</label>
      <input class="input" id="login-pass" type="password" value="demo1234" onkeydown="if(event.key==='Enter')doLogin()" />
      <div style="text-align:right;margin-top:8px"><span class="link-accent" style="font-size:11.5px" onclick="setAuthMode('forgot')">${esc(t('forgotPassword'))}</span></div>
      <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:12px;padding:10px" onclick="doLogin()">${esc(t('login'))}</button>
      <div class="auth-alt">${esc(t('guestAccess'))} → <span class="link-accent" onclick="setAuthMode('guest')">${esc(t('guestCode'))}</span></div>
      <div class="demo-hint">
        Démo — Admin : <b>sam@incolab.com</b> · Manager : <b>ava@incolab.com</b> · Employé : <b>priya@incolab.com</b><br>
        ${esc(t('password'))} : <b>demo1234</b>
      </div>`;
  }
  root.innerHTML = `
    <button class="icon-btn auth-theme-toggle" onclick="toggleTheme();renderAuth()" title="${esc(t('theme'))}">${icon(prefs.theme === 'light' ? 'moon' : 'sun')}</button>
    <div class="auth-screen">
      <div class="auth-card">
        <div class="auth-logo-row">
          <img class="auth-logo" src="assets/logo.jpeg" alt="INCO LAB" />
          <div>
            <div class="auth-name">INCO LAB</div>
            <div class="auth-tag">Boards · Chat · Files · Meet</div>
          </div>
        </div>
        ${form}
      </div>
    </div>`;
}
function setAuthMode(mode) { state.authMode = mode; renderAuth(); }

function doLogin() {
  const email = el('login-email').value.trim().toLowerCase();
  const pass = el('login-pass').value;
  const m = db.team.find(x => x.email === email);
  if (!m || pass !== 'demo1234') { toast(t('loginFailed')); return; }
  if (m.locked) { toast(prefs.lang === 'en' ? 'Account Temporarily Locked' : 'Compte temporairement verrouillé'); return; }
  startSession(m);
}
function guestLogin() {
  const code = el('guest-code').value.trim().toUpperCase();
  const gc = db.guestCodes.find(g => g.code === code && g.active && g.uses < g.max);
  if (!gc) { toast(t('loginFailed')); return; }
  gc.uses++;
  saveDB();
  startSession({ id: 'guest', name: 'Invité', initials: 'IN', color: '#9298ab', role: 'GUEST', email: 'guest@incolab.com', presence: 'online' });
}
function startSession(m) {
  state.user = { ...m };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: m.id }));
  logAudit('LOGIN', m.email, false);
  saveDB();
  el('auth-root').innerHTML = '';
  el('app-root').hidden = false;
  state.view = 'home';
  renderShell();
  render();
  toast(t('welcome') + ', ' + m.name.split(' ')[0] + ' 👋');
}
function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  state.user = null;
  el('app-root').hidden = true;
  el('notif-panel').hidden = true;
  el('ai-panel').hidden = true;
  const fab = el('fab-ai-btn');
  if (fab) fab.remove();
  renderAuth();
}
