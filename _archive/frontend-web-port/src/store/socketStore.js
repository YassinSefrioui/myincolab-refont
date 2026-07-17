import { create } from 'zustand'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import useAuthStore from './authStore'



const useSocketStore = create((set, get) => ({
    client:       null,
    connected:    false,
    incomingCall: null,   // { mode, remoteUser: { id, fullName } }
    activeCall:   null,   // { mode, remoteUser }

    // ── Connect ──────────────────────────────────────────────────────────────
    connect: (token, userId, companyId, onConversationMessage, onPresence) => {
        // Disconnect existing if any
        const existing = get().client
        if (existing) {
            try { existing.deactivate() } catch {}
        }

        const client = new Client({
            webSocketFactory: () => new SockJS(`${window.location.protocol}//${window.location.host}/ws`),
            connectHeaders:   { Authorization: `Bearer ${token}` },
            reconnectDelay:   3000,
            onConnect: () => {
                set({ connected: true })
                console.log('[WS] Connected ✅')

                // ── Presence ─────────────────────────────────────────────
                if (companyId) {
                    client.subscribe(`/topic/presence/${companyId}`, msg => {
                        try {
                            const data = JSON.parse(msg.body)
                            if (onPresence) onPresence(data)
                        } catch {}
                    })
                }

                // ── Incoming call ─────────────────────────────────────────
                client.subscribe(`/topic/call/${userId}`, msg => {
                    try {
                        const data  = JSON.parse(msg.body)
                        const state = get()

                        if (data.type === 'offer') {
                            // If already in an active call, silently reject duplicate offers
                            // (e.g. from STOMP reconnect replaying queued messages)
                            if (state.activeCall) {
                                console.log('[Call] Ignoring offer — already in a call')
                                return
                            }
                            playRing()
                            set({
                                incomingCall: {
                                    mode:       data.callMode || 'audio',
                                    remoteUser: {
                                        id:       data.fromUserId,
                                        fullName: data.fromName || data.fromUserId || 'Incoming call',
                                    },
                                }
                            })
                        }
                        if (data.type === 'accepted') {
                            // Callee accepted — caller's MeetingModal is already open in the SFU room.
                            // Nothing to reset here; the SFU peer-joined / new-producer events
                            // will update the UI once the callee's media arrives.
                            console.log('[Call] Callee accepted —', data.fromName)
                        }
                        if (data.type === 'hangup' || data.type === 'rejected') {
                            stopRing()
                            set({ incomingCall: null, activeCall: null })
                        }
                    } catch {}
                })

                // ── Photo updates ─────────────────────────────────────────
                client.subscribe('/topic/user-photo-updates', msg => {
                    try {
                        const data = JSON.parse(msg.body)
                        window.dispatchEvent(new CustomEvent('user-photo-updated', { detail: data }))
                    } catch {}
                })

                // ── New message from ANY conversation (per-user topic) ─────
                // Fires when someone sends a message in any conversation this
                // user is part of — even on a different page. Uses a plain
                // topic (routed by destination string) instead of a user-queue,
                // because user-destination routing depends on the STOMP
                // Principal name and was silently dropping these — which is why
                // the conversation list only updated after a manual refresh.
                client.subscribe(`/topic/user/${userId}/new-message`, msg => {
                    try {
                        const newMsg = JSON.parse(msg.body)
                        window.dispatchEvent(new CustomEvent('ws-new-message', { detail: newMsg }))
                    } catch {}
                })

                // ── All conversations — live updates ──────────────────────
                // Each conversation subscription is managed separately via subscribeToConversation()
            },
            onDisconnect: () => {
                set({ connected: false })
                console.log('[WS] Disconnected')
            },
            onStompError: frame => {
                console.warn('[WS] STOMP error:', frame)
            },
        })

        client.activate()
        set({ client, connected: false })
    },

    // ── Subscribe to a specific conversation topic ────────────────────────────
    subscribeToConversation: (conversationId, onMessage, onReadReceipt) => {
        const { client, connected } = get()
        if (!client || !connected) return null

        const msgSub = client.subscribe(`/topic/conversation/${conversationId}`, msg => {
            try { onMessage(JSON.parse(msg.body)) } catch {}
        })

        const readSub = client.subscribe(`/topic/conversation/${conversationId}/read`, msg => {
            try { if (onReadReceipt) onReadReceipt(JSON.parse(msg.body)) } catch {}
        })

        return () => {
            try { msgSub.unsubscribe() } catch {}
            try { readSub.unsubscribe() } catch {}
        }
    },

    // ── Send STOMP message ────────────────────────────────────────────────────
    publish: (destination, body) => {
        const { client, connected } = get()
        if (!client || !connected) return
        client.publish({
            destination,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
        })
    },

    // ── Call actions ──────────────────────────────────────────────────────────
    // incomingSnapshot is passed directly from the popup so we never
    // rely on potentially-stale store state at the moment of the click.
    acceptCall: (incomingSnapshot) => {
        stopRing()
        const incoming = incomingSnapshot || get().incomingCall
        if (!incoming) {
            console.warn('[acceptCall] no incomingCall — ignoring')
            return
        }
        // Notify the caller that we accepted — they stay in the SFU room
        const { client, connected } = get()
        if (client && connected) {
            const me     = useAuthStore.getState().user
            const myId   = me?.id || me?.userId
            const myName = me?.fullName || me?.email || String(myId || '')
            client.publish({
                destination: `/app/call/${incoming.remoteUser.id}/accept`,
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    callMode:   incoming.mode,
                    fromUserId: myId,
                    fromName:   myName,
                }),
            })
        }
        set({ activeCall: incoming, incomingCall: null })
    },

    rejectCall: (incomingSnapshot) => {
        stopRing()
        const incoming = incomingSnapshot || get().incomingCall
        if (incoming) {
            get().publish(`/app/call/${incoming.remoteUser.id}/reject`, {})
        }
        set({ incomingCall: null })
    },

    startCall: (remoteUser, mode, myId) => {
        // No outgoing ring sound — silent for caller
        set({ activeCall: { mode, remoteUser } })
    },

    endCall: () => {
        // Send hangup to the remote party so their MeetingModal closes too
        const { activeCall, client, connected } = get()
        if (activeCall?.remoteUser?.id && client && connected) {
            try {
                client.publish({
                    destination: `/app/call/${activeCall.remoteUser.id}/hangup`,
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({}),
                })
            } catch {}
        }
        set({ activeCall: null })
    },

    // ── Disconnect ────────────────────────────────────────────────────────────
    disconnect: () => {
        const { client } = get()
        if (client) {
            try { client.deactivate() } catch {}
        }
        set({ client: null, connected: false, incomingCall: null, activeCall: null })
    },
}))

// ── Ring sounds (outside React — no hooks) ───────────────────────────────────
let audioCtx = null
let ringInterval = null

function getCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    if (audioCtx.state === 'suspended') audioCtx.resume()
    return audioCtx
}

function playTone(freq, duration, volume = 0.2, startAt = 0) {
    try {
        const ctx  = getCtx()
        const osc  = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startAt)
        gain.gain.setValueAtTime(0, ctx.currentTime + startAt)
        gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + startAt + 0.01)
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + startAt + duration)
        osc.start(ctx.currentTime + startAt)
        osc.stop(ctx.currentTime + startAt + duration)
    } catch {}
}

function isDndActive() {
    const until = localStorage.getItem('dnd-until')
    return until && new Date(until) > new Date()
}

function playRing() {
    if (isDndActive()) return  // Respect Do Not Disturb
    const bip = () => {
        playTone(620, 0.12, 0.18, 0)
        playTone(620, 0.12, 0.18, 0.2)
    }
    bip()
    ringInterval = setInterval(bip, 3000)
}

function stopRing() {
    if (ringInterval) {
        clearInterval(ringInterval)
        ringInterval = null
    }
}

export default useSocketStore
