/**
 * DTLN AudioWorklet processor.
 *
 * Responsibilities (audio thread only — no inference here):
 *   • Downsample 48 kHz mic input → 16 kHz (÷3 average)
 *   • Accumulate until BLOCK_SHIFT (128) samples @ 16 kHz are ready
 *   • Send hop to the DTLN Web Worker via direct MessagePort
 *   • Receive denoised hops back, upsample 16 kHz → 48 kHz (×3)
 *   • Store in output ring buffer; drain each 128-sample quantum
 *
 * Latency budget:
 *   8 ms  — accumulation (BLOCK_SHIFT / 16 kHz)
 *  32 ms  — DTLN sliding window (BLOCK_LEN / 16 kHz, irreducible)
 *   8 ms  — output ring pre-fill (one hop)
 *  ~5 ms  — worker inference round-trip
 *  ──────
 *  ~53 ms total one-way  (vs ~33 ms RNNoise — trade-off for much better quality)
 */

const BLOCK_SHIFT = 128   // hop size @ 16 kHz
const DS_RATIO    = 3     // 48 kHz ÷ 16 kHz
const OUT_CAP     = 9600  // output ring capacity  (200 ms @ 48 kHz)

/** 48 kHz → 16 kHz: average every DS_RATIO samples */
function downsample(src, dst, len) {
    for (let i = 0; i < len; i++)
        dst[i] = (src[i * DS_RATIO] + src[i * DS_RATIO + 1] + src[i * DS_RATIO + 2]) / 3
}

/** 16 kHz → 48 kHz: linear interpolation */
function upsample(src, srcLen, dst) {
    for (let i = 0; i < srcLen - 1; i++) {
        const a = src[i], b = src[i + 1]
        dst[i * DS_RATIO]     = a
        dst[i * DS_RATIO + 1] = a + (b - a) * 0.333
        dst[i * DS_RATIO + 2] = a + (b - a) * 0.667
    }
    if (srcLen > 0) {
        const last = src[srcLen - 1]
        dst[(srcLen - 1) * DS_RATIO]     = last
        dst[(srcLen - 1) * DS_RATIO + 1] = last
        dst[(srcLen - 1) * DS_RATIO + 2] = last
    }
}

class DTLNProcessor extends AudioWorkletProcessor {

    constructor() {
        super()

        this._bypass  = false
        this._ready   = false

        // 16 kHz input accumulator
        this._inBuf = new Float32Array(BLOCK_SHIFT * 2)
        this._inLen = 0

        // 48 kHz output ring buffer
        this._outRing = new Float32Array(OUT_CAP)
        this._outHead = 0
        this._outTail = 0
        this._outLen  = 0

        // Scratch buffers (avoid GC in process())
        this._dsScratch = new Float32Array(64)              // ~43 samples per quantum
        this._upScratch = new Float32Array(BLOCK_SHIFT * DS_RATIO)  // 384 samples

        // Worker port — set via 'connect' message from main thread
        this._workerPort = null

        this.port.onmessage = ({ data }) => {
            if (data.type === 'connect') {
                this._workerPort = data.workerPort
                this._workerPort.onmessage = ({ data: wd }) => {
                    if (wd.type === 'ready') {
                        this._ready = true
                        this.port.postMessage({ type: 'ready' })
                    } else if (wd.type === 'error') {
                        this.port.postMessage(wd)
                    } else if (wd.type === 'audio') {
                        this._receiveDenoised(wd.samples)
                    }
                }
            } else if (data.type === 'bypass') {
                this._bypass = !!data.value
                if (data.value) {
                    this._inLen   = 0
                    this._outLen  = 0
                    this._outHead = this._outTail = 0
                }
            }
        }
    }

    // ── Ring buffer helpers ────────────────────────────────────────────────

    _ringWrite(src, len) {
        const ring = this._outRing, cap = ring.length
        if (this._outLen + len > cap) {
            const drop  = this._outLen + len - cap
            this._outTail = (this._outTail + drop) % cap
            this._outLen  = cap - len
        }
        for (let i = 0; i < len; i++) {
            ring[this._outHead] = src[i]
            this._outHead = (this._outHead + 1) % cap
        }
        this._outLen += len
    }

    _ringRead(dst, len) {
        const ring = this._outRing, cap = ring.length
        const avail = Math.min(len, this._outLen)
        for (let i = 0; i < avail; i++) {
            dst[i] = ring[this._outTail]
            this._outTail = (this._outTail + 1) % cap
        }
        if (avail < len) dst.fill(0, avail)
        this._outLen -= avail
    }

    // ── Receive denoised hop from worker ──────────────────────────────────

    _receiveDenoised(hop16) {
        // hop16: Float32Array of BLOCK_SHIFT samples @ 16 kHz
        upsample(hop16, BLOCK_SHIFT, this._upScratch)
        this._ringWrite(this._upScratch, BLOCK_SHIFT * DS_RATIO)
    }

    // ── Audio process (called every 128 samples ≈ 2.67 ms @ 48 kHz) ──────

    process(inputs, outputs) {
        const out = outputs[0]?.[0]
        if (!out) return true
        const inp = inputs[0]?.[0]

        if (this._bypass || !this._workerPort || !inp || inp.length === 0) {
            inp ? out.set(inp) : out.fill(0)
            return true
        }

        // ── Step 1: downsample quantum → 16 kHz ───────────────────────────
        const dsLen = Math.floor(inp.length / DS_RATIO)
        downsample(inp, this._dsScratch, dsLen)

        // Append to 16 kHz accumulator
        if (this._inLen + dsLen > this._inBuf.length)
            this._inLen = 0  // overflow guard
        this._inBuf.set(this._dsScratch.subarray(0, dsLen), this._inLen)
        this._inLen += dsLen

        // ── Step 2: send complete hops to worker ───────────────────────────
        while (this._inLen >= BLOCK_SHIFT) {
            const hop = this._inBuf.slice(0, BLOCK_SHIFT)
            this._workerPort.postMessage({ type: 'audio', samples: hop }, [hop.buffer])
            this._inBuf.copyWithin(0, BLOCK_SHIFT, this._inLen)
            this._inLen -= BLOCK_SHIFT
        }

        // ── Step 3: drain output ring into this quantum ────────────────────
        this._ringRead(out, out.length)

        return true
    }

    static get parameterDescriptors() { return [] }
}

registerProcessor('dtln-processor', DTLNProcessor)
