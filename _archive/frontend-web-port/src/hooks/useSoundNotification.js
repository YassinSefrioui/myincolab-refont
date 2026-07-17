import { useRef, useCallback } from 'react'

/**
 * useSoundNotification
 *
 * Generates all notification sounds programmatically via Web Audio API —
 * no external audio files needed.
 *
 * Sounds available:
 *   playMessage()      → soft pop (new chat message)
 *   playNotification() → two-tone chime (general notification)
 *   playCallRinging()  → repeating phone ring (returns stop function)
 *   playCallAccepted() → ascending happy tone
 *   playCallEnded()    → descending end-call tone
 *   playCallRejected() → short negative blip
 */
export default function useSoundNotification() {
    const audioCtxRef  = useRef(null)
    const ringIntervalRef = useRef(null)

    const getCtx = () => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
        }
        // Resume if suspended (browser autoplay policy)
        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume()
        }
        return audioCtxRef.current
    }

    /**
     * Core: play a tone with given params.
     * @param {number}   freq      - Hz
     * @param {number}   duration  - seconds
     * @param {number}   volume    - 0–1
     * @param {string}   type      - oscillator type: 'sine'|'square'|'sawtooth'|'triangle'
     * @param {number}   startAt   - ctx.currentTime offset
     * @param {number}   fadeOut   - seconds before end to fade
     */
    const tone = useCallback((freq, duration, volume = 0.4, type = 'sine', startAt = 0, fadeOut = 0.05) => {
        try {
            const ctx  = getCtx()
            const osc  = ctx.createOscillator()
            const gain = ctx.createGain()

            osc.connect(gain)
            gain.connect(ctx.destination)

            osc.type      = type
            osc.frequency.setValueAtTime(freq, ctx.currentTime + startAt)

            gain.gain.setValueAtTime(0, ctx.currentTime + startAt)
            gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + startAt + 0.01)
            gain.gain.setValueAtTime(volume, ctx.currentTime + startAt + duration - fadeOut)
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + startAt + duration)

            osc.start(ctx.currentTime + startAt)
            osc.stop(ctx.currentTime + startAt + duration)
        } catch { /* silently fail if audio not available */ }
    }, [])

    // ── Message received ──────────────────────────────────────────────────────
    const playMessage = useCallback(() => {
        // Soft double-pop
        tone(880, 0.08, 0.25, 'sine', 0)
        tone(1100, 0.08, 0.2, 'sine', 0.09)
    }, [tone])

    // ── General notification ──────────────────────────────────────────────────
    const playNotification = useCallback(() => {
        // Two-tone pleasant chime
        tone(523, 0.15, 0.3, 'sine', 0)       // C5
        tone(659, 0.2,  0.3, 'sine', 0.12)    // E5
        tone(784, 0.25, 0.25, 'sine', 0.24)   // G5
    }, [tone])

    // ── Call ringing — soft double bip (for receiver) ───────────────────────
    const playCallRing = useCallback(() => {
        // Two soft gentle bips — not annoying
        tone(620, 0.12, 0.18, 'sine', 0)
        tone(620, 0.12, 0.18, 'sine', 0.2)
    }, [tone])

    const startCallRinging = useCallback(() => {
        playCallRing()
        ringIntervalRef.current = setInterval(playCallRing, 3000)
        return () => stopCallRinging()
    }, [playCallRing])

    const stopCallRinging = useCallback(() => {
        if (ringIntervalRef.current) {
            clearInterval(ringIntervalRef.current)
            ringIntervalRef.current = null
        }
    }, [])

    // ── Call accepted ─────────────────────────────────────────────────────────
    const playCallAccepted = useCallback(() => {
        // Ascending happy beeps
        tone(523, 0.12, 0.35, 'sine', 0)
        tone(659, 0.12, 0.35, 'sine', 0.13)
        tone(784, 0.2,  0.35, 'sine', 0.26)
    }, [tone])

    // ── Call ended ────────────────────────────────────────────────────────────
    const playCallEnded = useCallback(() => {
        // Descending tones
        tone(523, 0.15, 0.3, 'sine', 0)
        tone(415, 0.15, 0.3, 'sine', 0.15)
        tone(330, 0.25, 0.25, 'sine', 0.3)
    }, [tone])

    // ── Call rejected ─────────────────────────────────────────────────────────
    const playCallRejected = useCallback(() => {
        tone(300, 0.08, 0.35, 'square', 0)
        tone(250, 0.15, 0.3,  'square', 0.09)
    }, [tone])

    // ── Outgoing call — SILENT (no ringing sound for caller) ───────────────
    const startOutgoingRing = useCallback(() => {
        // No sound for the caller — only the receiver hears the ring
        return () => stopCallRinging()
    }, [stopCallRinging])

    return {
        playMessage,
        playNotification,
        startCallRinging,
        stopCallRinging,
        startOutgoingRing,
        playCallAccepted,
        playCallEnded,
        playCallRejected,
    }
}
