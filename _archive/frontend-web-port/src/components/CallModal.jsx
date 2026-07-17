import { useEffect, useRef, useState, useCallback } from 'react'
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

/**
 * ICE servers config — STUN + TURN for NAT traversal in production.
 *
 * Without TURN, WebRTC fails on most real networks (mobile, corporate, behind NAT).
 * Using Open Relay (Metered.ca) free tier — replace with your own TURN if needed.
 *
 * To use your own TURN server (coturn self-hosted):
 *   { urls: 'turn:YOUR_SERVER_IP:3478', username: 'user', credential: 'pass' }
 */
const ICE_SERVERS = {
    iceServers: [
        // STUN
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:168.119.177.75:3478' },
        // TURN — self-hosted coturn on myincolab.com VPS
        {
            urls: 'turn:168.119.177.75:3478',
            username: 'incolab',
            credential: 'TurnPass2024!',
        },
        {
            urls: 'turn:168.119.177.75:3478?transport=tcp',
            username: 'incolab',
            credential: 'TurnPass2024!',
        },
        {
            urls: 'turns:168.119.177.75:5349',
            username: 'incolab',
            credential: 'TurnPass2024!',
        },
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
}

export default function CallModal({
                                      mode, direction, remoteUser, stompClient, currentUser,
                                      incomingOffer, sounds, onClose
                                  }) {
    const [callState,  setCallState]  = useState(direction === 'incoming' ? 'ringing' : 'connecting')
    const [isMuted,    setIsMuted]    = useState(false)
    const [isVideoOff, setIsVideoOff] = useState(false)
    const [duration,   setDuration]   = useState(0)
    const [iceState,   setIceState]   = useState('')

    // Validate remoteUser.id early — prevents "undefined" in WebSocket paths
    const remoteUserId = (remoteUser?.id != null && String(remoteUser.id) !== 'undefined')
        ? remoteUser.id
        : null

    const pcRef              = useRef(null)
    const localStream        = useRef(null)
    const localVideo         = useRef(null)
    const remoteVideo        = useRef(null)
    const durationRef        = useRef(null)
    const subRef             = useRef(null)
    const iceCandidateQueue  = useRef([])
    const remoteDescSet      = useRef(false)
    const callConnected      = useRef(false)

    // ── Subscribe to signaling channel ────────────────────────────────────────
    useEffect(() => {
        if (!remoteUserId) {
            toast.error("Identifiant invalide — rechargez et réessayez")
            onClose()
            return
        }
        if (!stompClient?.connected) {
            toast.error('Connexion perdue — rechargez la page')
            onClose()
            return
        }
        subRef.current = stompClient.subscribe(`/topic/call/${currentUser.id}`, msg => {
            try { handleSignal(JSON.parse(msg.body)) } catch {}
        })
        return () => { subRef.current?.unsubscribe() }
    }, [])

    // ── Init ──────────────────────────────────────────────────────────────────
    useEffect(() => {
        initCall()
        return () => cleanup()
    }, [])

    const initCall = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: mode === 'video' ? { width: 1280, height: 720 } : false,
            })
            localStream.current = stream
            if (localVideo.current) localVideo.current.srcObject = stream

            const pc = new RTCPeerConnection(ICE_SERVERS)
            pcRef.current = pc

            stream.getTracks().forEach(track => pc.addTrack(track, stream))

            // Remote tracks
            pc.ontrack = e => {
                if (e.streams?.[0]) {
                    if (remoteVideo.current) remoteVideo.current.srcObject = e.streams[0]
                }
            }

            // ICE candidates — send to remote
            pc.onicecandidate = e => {
                if (e.candidate && stompClient?.connected) {
                    stompClient.publish({
                        destination: `/app/call/${remoteUserId}/ice`,
                        body: JSON.stringify({ candidate: e.candidate.toJSON() })
                    })
                }
            }

            pc.onicecandidateerror = e => {
                // 701 = TURN allocation failed (expected if TURN is unavailable, still try P2P)
                console.warn('ICE candidate error:', e.errorCode, e.errorText)
            }

            pc.oniceconnectionstatechange = () => {
                const s = pc.iceConnectionState
                setIceState(s)
                console.log('ICE state:', s)
                if (s === 'connected' || s === 'completed') {
                    if (!callConnected.current) {
                        callConnected.current = true
                        setCallState('connected')
                        sounds?.stopCallRinging()
                        sounds?.playCallAccepted()
                        startTimer()
                    }
                }
                if (s === 'failed') {
                    // Try ICE restart
                    console.warn('ICE failed — attempting restart')
                    pc.restartIce()
                }
                if (s === 'disconnected') {
                    // Give 5s to reconnect before closing
                    setTimeout(() => {
                        if (pc.iceConnectionState === 'disconnected') {
                            sounds?.playCallEnded()
                            cleanup()
                            onClose()
                        }
                    }, 5000)
                }
            }

            pc.onconnectionstatechange = () => {
                const s = pc.connectionState
                console.log('Connection state:', s)
                if (['failed', 'closed'].includes(s)) {
                    sounds?.playCallEnded()
                    cleanup()
                    onClose()
                }
            }

            // ── Outgoing call ─────────────────────────────────────────────────
            if (direction === 'outgoing') {
                const offer = await pc.createOffer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: mode === 'video',
                })
                await pc.setLocalDescription(offer)
                stompClient.publish({
                    destination: `/app/call/${remoteUserId}/offer`,
                    body: JSON.stringify({
                        sdp:      { type: offer.type, sdp: offer.sdp },
                        callMode: mode,
                    })
                })
                setCallState('ringing')
            }

            // ── Incoming call ─────────────────────────────────────────────────
            if (direction === 'incoming' && incomingOffer) {
                const sdp = incomingOffer.sdp
                const sessionDesc = typeof sdp === 'string'
                    ? new RTCSessionDescription({ type: 'offer', sdp })
                    : new RTCSessionDescription(sdp)

                await pc.setRemoteDescription(sessionDesc)
                remoteDescSet.current = true

                for (const c of iceCandidateQueue.current) {
                    try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch {}
                }
                iceCandidateQueue.current = []
            }

        } catch (err) {
            console.error('Call init error:', err)
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                toast.error('Permission denied — allow microphone/camera access')
            } else if (err.name === 'NotFoundError') {
                toast.error('No camera/microphone found')
            } else if (err.name === 'NotReadableError') {
                toast.error('Camera/microphone is already in use by another app')
            } else {
                toast.error('Could not start call: ' + (err.message || 'unknown error'))
            }
            onClose()
        }
    }

    const handleSignal = useCallback(async data => {
        const pc = pcRef.current
        if (!pc) return

        if (data.type === 'answer' && direction === 'outgoing') {
            try {
                const sdp = data.sdp
                const sessionDesc = typeof sdp === 'string'
                    ? new RTCSessionDescription({ type: 'answer', sdp })
                    : new RTCSessionDescription(sdp)
                await pc.setRemoteDescription(sessionDesc)
                remoteDescSet.current = true

                for (const c of iceCandidateQueue.current) {
                    try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch {}
                }
                iceCandidateQueue.current = []
                setCallState('connecting')
                sounds?.stopCallRinging()
            } catch (err) { console.error('Failed to set answer:', err) }
        }

        if (data.type === 'ice-candidate' && data.candidate) {
            if (remoteDescSet.current && pc.remoteDescription) {
                try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)) } catch {}
            } else {
                iceCandidateQueue.current.push(data.candidate)
            }
        }

        if (data.type === 'hangup') {
            toast('Call ended', { icon: '📵' })
            sounds?.playCallEnded()
            cleanup(); onClose()
        }

        if (data.type === 'rejected') {
            toast(`${remoteUser.fullName} declined the call`, { icon: '❌' })
            sounds?.playCallRejected()
            cleanup(); onClose()
        }
    }, [direction, remoteUser?.fullName])

    const acceptCall = async () => {
        const pc = pcRef.current
        if (!pc) return
        setCallState('connecting')
        try {
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            stompClient.publish({
                destination: `/app/call/${remoteUserId}/answer`,
                body: JSON.stringify({ sdp: { type: answer.type, sdp: answer.sdp } })
            })
        } catch (err) {
            console.error('Failed to create answer:', err)
            toast.error('Failed to accept call')
            handleHangup()
        }
    }

    const rejectCall = () => {
        stompClient?.publish({
            destination: `/app/call/${remoteUserId}/reject`,
            body: JSON.stringify({})
        })
        sounds?.playCallRejected()
        cleanup(); onClose()
    }

    const handleHangup = useCallback(() => {
        if (stompClient?.connected) {
            stompClient.publish({
                destination: `/app/call/${remoteUserId}/hangup`,
                body: JSON.stringify({})
            })
        }
        sounds?.playCallEnded()
        cleanup(); onClose()
    }, [remoteUserId])

    const cleanup = () => {
        clearInterval(durationRef.current)
        localStream.current?.getTracks().forEach(t => t.stop())
        if (pcRef.current) { pcRef.current.close(); pcRef.current = null }
    }

    const startTimer = () => {
        durationRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    }

    const formatDuration = s =>
        `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

    const toggleMute = () => {
        localStream.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
        setIsMuted(v => !v)
    }

    const toggleVideo = () => {
        localStream.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled })
        setIsVideoOff(v => !v)
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100]">
            <div className="relative bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">

                {mode === 'video' && (
                    <div className="relative w-full h-64 bg-slate-800">
                        <video ref={remoteVideo} autoPlay playsInline className="w-full h-full object-cover" />
                        {callState !== 'connected' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                {remoteUser.profilePhotoUrl ? (
                                    <img src={remoteUser.profilePhotoUrl} alt={remoteUser.fullName}
                                         className="w-20 h-20 rounded-full object-cover border-2 border-blue-500/50" />
                                ) : (
                                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-3xl">
                                        {remoteUser.fullName?.charAt(0)}
                                    </div>
                                )}
                                <p className="text-white font-semibold text-lg drop-shadow">{remoteUser.fullName}</p>
                            </div>
                        )}
                        <div className="absolute bottom-3 right-3 w-24 h-16 rounded-xl overflow-hidden border-2 border-slate-700 bg-slate-800">
                            <video ref={localVideo} autoPlay playsInline muted className="w-full h-full object-cover" />
                        </div>
                    </div>
                )}

                {mode === 'audio' && (
                    <div className="pt-10 pb-6 flex flex-col items-center gap-3">
                        <div className="relative">
                            {callState === 'ringing' && (
                                <>
                                    <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping scale-150" />
                                    <div className="absolute inset-0 rounded-full bg-blue-500/10 animate-ping scale-125" style={{ animationDelay: '0.3s' }} />
                                </>
                            )}
                            {remoteUser.profilePhotoUrl ? (
                                <img src={remoteUser.profilePhotoUrl} alt={remoteUser.fullName}
                                     className={`relative w-24 h-24 rounded-full object-cover ${callState === 'connected' ? 'ring-4 ring-blue-500/30 ring-offset-4 ring-offset-slate-900' : ''}`} />
                            ) : (
                                <div className={`relative w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-4xl ${callState === 'connected' ? 'ring-4 ring-blue-500/30 ring-offset-4 ring-offset-slate-900' : ''}`}>
                                    {remoteUser.fullName?.charAt(0)}
                                </div>
                            )}
                        </div>
                        <audio ref={remoteVideo} autoPlay playsInline />
                        <audio ref={localVideo} muted />
                    </div>
                )}

                <div className="px-6 pb-4 flex flex-col items-center gap-1">
                    <h3 className="text-lg font-semibold text-white">{remoteUser.fullName}</h3>
                    <p className="text-sm text-slate-400">
                        {callState === 'ringing'    && (direction === 'outgoing' ? 'Calling…' : 'Incoming call')}
                        {callState === 'connecting' && <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Connecting…</span>}
                        {callState === 'connected'  && <span className="text-emerald-400 font-mono">{formatDuration(duration)}</span>}
                    </p>
                    {/* ICE debug info — hidden in production, useful for debugging */}
                    {iceState && iceState !== 'connected' && iceState !== 'completed' && callState !== 'connected' && (
                        <p className="text-xs text-slate-600">{iceState}</p>
                    )}
                </div>

                <div className="px-6 pb-8 flex items-center justify-center gap-4">
                    {callState === 'ringing' && direction === 'incoming' && (
                        <>
                            <button onClick={rejectCall}
                                    className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-all shadow-lg shadow-red-600/30">
                                <PhoneOff className="w-6 h-6 text-white" />
                            </button>
                            <button onClick={acceptCall}
                                    className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center transition-all shadow-lg shadow-emerald-600/30">
                                <Phone className="w-6 h-6 text-white" />
                            </button>
                        </>
                    )}
                    {(callState !== 'ringing' || direction === 'outgoing') && (
                        <>
                            <button onClick={toggleMute}
                                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-red-600 hover:bg-red-500' : 'bg-slate-700 hover:bg-slate-600'}`}>
                                {isMuted ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
                            </button>
                            {mode === 'video' && (
                                <button onClick={toggleVideo}
                                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isVideoOff ? 'bg-red-600 hover:bg-red-500' : 'bg-slate-700 hover:bg-slate-600'}`}>
                                    {isVideoOff ? <VideoOff className="w-5 h-5 text-white" /> : <Video className="w-5 h-5 text-white" />}
                                </button>
                            )}
                            <button onClick={handleHangup}
                                    className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-all shadow-lg shadow-red-600/30">
                                <PhoneOff className="w-6 h-6 text-white" />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
