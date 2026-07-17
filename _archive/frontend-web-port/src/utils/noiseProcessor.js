/**
 * DTLN noise suppressor via ONNX Runtime Web.
 *
 * Architecture:
 *   Mic (48 kHz)
 *     → AudioWorklet  (audio thread)   — downsample, accumulate 128-sample hops
 *         ↕ MessagePort (direct, no main-thread hop)
 *     → Web Worker    (worker thread)  — ONNX inference (DTLN model 1 + 2)
 *         ↕ MessagePort
 *     → AudioWorklet  (audio thread)   — upsample, ring-buffer output
 *     → MediaStreamDestination (48 kHz) → WebRTC / Opus
 *
 * The main thread only handles setup; per-frame audio never touches it.
 *
 * Models: DTLN (Dual-signal Transformation LSTM Network)
 *   Pre-trained ONNX files (~2 MB each) fetched from /models/ at startup.
 *   Download once via: scripts/download-dtln-models.sh
 *
 * Quality vs latency:
 *   ~53 ms one-way latency (8 ms accumulation + 32 ms DTLN window + ~13 ms IPC)
 *   Handles: steady noise, keyboard, voices in background, music — far beyond RNNoise.
 */

const WORKLET_URL  = '/onnx-noise-worklet.js'
const MODEL_1_URL  = '/models/model_1.onnx'
const MODEL_2_URL  = '/models/model_2.onnx'

export async function createNoiseProcessor(micStream) {
    // ── 1. AudioContext at native 48 kHz ──────────────────────────────────
    const ctx  = new AudioContext()
    const src  = ctx.createMediaStreamSource(micStream)
    const dest = ctx.createMediaStreamDestination()

    // ── 2. Load AudioWorklet module ───────────────────────────────────────
    try {
        await ctx.audioWorklet.addModule(WORKLET_URL)
    } catch (err) {
        console.error('[DTLN] Failed to load AudioWorklet:', err)
        ctx.close()
        return null
    }

    const worklet = new AudioWorkletNode(ctx, 'dtln-processor', {
        numberOfInputs:     1,
        numberOfOutputs:    1,
        outputChannelCount: [1],
        channelCount:       1,
        channelCountMode:   'explicit',
    })

    worklet.onprocessorerror = (e) =>
        console.error('[DTLN] AudioWorklet processor error:', e)

    // ── 3. Create the DTLN Web Worker (Vite bundles this as a module) ─────
    const worker = new Worker(
        new URL('../workers/noiseWorker.js', import.meta.url),
        { type: 'module' }
    )

    // ── 4. Wire worklet ↔ worker directly via MessageChannel ─────────────
    //    The main thread transfers both ends of the channel, then steps back.
    //    Per-frame audio flows worklet ↔ worker without touching the main thread.
    const channel = new MessageChannel()

    worklet.port.postMessage(
        { type: 'connect', workerPort: channel.port1 },
        [channel.port1]
    )
    worker.postMessage(
        { type: 'init', audioPort: channel.port2, model1Url: MODEL_1_URL, model2Url: MODEL_2_URL },
        [channel.port2]
    )

    // ── 5. Wait for WASM + ONNX init inside the worker ────────────────────
    try {
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(
                () => reject(new Error('DTLN worker init timeout (models may be missing)')),
                30_000  // 30 s — models are ~2 MB each; allow for slow connections
            )
            worklet.port.onmessage = ({ data }) => {
                clearTimeout(timeout)
                if (data.type === 'ready')  resolve()
                else reject(new Error(data.message ?? 'DTLN worker init failed'))
            }
        })
    } catch (err) {
        console.error('[DTLN]', err)
        worklet.disconnect()
        worker.terminate()
        ctx.close()
        return null
    }

    // ── 6. Wire the audio graph ───────────────────────────────────────────
    src.connect(worklet)
    worklet.connect(dest)

    console.info('[DTLN] ONNX noise processor active (~53 ms latency, high quality)')

    return {
        track: dest.stream.getAudioTracks()[0],

        setBypass: (v) => {
            worklet.port.postMessage({ type: 'bypass', value: v })
        },

        dispose: () => {
            try { worklet.disconnect()  } catch {}
            try { src.disconnect()      } catch {}
            try { ctx.close()           } catch {}
            try { worker.terminate()    } catch {}
        },
    }
}
