/**
 * RNNoise AudioWorklet processor.
 *
 * Runs on the browser's dedicated audio rendering thread — completely
 * bypassing the main JS thread.  No scheduling jitter, no GC pauses from
 * the UI, just clean per-quantum audio processing.
 *
 * WASM is instantiated directly using the raw WebAssembly API so the
 * Emscripten JS glue (which uses window/document) is never needed here.
 *
 * Import map for @jitsi/rnnoise-wasm (Emscripten-minified names):
 *   "a"."b"  = _emscripten_memcpy_big(dest, src, num)
 *   "a"."a"  = _emscripten_resize_heap(requestedSize) → i32
 * Export map:
 *   "c"  = WebAssembly.Memory
 *   "d"  = ___wasm_call_ctors   (must call once after instantiation)
 *   "f"  = _rnnoise_create()    → state ptr
 *   "g"  = _malloc(size)        → ptr
 *   "h"  = _rnnoise_destroy(state)
 *   "i"  = _free(ptr)
 *   "j"  = _rnnoise_process_frame(state, outPtr, inPtr) → vad f32
 */

const RNN_FRAME = 480    // samples per RNNoise frame @ 16 kHz  (30 ms)
const DS_RATIO  = 3      // 48 kHz ÷ 16 kHz
const OUT_CAP   = 9600   // output ring capacity  (200 ms @ 48 kHz)

/* ─── DSP helpers (zero-allocation, operate on pre-allocated buffers) ─── */

function downsample3(src, dst, len) {
    for (let i = 0; i < len; i++)
        dst[i] = (src[i * 3] + src[i * 3 + 1] + src[i * 3 + 2]) / 3
}

function upsample3(src, srcLen, dst) {
    for (let i = 0; i < srcLen - 1; i++) {
        const a = src[i], b = src[i + 1]
        dst[i * 3]     = a
        dst[i * 3 + 1] = a + (b - a) * 0.333
        dst[i * 3 + 2] = a + (b - a) * 0.667
    }
    if (srcLen > 0) {
        const last = src[srcLen - 1]
        dst[(srcLen - 1) * 3]     = last
        dst[(srcLen - 1) * 3 + 1] = last
        dst[(srcLen - 1) * 3 + 2] = last
    }
}

/* ─── Processor ────────────────────────────────────────────────────────── */

class RNNoiseProcessor extends AudioWorkletProcessor {

    constructor(options) {
        super()

        this._bypass = false
        this._ready  = false

        // 16 kHz input accumulator (linear; capacity = 2 frames to be safe)
        this._inBuf = new Float32Array(RNN_FRAME * 2)
        this._inLen = 0

        // 48 kHz output ring buffer
        this._outRing = new Float32Array(OUT_CAP)
        this._outHead = 0
        this._outTail = 0
        this._outLen  = 0

        // Scratch buffers — pre-allocated so process() never triggers GC
        this._dsScratch = new Float32Array(64)               // 128/3 ≈ 43 samples
        this._upScratch = new Float32Array(RNN_FRAME * DS_RATIO)  // 1440 samples

        this.port.onmessage = ({ data }) => {
            if (data.type === 'bypass') {
                this._bypass = !!data.value
                if (data.value) {
                    this._inLen  = 0
                    this._outLen = 0
                    this._outHead = this._outTail = 0
                }
            }
        }

        this._initWasm(options.processorOptions.wasmBinary)
    }

    /* ── WASM initialisation (runs async; process() guards with _ready) ── */

    async _initWasm(binary) {
        let mem = null

        const imports = {
            "a": {
                // _emscripten_memcpy_big
                "b": (dest, src, num) => {
                    new Uint8Array(mem.buffer).copyWithin(dest, src, src + num)
                },
                // _emscripten_resize_heap
                "a": (requestedSize) => {
                    try {
                        mem.grow((requestedSize - mem.buffer.byteLength + 65535) >>> 16)
                        // Refresh heap view after growth
                        this._heap = new Float32Array(mem.buffer)
                        return 1
                    } catch { return 0 }
                }
            }
        }

        try {
            const { instance } = await WebAssembly.instantiate(binary, imports)

            mem          = instance.exports["c"]   // WebAssembly.Memory
            this._mem    = mem
            this._heap   = new Float32Array(mem.buffer)

            instance.exports["d"]()                // ___wasm_call_ctors

            this._state        = instance.exports["f"]()              // _rnnoise_create
            this._inPtr        = instance.exports["g"](RNN_FRAME * 4) // _malloc
            this._outPtr       = instance.exports["g"](RNN_FRAME * 4)
            this._processFrame = instance.exports["j"]  // _rnnoise_process_frame

            this._ready = true
            this.port.postMessage({ type: 'ready' })
        } catch (err) {
            this.port.postMessage({ type: 'error', message: String(err) })
        }
    }

    /* ── Ring-buffer helpers (no allocation) ─────────────────────────── */

    _ringWrite(src, len) {
        const ring = this._outRing, cap = ring.length
        // If overflow: drop oldest to make room
        if (this._outLen + len > cap) {
            const drop = this._outLen + len - cap
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

    /* ── Audio processing (called every 128 samples ≈ 2.67 ms @ 48 kHz) ── */

    process(inputs, outputs) {
        const out = outputs[0]?.[0]
        if (!out) return true

        const inp = inputs[0]?.[0]

        // Pass through when bypassed or WASM not yet ready
        if (this._bypass || !this._ready || !inp || inp.length === 0) {
            inp ? out.set(inp) : out.fill(0)
            return true
        }

        // Refresh heap view if memory was grown since last call
        if (this._heap.buffer !== this._mem.buffer)
            this._heap = new Float32Array(this._mem.buffer)

        // ── Step 1: downsample quantum (128 @ 48 kHz → ~42 @ 16 kHz) ────────
        const dsLen = Math.floor(inp.length / DS_RATIO)
        downsample3(inp, this._dsScratch, dsLen)

        // Append to 16 kHz input accumulator
        if (this._inLen + dsLen > this._inBuf.length) {
            // Shouldn't happen, but guard against buffer overrun
            this._inLen = 0
        }
        this._inBuf.set(this._dsScratch.subarray(0, dsLen), this._inLen)
        this._inLen += dsLen

        // ── Step 2: run complete RNNoise frames ──────────────────────────────
        let r = 0
        while (r + RNN_FRAME <= this._inLen) {
            this._heap.set(this._inBuf.subarray(r, r + RNN_FRAME), this._inPtr >> 2)
            this._processFrame(this._state, this._outPtr, this._inPtr)
            // Upsample denoised frame directly into scratch buffer
            upsample3(
                this._heap.subarray(this._outPtr >> 2, (this._outPtr >> 2) + RNN_FRAME),
                RNN_FRAME,
                this._upScratch
            )
            this._ringWrite(this._upScratch, RNN_FRAME * DS_RATIO)
            r += RNN_FRAME
        }

        // Shift unconsumed input samples to front
        if (r > 0 && r < this._inLen)
            this._inBuf.copyWithin(0, r, this._inLen)
        this._inLen -= r

        // ── Step 3: drain output ring into this quantum ──────────────────────
        this._ringRead(out, out.length)

        return true
    }

    static get parameterDescriptors() { return [] }
}

registerProcessor('rnnoise-processor', RNNoiseProcessor)
