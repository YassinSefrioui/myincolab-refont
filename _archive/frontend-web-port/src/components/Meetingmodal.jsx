import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import * as mediasoupClient from 'mediasoup-client'
import { PhoneOff, Video, VideoOff, Mic, MicOff, Volume2, VolumeX, Loader2, Monitor, MonitorOff, Minimize2, Maximize2 } from 'lucide-react'
import toast from 'react-hot-toast'
import useAuthStore from '../store/authStore'

/* ─────────────────────────────────────────────────────────────────────────────
   MeetingModal — Discord-style 1-on-1 & group call via Mediasoup SFU
   Props:
     roomId      — deterministic room id, e.g. "call-3-5"
     mode        — 'audio' | 'video'
     remoteUser  — { id, fullName }
     onClose     — callback after leaving
───────────────────────────────────────────────────────────────────────────── */

export default function MeetingModal({ roomId, mode, remoteUser, onClose }) {
  const { user, token } = useAuthStore()
  const peerId = String(user?.id || user?.userId)
  const myName = user?.fullName || 'You'

  /* ── state ── */
  const [phase,        setPhase]        = useState('connecting')
  const [isMuted,      setIsMuted]      = useState(false)
  const [isDeafened,   setIsDeafened]   = useState(false)
  const [camEnabled,   setCamEnabled]   = useState(mode === 'video')
  const [camOff,       setCamOff]       = useState(false)
  const [duration,     setDuration]     = useState(0)
  const [peers,        setPeers]        = useState([])
  const [localSpeak,   setLocalSpeak]   = useState(false)
  const [error,        setError]        = useState(null)
  const [isMinimized,  setIsMinimized]  = useState(false)
  const [isSharing,    setIsSharing]    = useState(false)

  /* ── mutable refs (never cause re-renders) ── */
  const wsRef        = useRef(null)
  const deviceRef    = useRef(null)
  const sendTx       = useRef(null)
  const recvTx       = useRef(null)
  const localStream  = useRef(null)
  const producers    = useRef({ audio: null, video: null, screen: null })
  const screenStream = useRef(null)
  const consumers    = useRef(new Map())     // consumerId → { consumer, peerId, kind }
  const pending      = useRef([])            // producers before recvTx is ready
  const mounted      = useRef(true)
  const closed       = useRef(false)
  const timerRef     = useRef(null)
  const vadRef       = useRef(null)
  const audioEls     = useRef([])
  const isDeafRef    = useRef(false)
  const localVidRef  = useRef(null)

  /* ── minimized PiP drag ── */
  const minRef    = useRef(null)
  const minDrag   = useRef(null)
  const [minPos,  setMinPos] = useState(() => {
    try { const s = localStorage.getItem('call-min-pos'); return s ? JSON.parse(s) : null } catch { return null }
  })

  const onMinDown = useCallback(e => {
    const r = minRef.current?.getBoundingClientRect()
    if (!r) return
    minDrag.current = { ox: e.clientX - r.left, oy: e.clientY - r.top }
    const onMove = ev => {
      if (!minDrag.current || !minRef.current) return
      const x = Math.max(0, Math.min(window.innerWidth  - minRef.current.offsetWidth,  ev.clientX - minDrag.current.ox))
      const y = Math.max(0, Math.min(window.innerHeight - minRef.current.offsetHeight, ev.clientY - minDrag.current.oy))
      const p = { x, y }
      setMinPos(p)
      localStorage.setItem('call-min-pos', JSON.stringify(p))
    }
    const onUp = () => { minDrag.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    e.preventDefault()
  }, [])

  /* ── video PiP drag ── */
  const pipRef    = useRef(null)
  const drag      = useRef(null)
  const onPipDown = useCallback(e => {
    const r = pipRef.current?.getBoundingClientRect()
    if (!r) return
    drag.current = { ox: e.clientX - r.left, oy: e.clientY - r.top }
    const onMove = ev => {
      if (!drag.current || !pipRef.current) return
      const pr = pipRef.current.parentElement.getBoundingClientRect()
      const x  = Math.max(0, Math.min(pr.width  - pipRef.current.offsetWidth,  ev.clientX - pr.left - drag.current.ox))
      const y  = Math.max(0, Math.min(pr.height - pipRef.current.offsetHeight, ev.clientY - pr.top  - drag.current.oy))
      pipRef.current.style.cssText += `;left:${x}px;top:${y}px;right:auto;bottom:auto`
    }
    const onUp = () => { drag.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    e.preventDefault()
  }, [])

  /* ── lifecycle ── */
  useEffect(() => {
    mounted.current = true
    closed.current  = false
    startCall()
    return () => {
      mounted.current = false
      doCleanup()
    }
  }, [])

  /* ── voice activity detection ── */
  const startVAD = stream => {
    try {
      const ctx  = new (window.AudioContext || window.webkitAudioContext)()
      const src  = ctx.createMediaStreamSource(stream)
      const ana  = ctx.createAnalyser()
      ana.fftSize = 256
      src.connect(ana)
      const buf = new Uint8Array(ana.frequencyBinCount)
      let lastSpeak = false
      let raf
      const tick = () => {
        if (!mounted.current) return
        ana.getByteFrequencyData(buf)
        const rms      = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length)
        const speaking = rms > 16
        // Only update state when value actually changes (avoids constant re-renders)
        if (speaking !== lastSpeak) { lastSpeak = speaking; setLocalSpeak(speaking) }
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
      vadRef.current = { ctx, raf }
    } catch {}
  }

  const stopVAD = () => {
    if (!vadRef.current) return
    cancelAnimationFrame(vadRef.current.raf)
    try { vadRef.current.ctx.close() } catch {}
    vadRef.current = null
  }

  /* ── main connect flow ── */
  const startCall = async () => {
    try {
      console.log('[Call] getUserMedia…')
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: mode === 'video'
          ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
          : false,
      })
      localStream.current = stream
      if (localVidRef.current) localVidRef.current.srcObject = stream
      startVAD(stream)

      console.log('[Call] Connecting to SFU… room=', roomId, 'peer=', peerId)
      setPhase('ringing')

      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const ws    = new WebSocket(`${proto}://${window.location.host}/sfu?token=${token}`)
      wsRef.current = ws

      ws.onopen    = () => { console.log('[SFU] WebSocket open'); sfuSend({ type: 'join', roomId, peerId, data: { userId: peerId, displayName: myName } }) }
      ws.onmessage = e => handleSfuMsg(JSON.parse(e.data))
      ws.onerror   = () => { console.error('[SFU] WebSocket error'); handleFatalError('Could not connect to call server') }
      // Only auto-close if genuinely unmounted — network blips are handled by the SFU
      ws.onclose   = () => { console.log('[SFU] WebSocket closed'); if (mounted.current && !closed.current) doClose() }

    } catch (err) {
      console.error('[Call] startCall error:', err)
      if (err.name === 'NotAllowedError') handleFatalError('Microphone / camera permission denied')
      else handleFatalError('Could not start call: ' + err.message)
    }
  }

  const handleFatalError = msg => {
    if (!mounted.current || closed.current) return
    toast.error(msg)
    setError(msg)
    setPhase('error')
    doCleanup()
  }

  /* ── SFU message handler ── */
  const handleSfuMsg = async msg => {
    if (!mounted.current) return
    console.log('[SFU] ←', msg.type, msg)

    switch (msg.type) {

      case 'joined': {
        console.log('[SFU] Joined room. Existing producers:', msg.producers?.length ?? 0)
        const dev = new mediasoupClient.Device()
        await dev.load({ routerRtpCapabilities: msg.rtpCapabilities })
        deviceRef.current = dev

        // Queue existing producers — will be consumed once recvTx is ready
        if (Array.isArray(msg.producers) && msg.producers.length) {
          pending.current.push(...msg.producers)
        }

        sfuSend({ type: 'createTransport', roomId, peerId, data: { direction: 'send' } })
        break
      }

      case 'transportCreated': {
        const { transportId, direction, iceParameters, iceCandidates, dtlsParameters } = msg
        const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }]

        if (direction === 'send') {
          const t = deviceRef.current.createSendTransport({ id: transportId, iceParameters, iceCandidates, dtlsParameters, iceServers })
          t.on('connect', ({ dtlsParameters: dp }, cb) => {
            sfuSend({ type: 'connectTransport', roomId, peerId, data: { transportId, dtlsParameters: dp } })
            cb()
          })
          t.on('produce', ({ kind, rtpParameters }, cb) => {
            sfuSend({ type: 'produce', roomId, peerId, data: { transportId, kind, rtpParameters } })
            t._produceCb = cb
          })
          sendTx.current = t
          await produceMedia()
          sfuSend({ type: 'createTransport', roomId, peerId, data: { direction: 'recv' } })

        } else {
          const t = deviceRef.current.createRecvTransport({ id: transportId, iceParameters, iceCandidates, dtlsParameters, iceServers })
          t.on('connect', ({ dtlsParameters: dp }, cb) => {
            sfuSend({ type: 'connectTransport', roomId, peerId, data: { transportId, dtlsParameters: dp } })
            cb()
          })
          recvTx.current = t

          console.log('[SFU] RecvTransport ready, draining', pending.current.length, 'pending producers')
          for (const p of pending.current) consumeProducer(p)
          pending.current = []

          setPhase('live')
          startTimer()
        }
        break
      }

      case 'produced': {
        const t = sendTx.current
        if (t?._produceCb) { t._produceCb({ id: msg.producerId }); t._produceCb = null }
        break
      }

      case 'new-producer': {
        console.log('[SFU] new-producer', msg.producerId, 'kind=', msg.kind, 'from=', msg.peerId)
        recvTx.current ? consumeProducer(msg) : pending.current.push(msg)
        break
      }

      case 'consumed': {
        const { consumerId, producerId, kind, rtpParameters } = msg
        const consumer  = await recvTx.current.consume({ id: consumerId, producerId, kind, rtpParameters })
        const fromPeer  = consumers.current.get('__p_' + producerId)
        consumers.current.delete('__p_' + producerId)
        consumers.current.set(consumerId, { consumer, peerId: fromPeer, kind })
        console.log('[SFU] consumed', kind, 'from', fromPeer)

        if (kind === 'video') {
          const stream = new MediaStream([consumer.track])
          setPeers(prev => {
            const hit = prev.find(p => p.peerId === fromPeer)
            if (hit) return prev.map(p => p.peerId === fromPeer ? { ...p, videoStream: stream } : p)
            return [...prev, { peerId: fromPeer, name: remoteUser?.fullName || fromPeer, videoStream: stream }]
          })
        } else {
          // ★ FIX: Audio consumption also adds the peer to the peers list.
          // Without this, audio-only calls never populate `peers`, so the callee
          // stays stuck on the "Ringing…" screen even after the caller joins.
          const audio = new Audio()
          audio.srcObject = new MediaStream([consumer.track])
          audioEls.current.push(audio)
          if (!isDeafRef.current) audio.play().catch(e => console.warn('[Audio]', e))

          if (fromPeer) {
            setPeers(prev => prev.find(p => p.peerId === fromPeer) ? prev
              : [...prev, { peerId: fromPeer, name: remoteUser?.fullName || fromPeer, videoStream: null }])
          }
        }
        sfuSend({ type: 'resumeConsumer', roomId, peerId, data: { consumerId } })
        break
      }

      case 'consumer-closed': {
        const entry = consumers.current.get(msg.consumerId)
        if (entry) {
          consumers.current.delete(msg.consumerId)
          if (entry.kind === 'video') setPeers(prev => prev.map(p => p.peerId === entry.peerId ? { ...p, videoStream: null } : p))
        }
        break
      }

      case 'peer-joined':
        console.log('[SFU] peer-joined', msg.peerId, msg.displayName)
        setPeers(prev => prev.find(p => p.peerId === msg.peerId) ? prev
          : [...prev, { peerId: msg.peerId, name: msg.displayName || remoteUser?.fullName || msg.peerId, videoStream: null }])
        break

      case 'peer-left':
        console.log('[SFU] peer-left', msg.peerId)
        setPeers(prev => prev.filter(p => p.peerId !== msg.peerId))
        break

      case 'error':
        console.error('[SFU] server error:', msg.message)
        break
    }
  }

  const consumeProducer = ({ producerId, peerId: fromPeer, kind }) => {
    consumers.current.set('__p_' + producerId, fromPeer)
    sfuSend({
      type: 'consume', roomId, peerId,
      data: { transportId: recvTx.current.id, producerId, rtpCapabilities: deviceRef.current.rtpCapabilities },
    })
  }

  const produceMedia = async () => {
    const t = sendTx.current
    if (!t) return
    const at = localStream.current?.getAudioTracks()[0]
    if (at) producers.current.audio = await t.produce({ track: at })
    if (mode === 'video') {
      const vt = localStream.current?.getVideoTracks()[0]
      if (vt) producers.current.video = await t.produce({
        track: vt,
        encodings: [
          { maxBitrate: 100_000, scaleResolutionDownBy: 4 },
          { maxBitrate: 300_000, scaleResolutionDownBy: 2 },
          { maxBitrate: 900_000 },
        ],
        codecOptions: { videoGoogleStartBitrate: 1000 },
      })
    }
  }

  /* ── controls ── */
  const toggleMute = () => {
    const t = localStream.current?.getAudioTracks()[0]
    if (t) { t.enabled = !t.enabled; setIsMuted(v => !v) }
  }

  const toggleDeafen = () => {
    const next = !isDeafRef.current
    isDeafRef.current = next
    setIsDeafened(next)
    audioEls.current.forEach(a => { if (next) a.pause(); else a.play().catch(() => {}) })
    if (next && !isMuted) {
      const t = localStream.current?.getAudioTracks()[0]
      if (t) { t.enabled = false; setIsMuted(true) }
    }
  }

  const toggleCam = () => {
    const t = localStream.current?.getVideoTracks()[0]
    if (t) { t.enabled = !t.enabled; setCamOff(v => !v) }
  }

  const toggleScreenShare = async () => {
    if (isSharing) {
      try {
        screenStream.current?.getTracks().forEach(t => t.stop())
        producers.current.screen?.close()
        producers.current.screen = null
        screenStream.current = null
      } catch {}
      setIsSharing(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      screenStream.current = stream
      const track = stream.getVideoTracks()[0]
      track.addEventListener('ended', () => { setIsSharing(false); producers.current.screen = null })
      const t = sendTx.current
      if (t) {
        producers.current.screen = await t.produce({
          track,
          encodings: [{ maxBitrate: 1_500_000 }],
          codecOptions: { videoGoogleStartBitrate: 1000 },
          appData: { kind: 'screen' },
        })
      }
      setIsSharing(true)
    } catch (err) {
      if (err.name !== 'NotAllowedError') toast.error('Screen share failed: ' + err.message)
    }
  }

  const enableCam = async () => {
    if (camEnabled) return
    try {
      const s  = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } })
      const vt = s.getVideoTracks()[0]
      localStream.current?.addTrack(vt)
      if (localVidRef.current) localVidRef.current.srcObject = localStream.current
      const t = sendTx.current
      if (t) producers.current.video = await t.produce({
        track: vt,
        encodings: [{ maxBitrate: 100_000, scaleResolutionDownBy: 4 }, { maxBitrate: 300_000, scaleResolutionDownBy: 2 }, { maxBitrate: 900_000 }],
        codecOptions: { videoGoogleStartBitrate: 1000 },
      })
      setCamEnabled(true)
      setCamOff(false)
    } catch (err) {
      toast.error(err.name === 'NotAllowedError' ? 'Camera permission denied' : 'Could not start camera')
    }
  }

  const handleLeave = () => {
    sfuSend({ type: 'leave', roomId, peerId, data: {} })
    doClose()
  }

  const doClose = () => {
    if (closed.current) return
    closed.current = true
    doCleanup()
    onClose()
  }

  const doCleanup = () => {
    stopVAD()
    clearInterval(timerRef.current)
    try { localStream.current?.getTracks().forEach(t => t.stop()) } catch {}
    try { producers.current.audio?.close() } catch {}
    try { producers.current.video?.close() } catch {}
    try { producers.current.screen?.close() } catch {}
    try { screenStream.current?.getTracks().forEach(t => t.stop()) } catch {}
    consumers.current.forEach(({ consumer }) => { try { consumer.close() } catch {} })
    try { sendTx.current?.close() } catch {}
    try { recvTx.current?.close() } catch {}
    audioEls.current.forEach(a => { try { a.pause(); a.srcObject = null } catch {} })
    audioEls.current = []
    if (wsRef.current && wsRef.current.readyState < 2) {
      wsRef.current.onclose = null
      wsRef.current.close()
    }
  }

  const startTimer = () => {
    timerRef.current = setInterval(() => { if (mounted.current) setDuration(d => d + 1) }, 1000)
  }

  const sfuSend = d => wsRef.current?.readyState === 1 && wsRef.current.send(JSON.stringify(d))

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  /* ── derived ── */
  const remotePeer   = peers[0]
  const isGroup      = peers.length > 1
  const showLocalVid = camEnabled && !camOff
  const hasRemoteVid = !!remotePeer?.videoStream
  const isLive       = phase === 'live'
  const callIsAudio  = mode === 'audio' && !hasRemoteVid && !showLocalVid

  /* ─────────────────────────────────────────────────────────────── render ── */

  // ── Minimized pill — draggable, rendered in a portal so it's always accessible
  if (isMinimized) {
    const minStyle = minPos
      ? { left: minPos.x, top: minPos.y, bottom: 'auto', right: 'auto' }
      : { bottom: 24, right: 24 }

    return createPortal(
      <>
        <style>{CALL_STYLES}</style>
        <div
          ref={minRef}
          onMouseDown={onMinDown}
          style={{
            position: 'fixed', zIndex: 400, cursor: 'grab',
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 18px', borderRadius: 16,
            background: 'rgba(24,26,29,0.97)', backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            userSelect: 'none',
            ...minStyle,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#57f287', flexShrink: 0, animation: 'cmPulse 2s ease-in-out infinite' }} />
          <span style={{ color: '#dcddde', fontSize: 13, fontWeight: 600 }}>
            {remoteUser?.fullName || 'Call'} · {fmt(duration)}
          </span>
          <button onClick={e => { e.stopPropagation(); toggleMute() }} title={isMuted ? 'Unmute' : 'Mute'}
                  style={{ width: 30, height: 30, borderRadius: 8, background: isMuted ? '#ed4245' : 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
          </button>
          <button onClick={e => { e.stopPropagation(); setIsMinimized(false) }} title="Expand"
                  style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <Maximize2 size={14} />
          </button>
          <button onClick={e => { e.stopPropagation(); handleLeave() }}
                  style={{ height: 30, padding: '0 12px', borderRadius: 8, background: '#ed4245', border: 'none', cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <PhoneOff size={13} /> Leave
          </button>
        </div>
      </>,
      document.body
    )
  }

  return createPortal(
    <>
      <style>{CALL_STYLES}</style>

      <div className="cm-root">

        {/* ══ CONNECTING / RINGING / ERROR ══════════════════════════════════ */}
        {(phase === 'connecting' || phase === 'ringing' || phase === 'error') && (
          <div className="cm-stage">
            <div className="cm-blob cm-blob1" />
            <div className="cm-blob cm-blob2" />

            {phase !== 'error' ? (
              <>
                <div style={{ position: 'relative', marginBottom: 24 }}>
                  <div className="cm-ring cm-ring1" />
                  <div className="cm-ring cm-ring2" />
                  <Av name={remoteUser?.fullName} size={100} color="#5865f2" photoUrl={remoteUser?.profilePhotoUrl} />
                </div>
                <p className="cm-name">{remoteUser?.fullName || '…'}</p>
                <p className="cm-sub">
                  <Loader2 size={14} className="cm-spin" style={{ marginRight: 6 }} />
                  {phase === 'connecting' ? 'Connecting' : 'Calling'}
                  <Dots />
                </p>
              </>
            ) : (
              <>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📵</div>
                <p className="cm-name">Call failed</p>
                <p className="cm-sub" style={{ color: '#ed4245', marginBottom: 24 }}>{error}</p>
                <button onClick={doClose} className="cm-retry-btn">Close</button>
              </>
            )}
          </div>
        )}

        {/* ══ LIVE — waiting for remote to join ════════════════════════════ */}
        {isLive && peers.length === 0 && (
          <div className="cm-stage">
            <div className="cm-blob cm-blob1" />
            <div className="cm-blob cm-blob2" />
            <div style={{ position: 'relative', marginBottom: 24 }}>
              <div className="cm-ring cm-ring1" />
              <div className="cm-ring cm-ring2" />
              <Av name={remoteUser?.fullName} size={100} color="#5865f2" photoUrl={remoteUser?.profilePhotoUrl} />
            </div>
            <p className="cm-name">{remoteUser?.fullName}</p>
            <p className="cm-sub">Ringing<Dots /> <span style={{ color: '#57f287', marginLeft: 8 }}>{fmt(duration)}</span></p>
          </div>
        )}

        {/* ══ LIVE — call active ════════════════════════════════════════════ */}
        {isLive && peers.length > 0 && (
          isGroup ? (
            /* ── GROUP ── */
            <div className="cm-grid-wrap">
              <div className={`cm-grid cm-grid${Math.min(peers.length + 1, 4)}`}>
                <Tile videoRef={localVidRef} showVid={showLocalVid} name="You" muted={isMuted} speaking={localSpeak && !isMuted} self />
                {peers.map(peer => (
                  <Tile key={peer.peerId} videoStream={peer.videoStream} showVid={!!peer.videoStream} name={peer.name || peer.peerId} />
                ))}
              </div>
            </div>

          ) : callIsAudio ? (
            /* ── 1-ON-1 AUDIO ── */
            <div className="cm-stage">
              <div className="cm-blob cm-blob1" style={{ opacity: 0.18 }} />
              <div className="cm-blob cm-blob2" style={{ opacity: 0.14 }} />
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 40, marginBottom: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <SpeakAv name={remotePeer?.name || remoteUser?.fullName} size={100} color="#5865f2" speaking={false} photoUrl={remoteUser?.profilePhotoUrl} />
                  <span className="cm-name" style={{ fontSize: 18 }}>{remotePeer?.name || remoteUser?.fullName}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <SpeakAv name={myName} size={66} color="#ed4245" speaking={localSpeak && !isMuted} muted={isMuted} />
                  <span style={{ color: '#72767d', fontSize: 13 }}>You</span>
                </div>
              </div>
              <p className="cm-sub" style={{ color: '#57f287' }}>{fmt(duration)}</p>
            </div>

          ) : (
            /* ── 1-ON-1 VIDEO ── */
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

              {/* Remote fills screen */}
              <div style={{ position: 'absolute', inset: 0, background: '#2f3136', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {hasRemoteVid ? (
                  <video autoPlay playsInline
                    ref={el => { if (el && remotePeer.videoStream) el.srcObject = remotePeer.videoStream }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <SpeakAv name={remotePeer?.name || remoteUser?.fullName} size={110} color="#5865f2" speaking={false} photoUrl={remoteUser?.profilePhotoUrl} />
                )}
              </div>

              {/* Top gradient */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 90,
                background: 'linear-gradient(to bottom,rgba(0,0,0,0.6),transparent)', pointerEvents: 'none' }} />

              {/* Duration */}
              <div style={{ position: 'absolute', top: 18, left: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#57f287', display: 'inline-block', animation: 'cmPulse 2s ease-in-out infinite' }} />
                <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{fmt(duration)}</span>
              </div>

              {/* Remote name tag */}
              <div className="cm-nametag" style={{ bottom: 88, left: 14 }}>
                {remotePeer?.name || remoteUser?.fullName}
              </div>

              {/* Local PiP — draggable */}
              <div ref={pipRef} onMouseDown={onPipDown} className="cm-pip">
                {showLocalVid
                  ? <video ref={localVidRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#36393f' }}>
                      <Av name={myName} size={42} color="#ed4245" />
                    </div>
                }
                <div className="cm-pip-label">You{isMuted ? ' 🔇' : ''}</div>
                {localSpeak && !isMuted && <div className="cm-pip-speak-ring" />}
              </div>
            </div>
          )
        )}

        {/* ══ CONTROL BAR ══════════════════════════════════════════════════ */}
        <div className="cm-bar-wrap">
          <div className="cm-bar">

            {/* Left: timer */}
            <div className="cm-bar-side">
              {isLive && peers.length > 0 && (
                <>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#57f287', display: 'inline-block', animation: 'cmPulse 2s ease-in-out infinite' }} />
                  <span style={{ color: '#dcddde', fontSize: 13, fontWeight: 600 }}>{fmt(duration)}</span>
                </>
              )}
            </div>

            {/* Center: buttons */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <Btn icon={isMuted    ? <MicOff  size={20}/> : <Mic    size={20}/>} label={isMuted    ? 'Unmute'   : 'Mute'}        active={isMuted}    onClick={toggleMute}   />
              <Btn icon={isDeafened ? <VolumeX size={20}/> : <Volume2 size={20}/>} label={isDeafened ? 'Undeafen' : 'Deafen'}     active={isDeafened} onClick={toggleDeafen} />
              {camEnabled
                ? <Btn icon={camOff ? <VideoOff size={20}/> : <Video size={20}/>} label={camOff ? 'Show cam' : 'Hide cam'} active={camOff} onClick={toggleCam} />
                : <Btn icon={<Video size={20}/>} label="Camera" subtle onClick={enableCam} />
              }
              <Btn icon={isSharing ? <MonitorOff size={20}/> : <Monitor size={20}/>} label={isSharing ? 'Stop Share' : 'Share Screen'} active={isSharing} onClick={toggleScreenShare} />
              <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.08)', margin: '6px 6px 0' }} />
              <Btn icon={<Minimize2 size={20}/>} label="Minimize" subtle onClick={() => setIsMinimized(true)} />
              <button className="cm-leave" onClick={handleLeave}>
                <PhoneOff size={17} /> Leave
              </button>
            </div>

            {/* Right: spacer */}
            <div className="cm-bar-side" />
          </div>
        </div>

      </div>
    </>,
    document.body
  )
}

/* ─── sub-components ────────────────────────────────────────────────────────── */

function Av({ name, size, color, photoUrl }) {
  if (photoUrl) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', overflow: 'hidden',
        flexShrink: 0, userSelect: 'none', position: 'relative', zIndex: 1,
      }}>
        <img src={photoUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.38, flexShrink: 0, userSelect: 'none',
      position: 'relative', zIndex: 1,
    }}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  )
}

function SpeakAv({ name, size, color, speaking, muted, photoUrl }) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <div style={{
        position: 'absolute', inset: speaking ? -6 : -2, borderRadius: '50%',
        border: `3px solid ${speaking ? '#57f287' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: speaking ? '0 0 18px #57f28780' : 'none',
        transition: 'all 0.15s',
      }} />
      <Av name={name} size={size} color={color} photoUrl={photoUrl} />
      {muted && (
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: '50%',
          background: '#ed4245', border: '2px solid #1e2124', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MicOff size={11} color="#fff" />
        </div>
      )}
    </div>
  )
}

function Tile({ videoRef, videoStream, showVid, name, muted, speaking, self }) {
  const ref = useRef(null)
  useEffect(() => { if (ref.current && videoStream) ref.current.srcObject = videoStream }, [videoStream])
  return (
    <div style={{
      position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#36393f', minHeight: 140,
      border: `2px solid ${speaking ? '#57f287' : 'transparent'}`,
      boxShadow: speaking ? '0 0 22px #57f28750' : 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
    }}>
      {showVid
        ? <video ref={self ? videoRef : ref} autoPlay playsInline muted={self} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <SpeakAv name={name} size={60} color={self ? '#ed4245' : '#5865f2'} speaking={speaking} muted={muted} />
            <span style={{ color: '#dcddde', fontSize: 13, fontWeight: 600 }}>{name}</span>
          </div>
      }
      <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: '#fff', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>{name}</span>
        {muted && <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#ed4245', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MicOff size={11} color="#fff" /></span>}
      </div>
    </div>
  )
}

function Btn({ icon, label, active, subtle, onClick }) {
  return (
    <button onClick={onClick} title={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 10 }}
      onMouseEnter={e => e.currentTarget.querySelector('.cm-bi').style.filter = 'brightness(1.2)'}
      onMouseLeave={e => e.currentTarget.querySelector('.cm-bi').style.filter = ''}>
      <div className="cm-bi" style={{
        width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', transition: 'background 0.15s',
        background: active ? '#ed4245' : subtle ? 'rgba(88,101,242,0.22)' : 'rgba(255,255,255,0.1)',
        border: subtle ? '1px solid rgba(88,101,242,0.45)' : '1px solid rgba(255,255,255,0.06)',
      }}>{icon}</div>
      <span style={{ fontSize: 11, fontWeight: 500, color: active ? '#fca5a5' : '#72767d', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  )
}

function Dots() {
  return <span className="cm-dots"><span>.</span><span>.</span><span>.</span></span>
}

/* ─── styles ─────────────────────────────────────────────────────────────────── */
const CALL_STYLES = `
  .cm-root {
    position: fixed; inset: 0; z-index: 200;
    display: flex; flex-direction: column;
    background: #1e2124;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    animation: cmIn 0.18s ease;
  }
  @keyframes cmIn { from { opacity:0 } to { opacity:1 } }

  .cm-stage {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    position: relative; overflow: hidden; padding-bottom: 8px;
  }
  .cm-name  { color: #fff; font-weight: 700; font-size: 22px; margin: 0 0 8px; }
  .cm-sub   { color: #72767d; font-size: 14px; margin: 0; display: flex; align-items: center; }
  .cm-spin  { animation: cmSpin 1s linear infinite; }
  @keyframes cmSpin { to { transform: rotate(360deg) } }

  .cm-retry-btn {
    padding: 10px 28px; border-radius: 10px; background: #4f545c; border: none;
    color: #fff; font-weight: 600; font-size: 14px; cursor: pointer;
    font-family: inherit; transition: background 0.1s;
  }
  .cm-retry-btn:hover { background: #5d6269; }

  .cm-blob { position: absolute; border-radius: 50%; filter: blur(70px); pointer-events: none; }
  .cm-blob1 {
    width: 400px; height: 400px; top: -80px; left: -100px;
    background: radial-gradient(circle, #5865f230 0%, transparent 70%);
    animation: cmBlob1 12s ease-in-out infinite alternate;
  }
  .cm-blob2 {
    width: 300px; height: 300px; bottom: -60px; right: -60px;
    background: radial-gradient(circle, #57f28720 0%, transparent 70%);
    animation: cmBlob2 15s ease-in-out infinite alternate;
  }
  @keyframes cmBlob1 { from{transform:translate(0,0)} to{transform:translate(50px,30px)} }
  @keyframes cmBlob2 { from{transform:translate(0,0)} to{transform:translate(-30px,-20px)} }

  .cm-ring {
    position: absolute; inset: 0; border-radius: 50%;
    border: 2px solid #5865f260;
    animation: cmRing 2.2s ease-out infinite;
  }
  .cm-ring2 { inset: -14px; border-color: #5865f230; animation-delay: 0.7s; }
  @keyframes cmRing { 0%{transform:scale(0.85);opacity:1} 100%{transform:scale(1.3);opacity:0} }

  .cm-dots span {
    display: inline-block;
    animation: cmDot 1.4s ease-in-out infinite;
  }
  .cm-dots span:nth-child(2) { animation-delay: 0.2s; }
  .cm-dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes cmDot { 0%,80%,100%{transform:translateY(0);opacity:0.3} 40%{transform:translateY(-4px);opacity:1} }

  .cm-grid-wrap { flex:1; overflow:hidden; padding:14px; }
  .cm-grid { display:grid; height:100%; gap:10px; }
  .cm-grid1 { grid-template-columns:1fr; }
  .cm-grid2 { grid-template-columns:1fr 1fr; }
  .cm-grid3 { grid-template-columns:1fr 1fr 1fr; }
  .cm-grid4 { grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr; }

  .cm-pip {
    position: absolute; bottom: 88px; right: 14px;
    width: 172px; height: 108px; border-radius: 12px; overflow: hidden;
    cursor: grab; border: 2px solid rgba(255,255,255,0.15);
    box-shadow: 0 8px 30px rgba(0,0,0,0.55); z-index: 10; user-select: none;
  }
  .cm-pip:active { cursor: grabbing; }
  .cm-pip-label {
    position: absolute; bottom: 6px; left: 8px;
    color: #fff; font-size: 11px; font-weight: 600;
    text-shadow: 0 1px 4px rgba(0,0,0,0.9); pointer-events: none;
  }
  .cm-pip-speak-ring {
    position: absolute; inset: 0; border-radius: 10px;
    border: 2px solid #57f287; pointer-events: none;
    box-shadow: 0 0 12px #57f28760;
  }

  .cm-nametag {
    position: absolute; color: #fff; font-size: 13px; font-weight: 600;
    padding: 4px 12px; border-radius: 8px;
    background: rgba(0,0,0,0.55); backdrop-filter: blur(8px);
    pointer-events: none;
  }

  .cm-bar-wrap {
    flex-shrink: 0; display: flex; justify-content: center;
    padding: 14px 24px 28px;
    background: linear-gradient(to top, rgba(0,0,0,0.4), transparent);
  }
  .cm-bar {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; padding: 10px 18px; border-radius: 18px; min-width: 400px;
    background: rgba(24,26,29,0.97);
    backdrop-filter: blur(28px);
    border: 1px solid rgba(255,255,255,0.07);
    box-shadow: 0 8px 40px rgba(0,0,0,0.55);
  }
  .cm-bar-side { min-width: 80px; display: flex; align-items: center; gap: 8px; }

  .cm-leave {
    display: flex; align-items: center; gap: 8px;
    height: 44px; padding: 0 20px; border-radius: 12px;
    background: #ed4245; border: none; cursor: pointer;
    color: #fff; font-weight: 700; font-size: 14px; font-family: inherit;
    box-shadow: 0 4px 18px rgba(237,66,69,0.45);
    transition: transform 0.1s, filter 0.1s;
    margin-bottom: 18px;
  }
  .cm-leave:hover  { filter: brightness(1.12); transform: translateY(-1px); }
  .cm-leave:active { transform: scale(0.96); }

  @keyframes cmPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.45;transform:scale(1.35)} }
`
