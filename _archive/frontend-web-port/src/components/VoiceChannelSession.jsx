import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as mediasoupClient from 'mediasoup-client'
import { Volume2, Video, VideoOff, Mic, MicOff, PhoneOff, Monitor, MonitorOff,
    ChevronUp, ChevronDown, Minimize2, Maximize2, Settings2, X, Pin, PinOff, WifiOff } from 'lucide-react'
import toast from 'react-hot-toast'
import useAuthStore from '../store/authStore'
import useVoiceStore from '../store/voiceStore'
import api from '../api/axios'
import { createNoiseProcessor } from '../utils/noiseProcessor'

export default function VoiceChannelSession() {
    const { user, token: storeToken } = useAuthStore()
    const token = storeToken ||
        localStorage.getItem('token') ||
        JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.token || ''
    const { activeChannel, leaveChannel } = useVoiceStore()

    const peerId  = String(user?.id || user?.userId)
    const myName  = user?.fullName || 'You'
    const roomId  = activeChannel?.roomId
    const mode    = activeChannel?.mode || 'audio'

    const [phase,                setPhase]                = useState('connecting')
    const [isMuted,              setIsMuted]              = useState(false)
    const [isSharing,            setIsSharing]            = useState(false)
    const [peers,                setPeers]                = useState([])
    const [showVideo,            setShowVideo]            = useState(false)
    const [minimized,            setMinimized]            = useState(false)
    const [expanded,             setExpanded]             = useState(false)
    const [pinnedPeerId,         setPinnedPeerId]         = useState(null)
    const [showAudioSettings,    setShowAudioSettings]    = useState(false)
    const [audioDevices,         setAudioDevices]         = useState({ mics: [], speakers: [] })
    const [selectedMic,          setSelectedMic]          = useState('')
    const [selectedSpeaker,      setSelectedSpeaker]      = useState('')
    const [videoEnabled,         setVideoEnabled]         = useState(mode === 'video')
    const [noiseSuppression,     setNoiseSuppression]     = useState(true)
    const [nsReady,              setNsReady]              = useState(false)  // true once RNNoise WASM loaded

    const callStartRef      = useRef(Date.now())
    const noiseProcessorRef = useRef(null)

    const wsRef        = useRef(null)
    const deviceRef    = useRef(null)
    const sendTx       = useRef(null)
    const recvTx       = useRef(null)
    const localStream  = useRef(null)
    const producers    = useRef({ audio: null, video: null, screen: null })
    const screenStream = useRef(null)
    const consumers    = useRef(new Map())
    const producerMeta = useRef(new Map())  // producerId → { isScreen }
    const pending      = useRef([])
    const mounted      = useRef(true)
    const closed       = useRef(false)
    const audioEls     = useRef([])
    const localVidRef  = useRef(null)

    useEffect(() => {
        if (!roomId) return
        mounted.current = true
        closed.current  = false
        callStartRef.current = Date.now()
        setPeers([])
        setPhase('connecting')
        setExpanded(mode === 'video')
        startSession()
        return () => {
            mounted.current = false
            doCleanup()
        }
    }, [roomId])

    const startSession = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                // Disable browser's built-in NS — DTLN gives far better quality
                audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true },
                video: mode === 'video'
                    ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
                    : false,
            })
            localStream.current = stream
            if (localVidRef.current) localVidRef.current.srcObject = stream

            // ── Connect to SFU immediately — don't block on DTLN init ─────────
            // This ensures audio/video calls connect right away.
            // DTLN loads in the background and the audio track is replaced once ready.
            const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
            const ws    = new WebSocket(`${proto}://${window.location.host}/sfu?token=${token}`)
            wsRef.current = ws

            ws.onopen    = () => sfuSend({ type: 'join', roomId, peerId, data: { userId: peerId, displayName: myName } })
            ws.onmessage = e => handleSfuMsg(JSON.parse(e.data))
            ws.onerror   = () => toast.error('Voice connection error')
            ws.onclose   = () => { if (mounted.current && !closed.current) setPhase('disconnected') }

            // ── Init DTLN in background — replace audio track when ready ──────
            createNoiseProcessor(stream).then(processor => {
                if (!processor || !mounted.current) return
                noiseProcessorRef.current = processor
                setNsReady(true)
                // Transparently replace the live audio producer track
                const audioProducer = producers.current.audio
                if (audioProducer && !audioProducer.closed) {
                    audioProducer.replaceTrack({ track: processor.track }).catch(console.warn)
                }
            }).catch(() => {
                // DTLN unavailable — fall back to browser NS on the raw track
                try {
                    stream.getAudioTracks()[0]
                        ?.applyConstraints({ noiseSuppression: true, echoCancellation: true })
                } catch {}
            })
        } catch (err) {
            if (err.name === 'NotAllowedError') toast.error('Microphone permission denied')
            else toast.error('Could not start voice: ' + err.message)
            setPhase('error')
        }
    }

    const handleSfuMsg = async msg => {
        if (!mounted.current) return

        switch (msg.type) {
            case 'joined': {
                const dev = new mediasoupClient.Device()
                await dev.load({ routerRtpCapabilities: msg.rtpCapabilities })
                deviceRef.current = dev
                if (Array.isArray(msg.producers) && msg.producers.length) pending.current.push(...msg.producers)
                sfuSend({ type: 'createTransport', roomId, peerId, data: { direction: 'send' } })
                break
            }
            case 'transportCreated': {
                const { transportId, direction, iceParameters, iceCandidates, dtlsParameters } = msg
                const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }]
                if (direction === 'send') {
                    const t = deviceRef.current.createSendTransport({ id: transportId, iceParameters, iceCandidates, dtlsParameters, iceServers })
                    t.on('connect', ({ dtlsParameters: dp }, cb) => { sfuSend({ type: 'connectTransport', roomId, peerId, data: { transportId, dtlsParameters: dp } }); cb() })
                    t.on('produce', ({ kind, rtpParameters, appData }, cb) => { sfuSend({ type: 'produce', roomId, peerId, data: { transportId, kind, rtpParameters, appData } }); t._produceCb = cb })
                    sendTx.current = t
                    await produceMedia()
                    sfuSend({ type: 'createTransport', roomId, peerId, data: { direction: 'recv' } })
                } else {
                    const t = deviceRef.current.createRecvTransport({ id: transportId, iceParameters, iceCandidates, dtlsParameters, iceServers })
                    t.on('connect', ({ dtlsParameters: dp }, cb) => { sfuSend({ type: 'connectTransport', roomId, peerId, data: { transportId, dtlsParameters: dp } }); cb() })
                    recvTx.current = t
                    for (const p of pending.current) consumeProducer(p)
                    pending.current = []
                    setPhase('live')
                }
                break
            }
            case 'produced': {
                const t = sendTx.current
                if (t?._produceCb) { t._produceCb({ id: msg.producerId }); t._produceCb = null }
                break
            }
            case 'new-producer':
                recvTx.current ? consumeProducer(msg) : pending.current.push(msg)
                break
            case 'consumed': {
                const { consumerId, producerId, kind, rtpParameters } = msg
                const consumer = await recvTx.current.consume({ id: consumerId, producerId, kind, rtpParameters })
                const fromPeer = consumers.current.get('__p_' + producerId)
                const meta     = producerMeta.current.get(producerId) || {}
                const isScreen = meta.isScreen || false
                consumers.current.delete('__p_' + producerId)
                consumers.current.set(consumerId, { consumer, peerId: fromPeer, kind, isScreen })
                if (kind === 'video') {
                    const stream = new MediaStream([consumer.track])
                    setPeers(prev => {
                        const hit = prev.find(p => p.peerId === fromPeer)
                        const patch = isScreen ? { screenStream: stream } : { videoStream: stream }
                        if (hit) return prev.map(p => p.peerId === fromPeer ? { ...p, ...patch } : p)
                        return [...prev, { peerId: fromPeer, name: fromPeer, videoStream: null, screenStream: null, ...patch }]
                    })
                } else {
                    const audio = new Audio()
                    audio.srcObject = new MediaStream([consumer.track])
                    audioEls.current.push(audio)
                    audio.play().catch(() => {})
                    if (fromPeer) setPeers(prev => prev.find(p => p.peerId === fromPeer)
                        ? prev
                        : [...prev, { peerId: fromPeer, name: fromPeer, videoStream: null, screenStream: null }])
                }
                sfuSend({ type: 'resumeConsumer', roomId, peerId, data: { consumerId } })
                break
            }
            case 'consumer-closed': {
                const entry = consumers.current.get(msg.consumerId)
                if (entry) {
                    consumers.current.delete(msg.consumerId)
                    if (entry.kind === 'video') {
                        if (entry.isScreen) {
                            setPeers(prev => prev.map(p => p.peerId === entry.peerId ? { ...p, screenStream: null } : p))
                        } else {
                            setPeers(prev => prev.map(p => p.peerId === entry.peerId ? { ...p, videoStream: null } : p))
                        }
                    }
                }
                break
            }
            case 'peer-joined':
                setPeers(prev => prev.find(p => p.peerId === msg.peerId)
                    ? prev
                    : [...prev, { peerId: msg.peerId, name: msg.displayName || msg.peerId, videoStream: null, screenStream: null }])
                break
            case 'peer-left':
                setPeers(prev => prev.filter(p => p.peerId !== msg.peerId))
                if (pinnedPeerId === msg.peerId) setPinnedPeerId(null)
                break
        }
    }

    const consumeProducer = ({ producerId, peerId: fromPeer, kind, appData }) => {
        const isScreen = appData?.kind === 'screen'
        producerMeta.current.set(producerId, { isScreen })
        consumers.current.set('__p_' + producerId, fromPeer)
        sfuSend({ type: 'consume', roomId, peerId, data: { transportId: recvTx.current.id, producerId, rtpCapabilities: deviceRef.current.rtpCapabilities } })
    }

    const produceMedia = async () => {
        const t  = sendTx.current
        if (!t) return
        // Start with the raw mic track — DTLN will call replaceTrack() once ready
        const at = localStream.current?.getAudioTracks()[0]
        if (at) producers.current.audio = await t.produce({ track: at })
        if (mode === 'video') {
            const vt = localStream.current?.getVideoTracks()[0]
            if (vt) producers.current.video = await t.produce({
                track: vt,
                encodings: [{ maxBitrate: 100_000, scaleResolutionDownBy: 4 }, { maxBitrate: 300_000, scaleResolutionDownBy: 2 }, { maxBitrate: 900_000 }],
                codecOptions: { videoGoogleStartBitrate: 1000 },
            })
        }
    }

    const doCleanup = () => {
        noiseProcessorRef.current?.dispose()
        noiseProcessorRef.current = null
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

    const sfuSend = msg => {
        if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(msg))
    }

    const toggleMute = () => {
        // Mute/unmute both the raw mic track and (if active) the DTLN output track
        const rawTrack = localStream.current?.getAudioTracks()[0]
        const nsTrack  = noiseProcessorRef.current?.track
        const next = rawTrack ? !rawTrack.enabled : !isMuted
        if (rawTrack) rawTrack.enabled = next
        if (nsTrack)  nsTrack.enabled  = next
        setIsMuted(!next)
    }

    const toggleScreenShare = async () => {
        if (isSharing) {
            try { screenStream.current?.getTracks().forEach(t => t.stop()); producers.current.screen?.close(); producers.current.screen = null; screenStream.current = null } catch {}
            setIsSharing(false)
            return
        }
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
            screenStream.current = stream
            const track = stream.getVideoTracks()[0]
            track.addEventListener('ended', () => { setIsSharing(false); producers.current.screen = null })
            if (sendTx.current) producers.current.screen = await sendTx.current.produce({
                track,
                encodings: [{ maxBitrate: 1_500_000 }],
                appData: { kind: 'screen' }
            })
            setIsSharing(true)
        } catch (err) {
            if (err.name !== 'NotAllowedError') toast.error('Screen share failed')
        }
    }

    const handleLeave = async () => {
        sfuSend({ type: 'leave', roomId, peerId, data: {} })
        closed.current = true
        doCleanup()
        await leaveChannel()
    }

    useEffect(() => {
        if (!showAudioSettings) return
        navigator.mediaDevices.enumerateDevices().then(devices => {
            setAudioDevices({
                mics:     devices.filter(d => d.kind === 'audioinput'),
                speakers: devices.filter(d => d.kind === 'audiooutput'),
            })
        }).catch(() => {})
    }, [showAudioSettings])

    const toggleVideo = async () => {
        const track = localStream.current?.getVideoTracks()[0]
        if (track) {
            track.enabled = !track.enabled
            setVideoEnabled(v => !v)
        } else if (!videoEnabled) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true })
                const vt = stream.getVideoTracks()[0]
                localStream.current?.addTrack(vt)
                if (localVidRef.current) localVidRef.current.srcObject = localStream.current
                if (sendTx.current) {
                    producers.current.video = await sendTx.current.produce({
                        track: vt,
                        encodings: [{ maxBitrate: 100_000, scaleResolutionDownBy: 4 }, { maxBitrate: 300_000, scaleResolutionDownBy: 2 }, { maxBitrate: 900_000 }],
                        codecOptions: { videoGoogleStartBitrate: 1000 },
                    })
                }
                setVideoEnabled(true)
            } catch { toast.error('Camera permission denied') }
        }
    }

    const toggleNoiseSuppression = () => {
        const next = !noiseSuppression
        noiseProcessorRef.current?.setBypass(!next)  // bypass=true when NS is off
        setNoiseSuppression(next)
    }

    const applyMicDevice = async (deviceId) => {
        setSelectedMic(deviceId)
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: false, autoGainControl: true }
            })
            const rawTrack = stream.getAudioTracks()[0]

            // Rebuild RNNoise pipeline for the new mic stream
            noiseProcessorRef.current?.dispose()
            noiseProcessorRef.current = await createNoiseProcessor(stream)
            if (!noiseSuppression) noiseProcessorRef.current?.setBypass(true)

            const activeTrack = noiseProcessorRef.current?.track ?? rawTrack
            const producer = producers.current.audio
            if (producer) await producer.replaceTrack({ track: activeTrack })

            const old = localStream.current?.getAudioTracks()[0]
            if (old) { old.stop(); localStream.current?.removeTrack(old) }
            localStream.current?.addTrack(rawTrack)
        } catch { toast.error('Could not switch microphone') }
    }

    if (!activeChannel) return null

    const dot = phase === 'live' ? 'bg-green-500' : phase === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-red-500'

    // Shared controls bar (used in both expanded and bottom-bar modes)
    const ControlsBar = ({ inExpanded = false }) => (
        <div className={`flex items-center gap-2 ${inExpanded ? 'justify-center' : ''}`}>
            <BarBtn onClick={toggleMute} active={!isMuted} activeClass="bg-green-600/20 text-green-400" inactiveClass="bg-red-600/20 text-red-400" title={isMuted ? 'Unmute' : 'Mute'}>
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </BarBtn>
            <BarBtn onClick={toggleVideo} active={videoEnabled} activeClass="bg-green-600/20 text-green-400" inactiveClass="bg-red-600/20 text-red-400" title={videoEnabled ? 'Stop video' : 'Start video'}>
                {videoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </BarBtn>
            <BarBtn onClick={toggleScreenShare} active={!isSharing} activeClass="bg-slate-700/60 text-slate-300" inactiveClass="bg-blue-600/20 text-blue-400" title={isSharing ? 'Stop sharing' : 'Share screen'}>
                {isSharing ? <MonitorOff className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
            </BarBtn>
            <BarBtn
                onClick={toggleNoiseSuppression}
                active={noiseSuppression}
                activeClass={nsReady ? "bg-teal-600/20 text-teal-400" : "bg-yellow-600/20 text-yellow-400"}
                inactiveClass="bg-slate-700/60 text-slate-400"
                title={noiseSuppression
                    ? (nsReady ? 'AI noise suppression on (RNNoise)' : 'Noise suppression on (browser fallback)')
                    : 'Noise suppression off'}
            >
                <WifiOff className="w-4 h-4" />
            </BarBtn>
            <BarBtn onClick={() => setShowAudioSettings(v => !v)} active={showAudioSettings} activeClass="bg-purple-600/20 text-purple-400" inactiveClass="bg-slate-700/60 text-slate-400" title="Audio settings">
                <Settings2 className="w-4 h-4" />
            </BarBtn>
            {!inExpanded && (
                <BarBtn onClick={() => setShowVideo(v => !v)} active={showVideo} activeClass="bg-blue-600/20 text-blue-400" inactiveClass="bg-slate-700/60 text-slate-400" title="Toggle video panel">
                    {showVideo ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </BarBtn>
            )}
            {!inExpanded && (
                <BarBtn onClick={() => setMinimized(true)} active={false} activeClass="" inactiveClass="bg-slate-700/60 text-slate-400" title="Minimize">
                    <Minimize2 className="w-4 h-4" />
                </BarBtn>
            )}
            <button
                onClick={handleLeave}
                className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ml-1"
                title="Leave channel"
            >
                <PhoneOff className="w-3.5 h-3.5" /> Leave
            </button>
        </div>
    )

    // ── Minimized PiP bubble ──────────────────────────────────────────────────
    if (minimized) {
        return createPortal(
            <div
                className="fixed bottom-4 right-4 z-[9100] flex items-center gap-2 rounded-2xl px-3 py-2 shadow-2xl cursor-pointer select-none"
                style={{ background: 'rgba(35,36,58,0.97)', border: '1px solid rgba(87,242,135,0.25)', backdropFilter: 'blur(12px)' }}
                onClick={() => setMinimized(false)}
                title="Expand voice session"
            >
                <div className={`w-2 h-2 rounded-full ${dot}`} />
                <Volume2 className="w-3.5 h-3.5 text-green-400" />
                <span className="text-xs text-green-300 font-semibold max-w-[120px] truncate">{activeChannel.channelName}</span>
                <span className="text-[10px] text-slate-500">{peers.length + 1}</span>
                <Maximize2 className="w-3.5 h-3.5 text-slate-400 ml-1" />
                <button
                    onClick={e => { e.stopPropagation(); handleLeave() }}
                    className="ml-1 text-red-400 hover:text-red-300 transition-colors"
                    title="Leave"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>,
            document.body
        )
    }

    // ── Expanded Discord-style full-screen view ───────────────────────────────
    if (expanded) {
        const screenSharers = peers.filter(p => p.screenStream)
        const hasScreenShare = isSharing || screenSharers.length > 0

        // Determine what to show in the main area
        const mainPeer = pinnedPeerId
            ? peers.find(p => p.peerId === pinnedPeerId)
            : (screenSharers[0] || null)
        const mainStream = mainPeer?.screenStream || mainPeer?.videoStream || null

        // Show grid when no pinned/screen, or show main+sidebar
        const showGrid = !mainStream && !pinnedPeerId
        const allParticipants = [null, ...peers]  // null = self
        const gridCount = allParticipants.length
        const gridCols = gridCount <= 1 ? 1 : gridCount <= 2 ? 2 : gridCount <= 4 ? 2 : gridCount <= 6 ? 3 : gridCount <= 9 ? 3 : 4
        const gridRows = Math.ceil(gridCount / gridCols)

        return createPortal(
            <div className="fixed inset-0 z-[9100] flex flex-col" style={{ background: '#0f1117' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/40" style={{ background: 'rgba(20,21,35,0.95)' }}>
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                        <Volume2 className="w-4 h-4 text-green-400" />
                        <span className="text-sm font-semibold text-green-300">{activeChannel.channelName}</span>
                        <span className="text-xs text-slate-500 ml-1">
                            {phase === 'live' ? `${peers.length + 1} connected` : phase === 'connecting' ? 'Connecting…' : 'Disconnected'}
                        </span>
                        {isSharing && (
                            <span className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/15 px-2 py-0.5 rounded-full ml-2">
                                <Monitor className="w-3 h-3" /> Sharing screen
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <BarBtn onClick={() => setExpanded(false)} active={false} activeClass="" inactiveClass="bg-slate-700/60 text-slate-400" title="Exit fullscreen">
                            <Minimize2 className="w-4 h-4" />
                        </BarBtn>
                        <BarBtn onClick={() => setMinimized(true)} active={false} activeClass="" inactiveClass="bg-slate-700/60 text-slate-400" title="Minimize to PiP">
                            <X className="w-4 h-4" />
                        </BarBtn>
                    </div>
                </div>

                {/* Main content */}
                <div className="flex-1 flex overflow-hidden p-1.5 gap-1.5">
                    {showGrid ? (
                        // ── Participant grid (no screen share / no pinned) ─────────
                        <div
                            className="flex-1 grid gap-1.5"
                            style={{
                                gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                                gridTemplateRows: `repeat(${gridRows}, 1fr)`,
                            }}
                        >
                            {/* Self tile */}
                            <ParticipantTile
                                name="You"
                                isMe
                                stream={videoEnabled ? localStream.current : null}
                                isMuted={isMuted}
                                onPin={null}
                                photoUrl={user?.profilePhotoUrl}
                            />
                            {/* Remote peers */}
                            {peers.map(p => (
                                <ParticipantTile
                                    key={p.peerId}
                                    name={p.name || p.peerId}
                                    stream={p.videoStream}
                                    hasScreen={!!p.screenStream}
                                    isPinned={pinnedPeerId === p.peerId}
                                    onPin={() => setPinnedPeerId(pinnedPeerId === p.peerId ? null : p.peerId)}
                                />
                            ))}
                        </div>
                    ) : (
                        // ── Main view + sidebar ────────────────────────────────────
                        <>
                            {/* Main area: screen share or pinned participant */}
                            <div className="flex-1 relative rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center">
                                {mainStream ? (
                                    <RemoteVideo stream={mainStream} className="w-full h-full object-contain" />
                                ) : mainPeer ? (
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-20 h-20 rounded-full bg-purple-600 flex items-center justify-center">
                                            <span className="text-white text-3xl font-bold">{(mainPeer.name || '?').charAt(0)}</span>
                                        </div>
                                        <p className="text-white font-semibold">{mainPeer.name || mainPeer.peerId}</p>
                                    </div>
                                ) : null}

                                {/* Self-camera overlay in bottom-right */}
                                {videoEnabled && localStream.current && (
                                    <div className="absolute bottom-4 right-4 w-40 h-24 rounded-xl overflow-hidden border-2 border-slate-600 shadow-2xl">
                                        <video
                                            autoPlay muted playsInline
                                            className="w-full h-full object-cover"
                                            ref={el => { if (el && localStream.current) el.srcObject = localStream.current }}
                                        />
                                        <span className="absolute bottom-1 left-2 text-[10px] text-white/80 bg-black/50 rounded px-1">You</span>
                                    </div>
                                )}

                                {/* Label for screen share */}
                                {mainPeer && mainPeer.screenStream && (
                                    <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 rounded-lg px-2 py-1">
                                        <Monitor className="w-3.5 h-3.5 text-blue-400" />
                                        <span className="text-xs text-white/80">{mainPeer.name || mainPeer.peerId}'s screen</span>
                                    </div>
                                )}

                                {/* Pin button */}
                                {mainPeer && (
                                    <button
                                        onClick={() => setPinnedPeerId(null)}
                                        className="absolute top-3 right-3 flex items-center gap-1 bg-black/60 hover:bg-black/80 rounded-lg px-2 py-1 text-xs text-slate-300 transition-all"
                                    >
                                        <PinOff className="w-3.5 h-3.5" /> Unpin
                                    </button>
                                )}
                            </div>

                            {/* Right sidebar: participant thumbnails */}
                            <div className="w-44 flex flex-col gap-2 overflow-y-auto">
                                {/* Self */}
                                <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-800 flex-shrink-0">
                                    {videoEnabled && localStream.current ? (
                                        <video
                                            autoPlay muted playsInline
                                            className="w-full h-full object-cover"
                                            ref={el => { if (el && localStream.current) el.srcObject = localStream.current }}
                                        />
                                    ) : (
                                        <AvatarTile name="You" photoUrl={user?.profilePhotoUrl} />
                                    )}
                                    <span className="absolute bottom-1 left-2 text-[10px] text-white/80 bg-black/50 rounded px-1">You</span>
                                    {isMuted && <MicOff className="absolute top-1 right-1 w-3 h-3 text-red-400" />}
                                </div>
                                {peers.map(p => (
                                    <div
                                        key={p.peerId}
                                        className={`relative aspect-video rounded-xl overflow-hidden bg-slate-800 flex-shrink-0 cursor-pointer transition-all
                                            ${pinnedPeerId === p.peerId ? 'ring-2 ring-blue-400' : 'hover:ring-1 hover:ring-slate-500'}`}
                                        onClick={() => setPinnedPeerId(pinnedPeerId === p.peerId ? null : p.peerId)}
                                        title={pinnedPeerId === p.peerId ? 'Unpin' : 'Pin'}
                                    >
                                        {p.videoStream
                                            ? <RemoteVideo stream={p.videoStream} className="w-full h-full object-cover" />
                                            : <AvatarTile name={p.name || p.peerId} />
                                        }
                                        <span className="absolute bottom-1 left-2 text-[10px] text-white/80 bg-black/50 rounded px-1">{p.name || p.peerId}</span>
                                        {p.screenStream && (
                                            <Monitor className="absolute top-1 right-1 w-3 h-3 text-blue-400" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Audio settings popup */}
                {showAudioSettings && (
                    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 w-64 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-4 space-y-3">
                        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Audio Settings</p>
                        <div>
                            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Microphone</label>
                            <select value={selectedMic} onChange={e => applyMicDevice(e.target.value)}
                                    className="w-full bg-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1.5 border border-slate-700 outline-none">
                                <option value="">Default</option>
                                {audioDevices.mics.map(d => (
                                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0,6)}`}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Speaker</label>
                            <select value={selectedSpeaker} onChange={e => setSelectedSpeaker(e.target.value)}
                                    className="w-full bg-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1.5 border border-slate-700 outline-none">
                                <option value="">Default</option>
                                {audioDevices.speakers.map(d => (
                                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.slice(0,6)}`}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

                {/* Controls bar */}
                <div className="px-4 py-3 border-t border-slate-700/40 flex items-center justify-center" style={{ background: 'rgba(20,21,35,0.95)' }}>
                    <ControlsBar inExpanded />
                </div>
            </div>,
            document.body
        )
    }

    // ── Non-expanded: bottom bar + optional panels ────────────────────────────
    return createPortal(
        <>
            {/* Floating video panel */}
            {showVideo && (peers.length > 0 || mode === 'video') && (
                <div className="fixed bottom-20 right-4 z-[9000] w-72 max-h-96 overflow-auto rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-3 space-y-2">
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Participants</p>
                    <div className="relative rounded-xl overflow-hidden bg-slate-800 aspect-video">
                        {mode === 'video'
                            ? <video ref={localVidRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                            : <AvatarTile name="You" photoUrl={user?.profilePhotoUrl} />
                        }
                        <span className="absolute bottom-1 left-2 text-xs text-white/80 bg-black/40 rounded px-1">You</span>
                    </div>
                    {peers.map(p => (
                        <div key={p.peerId} className="relative rounded-xl overflow-hidden bg-slate-800 aspect-video">
                            {p.videoStream
                                ? <RemoteVideo stream={p.videoStream} />
                                : <AvatarTile name={p.name || '?'} />
                            }
                            <span className="absolute bottom-1 left-2 text-xs text-white/80 bg-black/40 rounded px-1">{p.name || p.peerId}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Audio settings dropdown */}
            {showAudioSettings && (
                <div className="fixed bottom-16 right-4 z-[9001] w-64 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-4 space-y-3">
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Audio Settings</p>
                    <div>
                        <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Microphone</label>
                        <select value={selectedMic} onChange={e => applyMicDevice(e.target.value)}
                                className="w-full bg-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1.5 border border-slate-700 outline-none">
                            <option value="">Default</option>
                            {audioDevices.mics.map(d => (
                                <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0,6)}`}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Speaker</label>
                        <select value={selectedSpeaker} onChange={e => setSelectedSpeaker(e.target.value)}
                                className="w-full bg-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1.5 border border-slate-700 outline-none">
                            <option value="">Default</option>
                            {audioDevices.speakers.map(d => (
                                <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.slice(0,6)}`}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {/* Bottom bar */}
            <div className="fixed bottom-0 left-0 right-0 z-[8999] h-14 flex items-center px-4 gap-3"
                 style={{ background: 'rgba(35,36,58,0.98)', borderTop: '1px solid rgba(87,242,135,0.2)', backdropFilter: 'blur(12px)' }}>

                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`} />
                    <Volume2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <div className="min-w-0">
                        <p className="text-xs font-semibold text-green-300 truncate">{activeChannel.channelName}</p>
                        <p className="text-[10px] text-slate-500">
                            {phase === 'live' ? `${peers.length + 1} connected` : phase === 'connecting' ? 'Connecting…' : 'Disconnected'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <ControlsBar />
                    {/* Expand to fullscreen */}
                    <BarBtn onClick={() => setExpanded(true)} active={false} activeClass="" inactiveClass="bg-slate-700/60 text-slate-400" title="Expand to fullscreen">
                        <Maximize2 className="w-4 h-4" />
                    </BarBtn>
                </div>
            </div>
        </>,
        document.body
    )
}

// ── Helper components ─────────────────────────────────────────────────────────

function BarBtn({ onClick, active, activeClass, inactiveClass, title, children }) {
    return (
        <button
            onClick={onClick}
            title={title}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-105 ${active ? activeClass : inactiveClass}`}
        >
            {children}
        </button>
    )
}

function RemoteVideo({ stream, className = 'w-full h-full object-cover' }) {
    const ref = useRef(null)
    useEffect(() => { if (ref.current) ref.current.srcObject = stream }, [stream])
    return <video ref={ref} autoPlay playsInline className={className} />
}

function AvatarTile({ name, photoUrl }) {
    return (
        <div className="w-full h-full flex items-center justify-center bg-slate-800">
            {photoUrl ? (
                <img src={photoUrl} alt={name} className="w-16 h-16 rounded-full object-cover ring-2 ring-slate-600" />
            ) : (
                <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
                    <span className="text-white text-lg font-bold">{(name || '?').charAt(0).toUpperCase()}</span>
                </div>
            )}
        </div>
    )
}

function ParticipantTile({ name, isMe, stream, hasScreen, isPinned, onPin, isMuted, photoUrl }) {
    const ref = useRef(null)
    useEffect(() => {
        if (ref.current && stream) ref.current.srcObject = stream
    }, [stream])
    return (
        <div
            className={`relative rounded-lg overflow-hidden bg-[#1e1f2e] w-full h-full min-h-0
                ${onPin ? 'cursor-pointer transition-all' : ''}
                ${isPinned ? 'ring-2 ring-blue-400' : 'hover:ring-1 hover:ring-white/20'}`}
            onClick={onPin}
            title={onPin ? (isPinned ? 'Unpin' : 'Pin to main view') : undefined}
        >
            {stream ? (
                <video ref={ref} autoPlay playsInline muted={isMe} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
                <AvatarTile name={name} photoUrl={photoUrl} />
            )}
            {/* Name + status bar — always visible at bottom */}
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-2.5 py-1.5 bg-gradient-to-t from-black/70 to-transparent">
                <span className="text-xs text-white/90 font-medium truncate">{name}</span>
                <div className="flex items-center gap-1">
                    {isMuted && <MicOff className="w-3 h-3 text-red-400" />}
                    {hasScreen && <Monitor className="w-3 h-3 text-blue-400" />}
                    {isPinned && <Pin className="w-3 h-3 text-blue-400" />}
                </div>
            </div>
        </div>
    )
}
