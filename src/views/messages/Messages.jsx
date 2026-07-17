import { useEffect, useRef, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import Avatar from '../../components/Avatar.jsx';
import ConvInfoModal from '../../components/ConvInfoModal.jsx';
import CallPanel from './CallPanel.jsx';
import { convLabel, hasGuestExecute, markConvRead, member, nextId, nowTime, QUICK_REACTIONS } from '../../lib/helpers.js';
import { useApp } from '../../state/AppContext.jsx';

const REPLY_POOL = [
  { user: 'ava', text: 'Bien noté 👍' },
  { user: 'priya', text: 'Je regarde ça tout de suite.' },
  { user: 'marcus', text: 'Top, merci !' },
  { user: 'tomas', text: 'Ça marche de mon côté ✅' },
];

export default function Messages() {
  const { db, updateDB, user, prefs, ui, toast, openModal, chatCall, startChatCall, endChatCall, t } = useApp();
  const [input, setInput] = useState('');
  const [summary, setSummary] = useState(null);
  const [typingNote, setTypingNote] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [openMarker, setOpenMarker] = useState(0);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const replyTimer = useRef(null);
  const inputRef = useRef(null);

  const convId = ui.activeConvId;
  const msgs = db.messagesByConv[convId] || [];
  const label = convLabel(db, convId);
  const call = chatCall && chatCall.convId === convId ? chatCall : null;

  const uiRef = useRef(ui);
  uiRef.current = ui;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs.length, convId]);

  useEffect(() => { setSummary(null); setReplyingTo(null); }, [convId]);
  useEffect(() => () => { if (replyTimer.current) clearTimeout(replyTimer.current); }, []);

  // Capture les messages non lus au moment de l'ouverture (avant de marquer comme lu),
  // pour les mettre en évidence pendant cette visite de la conversation.
  useEffect(() => {
    setOpenMarker((db.readMarkers && db.readMarkers[convId]) || 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId]);

  // Marque la conversation comme lue à l'ouverture, et à chaque nouveau message reçu pendant qu'on la consulte.
  useEffect(() => {
    updateDB(draft => markConvRead(draft, convId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId, msgs.length]);

  function startReply(msgId) {
    setReplyingTo(msgId);
    inputRef.current?.focus();
  }

  function scrollToMessage(msgId) {
    document.getElementById('msg-' + msgId)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function toggleReaction(msgId, emoji) {
    updateDB(draft => {
      const list = draft.messagesByConv[convId];
      const m = list && list.find(x => x.id === msgId);
      if (!m) return;
      if (!m.reactions) m.reactions = [];
      let r = m.reactions.find(x => x.emoji === emoji);
      if (!r) { r = { emoji, users: [] }; m.reactions.push(r); }
      r.users = r.users.includes(user.id) ? r.users.filter(u => u !== user.id) : [...r.users, user.id];
      m.reactions = m.reactions.filter(x => x.users.length > 0);
    });
  }

  function simulateReply(id) {
    const dm = db.dms.find(d => d.id === id);
    const pick = dm ? { user: dm.user, text: REPLY_POOL[Math.floor(Math.random() * REPLY_POOL.length)].text }
      : REPLY_POOL[Math.floor(Math.random() * REPLY_POOL.length)];
    setTypingNote(member(db, pick.user).name + '…');
    replyTimer.current = setTimeout(() => {
      setTypingNote('');
      const viewingHere = uiRef.current.view === 'messages' && uiRef.current.activeConvId === id;
      updateDB(draft => {
        const list = draft.messagesByConv[id];
        if (!list) return;
        list.push({ id: nextId(list), user: pick.user, text: pick.text, time: nowTime(prefs.lang) });
        if (!viewingHere) {
          draft.notifications.unshift({ id: nextId(draft.notifications), text: `<b>${member(draft, pick.user).name}</b> : ${pick.text}`, when: nowTime(prefs.lang), read: false, view: 'messages' });
        }
      });
    }, 1400 + Math.random() * 1200);
  }

  function sendMessage(fileInfo = null) {
    const text = input.trim();
    if (!text && !fileInfo) return;
    const replyTo = replyingTo;
    updateDB(draft => {
      const list = draft.messagesByConv[convId] || (draft.messagesByConv[convId] = []);
      list.push({ id: nextId(list), user: user.id, text: text || fileInfo.name, time: nowTime(prefs.lang), file: fileInfo, replyTo: replyTo || undefined });
    });
    setInput('');
    setReplyingTo(null);
    simulateReply(convId);
  }

  function attachChatFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    const size = f.size > 1048576 ? (f.size / 1048576).toFixed(1) + ' Mo' : Math.max(1, Math.round(f.size / 1024)) + ' Ko';
    updateDB(draft => {
      draft.files.unshift({ id: nextId(draft.files), name: f.name, size, from: user.id, where: convLabel(draft, convId), time: t('today'), folder: 'root', version: 1 });
    });
    sendMessage({ name: f.name, size });
    toast(t('attachFile') + ' ✓');
    e.target.value = '';
  }

  function aiSummarizeConv() {
    setSummary('loading');
    setTimeout(() => {
      const people = [...new Set(msgs.map(m => member(db, m.user).name.split(' ')[0]))];
      setSummary({ count: msgs.length, people });
    }, 900);
  }

  return (
    <div className="chat-view view-anim">
      <div className="chat-head">
        <div className="chat-title clickable" onClick={() => openModal(<ConvInfoModal convId={convId} />, { wide: true })} title={t('conversationInfo')}>
          {label}
          <Icon name="chevron" style={{ width: 11, height: 11, opacity: .45, transform: 'rotate(-90deg)' }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }} data-tour="messages-calls">
          <button
            className={`btn btn-ghost btn-sm${call?.type === 'audio' ? ' active' : ''}`}
            title={t('audioCall')}
            onClick={() => (call?.type === 'audio' ? endChatCall() : startChatCall(convId, 'audio'))}
          >
            <Icon name="phone" style={{ width: 12, height: 12 }} /> {t('audioCall')}
          </button>
          <button
            className={`btn btn-ghost btn-sm${call?.type === 'video' ? ' active' : ''}`}
            title={t('videoCall')}
            onClick={() => (call?.type === 'video' ? endChatCall() : startChatCall(convId, 'video'))}
          >
            <Icon name="cam" style={{ width: 12, height: 12 }} /> {t('videoCall')}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={aiSummarizeConv}>
            <Icon name="spark" style={{ width: 12, height: 12 }} /> {t('aiSummary')}
          </button>
        </div>
      </div>
      {call && <CallPanel key={call.type} convId={convId} type={call.type} startedAt={call.startedAt} onEnd={endChatCall} />}
      <div id="ai-summary-slot">
        {summary === 'loading' && (
          <div className="ai-summary-box">⏳ {prefs.lang === 'en' ? 'Analyzing conversation…' : 'Analyse de la conversation…'}</div>
        )}
        {summary && summary !== 'loading' && (
          <div className="ai-summary-box">
            <b>✦ {t('aiSummary')}</b> — {summary.count} messages · {summary.people.join(', ')}.<br />
            {prefs.lang === 'en'
              ? 'Key points: pricing keeps the 20% annual discount; onboarding mockups are on the launch board; the billing API discount param is live on staging and will be tested against checkout this afternoon.'
              : 'Points clés : la remise annuelle de 20 % est maintenue ; les maquettes d\'onboarding sont sur le tableau de lancement ; le paramètre de remise de l\'API de facturation est en staging et sera testé sur le checkout cet après-midi.'}
          </div>
        )}
      </div>
      <div className="chat-scroll" id="chat-scroll" ref={scrollRef}>
        {msgs.map((m, i) => {
          const u = member(db, m.user);
          const continued = i > 0 && msgs[i - 1].user === m.user && !m.replyTo;
          const isUnread = m.id > openMarker && m.user !== user.id;
          const quoted = m.replyTo ? msgs.find(x => x.id === m.replyTo) : null;
          return (
            <div className={`msg-row${continued ? ' continued' : ''}${isUnread ? ' unread-msg' : ''}`} key={m.id} id={'msg-' + m.id}>
              <div className="msg-group">
                <div className="msg-group-avatar-col">
                  {continued ? <span className="msg-continued-time">{m.time}</span> : <Avatar m={u} size="a30" withPresence />}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  {!continued && (
                    <div className="msg-head">
                      <span className="msg-name">{u.name}</span>
                      <span className="msg-time">{m.time}</span>
                    </div>
                  )}
                  {quoted && (
                    <div className="msg-quote" onClick={() => scrollToMessage(quoted.id)}>
                      <span className="msg-quote-name">{member(db, quoted.user).name}</span>
                      <span className="msg-quote-text">{quoted.file ? '📎 ' + quoted.file.name : quoted.text}</span>
                    </div>
                  )}
                  <div className="msg-text">{m.text}</div>
                  {m.file && (
                    <div className="file-chip" onClick={() => toast(t('download') + ' : ' + m.file.name)}>
                      <span className="sq" /><span className="fn">{m.file.name}</span><span className="fs">{m.file.size}</span>
                    </div>
                  )}
                  {(m.reactions?.length > 0) && (
                    <div className="msg-reactions">
                      {m.reactions.map(r => (
                        <span
                          key={r.emoji}
                          className={`reaction-pill${r.users.includes(user.id) ? ' mine' : ''}`}
                          onClick={() => toggleReaction(m.id, r.emoji)}
                        >
                          {r.emoji} {r.users.length}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="msg-hover-toolbar">
                {QUICK_REACTIONS.map(emoji => (
                  <button key={emoji} className="msg-hover-btn" title={emoji} onClick={() => toggleReaction(m.id, emoji)}>{emoji}</button>
                ))}
                {hasGuestExecute(user, 'messages') && (
                  <button className="msg-hover-btn icon-only" title={t('reply')} onClick={() => startReply(m.id)}>
                    <Icon name="reply" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="typing-note" id="typing-note">{typingNote}</div>
      {hasGuestExecute(user, 'messages') ? (
        <div className="chat-input-bar-wrap">
          {replyingTo != null && (() => {
            const rm = msgs.find(x => x.id === replyingTo);
            if (!rm) return null;
            return (
              <div className="reply-preview">
                <div className="reply-preview-body">
                  <span className="reply-preview-name">{t('replyingTo')} {member(db, rm.user).name}</span>
                  <span className="reply-preview-text">{rm.file ? '📎 ' + rm.file.name : rm.text}</span>
                </div>
                <button className="reply-preview-close" onClick={() => setReplyingTo(null)} title={t('cancel')}><Icon name="close" /></button>
              </div>
            );
          })()}
          <div className="chat-input-bar">
            <input
              id="chat-input" ref={inputRef} placeholder={t('messagePlaceholder') + ' ' + label}
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
            />
            <button className="chat-tool" title={t('attachFile')} onClick={() => fileInputRef.current?.click()}><Icon name="clip" /></button>
            <input type="file" ref={fileInputRef} hidden onChange={attachChatFile} />
            <button className="chat-tool" title={t('send')} onClick={() => sendMessage()} style={{ color: 'var(--accent)' }}><Icon name="send" /></button>
          </div>
        </div>
      ) : (
        <div className="demo-hint" style={{ margin: 12 }}>{t('viewOnlyAccess')}</div>
      )}
    </div>
  );
}
