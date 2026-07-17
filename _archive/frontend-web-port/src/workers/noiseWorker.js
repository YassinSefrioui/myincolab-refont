/**
 * DTLN noise-suppression Web Worker.
 *
 * Runs entirely off the main thread — no UI jank.
 * Communicates directly with the AudioWorklet via a transferred MessagePort
 * so the main thread is not involved in per-frame audio transfer.
 *
 * Algorithm (matches real_time_processing_onnx.py exactly):
 *   block_len   = 512 samples @ 16 kHz  (32 ms)
 *   block_shift = 128 samples @ 16 kHz   (8 ms hop)
 *
 *   Each hop:
 *     1. Slide input window, append 128 new samples
 *     2. rfft(hann * window) → magnitude + phase
 *     3. Model 1: magnitude [1,1,257] → mask [1,1,257]   (freq domain)
 *     4. estimated = irfft(magnitude * mask * e^{jφ})
 *     5. Model 2: estimated [1,1,512] → enhanced [1,1,512] (time domain)
 *     6. Overlap-add synthesis, output first 128 samples
 *
 * ONNX API per model:
 *   inputs[0]  = audio data   (dynamically named)
 *   inputs[1]  = packed state (dynamically named, zeros on first call)
 *   outputs[0] = result data
 *   outputs[1] = new state    (fed back as inputs[1] next call)
 */

import * as ort from 'onnxruntime-web'

// ── Constants (must match the pre-trained DTLN model) ─────────────────────
const BLOCK_LEN   = 512
const BLOCK_SHIFT = 128
const BINS        = BLOCK_LEN / 2 + 1  // 257  (rfft output bins)

// ── ORT configuration ──────────────────────────────────────────────────────
// Self-hosted WASM files — copied from node_modules by the build script.
// Run once: bash scripts/copy-ort-wasm.sh
ort.env.wasm.numThreads = 1   // single thread; worker itself is the parallelism
ort.env.wasm.wasmPaths  = '/ort/'

// ── Pre-computed Hann window ───────────────────────────────────────────────
const HANN = new Float32Array(BLOCK_LEN)
for (let i = 0; i < BLOCK_LEN; i++)
    HANN[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / BLOCK_LEN))

// ── Sliding buffers ────────────────────────────────────────────────────────
const inWindow  = new Float32Array(BLOCK_LEN)  // sliding input window
const outOLA    = new Float32Array(BLOCK_LEN)  // overlap-add accumulator

// ── rfft / irfft (real-only FFT using Cooley-Tukey) ───────────────────────
// Real input → BINS complex output (only positive frequencies needed).

function _fft(re, im) {
    const n = re.length
    for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1
        for (; j & bit; bit >>= 1) j ^= bit
        j ^= bit
        if (i < j) {
            ;[re[i], re[j]] = [re[j], re[i]]
            ;[im[i], im[j]] = [im[j], im[i]]
        }
    }
    for (let len = 2; len <= n; len <<= 1) {
        const ang = -2 * Math.PI / len
        const wRe = Math.cos(ang), wIm = Math.sin(ang)
        for (let i = 0; i < n; i += len) {
            let cRe = 1, cIm = 0
            for (let k = 0; k < (len >> 1); k++) {
                const j   = i + k + (len >> 1)
                const vRe = re[j] * cRe - im[j] * cIm
                const vIm = re[j] * cIm + im[j] * cRe
                re[j] = re[i + k] - vRe;  im[j] = im[i + k] - vIm
                re[i + k] += vRe;          im[i + k] += vIm
                const nRe = cRe * wRe - cIm * wIm
                cIm = cRe * wIm + cIm * wRe
                cRe = nRe
            }
        }
    }
}

const _fftRe = new Float32Array(BLOCK_LEN)
const _fftIm = new Float32Array(BLOCK_LEN)

/** rfft: real[BLOCK_LEN] → { mag[BINS], phase[BINS] } */
function rfft(signal) {
    _fftRe.set(signal)
    _fftIm.fill(0)
    _fft(_fftRe, _fftIm)
    const mag   = new Float32Array(BINS)
    const phase = new Float32Array(BINS)
    for (let i = 0; i < BINS; i++) {
        mag[i]   = Math.sqrt(_fftRe[i] * _fftRe[i] + _fftIm[i] * _fftIm[i])
        phase[i] = Math.atan2(_fftIm[i], _fftRe[i])
    }
    return { mag, phase }
}

/** irfft: reconstruct real signal from magnitude + phase */
function irfft(mag, phase) {
    // Reconstruct full complex spectrum (conjugate symmetry)
    for (let i = 0; i < BINS; i++) {
        _fftRe[i] =  mag[i] * Math.cos(phase[i])
        _fftIm[i] =  mag[i] * Math.sin(phase[i])
    }
    for (let i = BINS; i < BLOCK_LEN; i++) {
        const j   = BLOCK_LEN - i
        _fftRe[i] =  _fftRe[j]
        _fftIm[i] = -_fftIm[j]
    }
    // Inverse FFT: conjugate → FFT → conjugate → scale
    for (let i = 0; i < BLOCK_LEN; i++) _fftIm[i] = -_fftIm[i]
    _fft(_fftRe, _fftIm)
    const out = new Float32Array(BLOCK_LEN)
    for (let i = 0; i < BLOCK_LEN; i++) out[i] = _fftRe[i] / BLOCK_LEN
    return out
}

// ── ONNX sessions + state ──────────────────────────────────────────────────
let sess1 = null, sess2 = null
let names1 = null, names2 = null   // { in: [name0, name1], out: [name0, name1] }
let state1 = null, state2 = null   // ort.Tensor — packed LSTM state
let ready  = false

// ── Worker message handling ────────────────────────────────────────────────
let audioPort = null  // direct MessagePort to the AudioWorklet

self.onmessage = async ({ data }) => {
    if (data.type === 'init') {
        audioPort = data.audioPort
        audioPort.onmessage = onAudio
        await initModels(data.model1Url, data.model2Url)
    } else if (data.type === 'bypass') {
        // Just mark; audio passthrough handled in worklet
    }
}

async function initModels(url1, url2) {
    try {
        // ── Fetch models ───────────────────────────────────────────────────
        console.info('[NW] Fetching models…')
        const [buf1, buf2] = await Promise.all([
            fetchModel(url1),
            fetchModel(url2),
        ])
        console.info(`[NW] model_1: ${(buf1.byteLength/1024/1024).toFixed(1)} MB`)
        console.info(`[NW] model_2: ${(buf2.byteLength/1024/1024).toFixed(1)} MB`)

        // ── Create ORT sessions ────────────────────────────────────────────
        const opts = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' }
        console.info('[NW] Creating ORT sessions…')
        ;[sess1, sess2] = await Promise.all([
            ort.InferenceSession.create(buf1, opts),
            ort.InferenceSession.create(buf2, opts),
        ])

        names1 = { in: sess1.inputNames.slice(), out: sess1.outputNames.slice() }
        names2 = { in: sess2.inputNames.slice(), out: sess2.outputNames.slice() }
        console.info('[NW] Model 1 inputs :', names1.in)
        console.info('[NW] Model 1 outputs:', names1.out)
        console.info('[NW] Model 2 inputs :', names2.in)
        console.info('[NW] Model 2 outputs:', names2.out)

        // ── Auto-detect state tensor shapes ───────────────────────────────
        // onnxruntime-web does not expose input shapes via JS API, so we probe
        // the model with common DTLN state shapes until one succeeds.
        console.info('[NW] Probing state shapes…')
        state1 = await probeStateShape(sess1, names1, [1, 1, BINS])
        state2 = await probeStateShape(sess2, names2, [1, 1, BLOCK_LEN])
        console.info('[NW] state1 shape:', state1.dims)
        console.info('[NW] state2 shape:', state2.dims)

        ready = true
        console.info('[NW] ✓ DTLN ready — noise suppression active')
        audioPort.postMessage({ type: 'ready' })
    } catch (err) {
        console.error('[NW] Init failed:', err)
        audioPort.postMessage({ type: 'error', message: String(err) })
    }
}

async function fetchModel(url) {
    const r = await fetch(url)
    if (!r.ok) throw new Error(`Failed to fetch ${url}: HTTP ${r.status}`)
    const buf = await r.arrayBuffer()
    if (buf.byteLength < 100_000)
        throw new Error(`${url} is only ${buf.byteLength} bytes — likely an error page, not a model`)
    return buf
}

/**
 * Run a dummy inference to find the correct state tensor shape.
 * Tries the most common DTLN state shapes in order.
 */
async function probeStateShape(session, names, dataShape) {
    const candidates = [
        [1, 2, 128, 2],   // most common DTLN export
        [2, 1, 128],
        [1, 128],
        [2, 128],
        [1, 2, 256],
        [1, 4, 128],
    ]
    const dummyData = new ort.Tensor('float32',
        new Float32Array(dataShape.reduce((a, b) => a * b, 1)), dataShape)

    for (const dims of candidates) {
        const size  = dims.reduce((a, b) => a * b, 1)
        const state = new ort.Tensor('float32', new Float32Array(size), dims)
        try {
            const out = await session.run({
                [names.in[0]]: dummyData,
                [names.in[1]]: state,
            })
            // Success — return a fresh zero state with this shape
            return new ort.Tensor('float32', new Float32Array(size), dims)
        } catch {
            // Shape mismatch — try next
        }
    }
    throw new Error(`Could not determine state shape for model. Tried: ${JSON.stringify(candidates)}`)
}

// ── Per-hop inference ──────────────────────────────────────────────────────
async function onAudio({ data }) {
    if (data.type !== 'audio') return
    const hop = data.samples  // Float32Array, BLOCK_SHIFT samples @ 16 kHz

    if (!ready) {
        // Not initialised yet — pass through unprocessed
        audioPort.postMessage({ type: 'audio', samples: hop }, [hop.buffer])
        return
    }

    // 1. Slide input window and append new hop (matches Python exactly)
    inWindow.copyWithin(0, BLOCK_SHIFT)
    inWindow.set(hop, BLOCK_LEN - BLOCK_SHIFT)

    // 2. Windowed rfft
    const windowed = new Float32Array(BLOCK_LEN)
    for (let i = 0; i < BLOCK_LEN; i++) windowed[i] = inWindow[i] * HANN[i]
    const { mag, phase } = rfft(windowed)

    // 3. Model 1: frequency-domain mask estimation
    const magTensor = new ort.Tensor('float32', new Float32Array(mag), [1, 1, BINS])
    const out1 = await sess1.run({
        [names1.in[0]]: magTensor,
        [names1.in[1]]: state1,
    })
    const mask = out1[names1.out[0]].data   // Float32Array length BINS
    state1     = out1[names1.out[1]]        // updated state

    // 4. Apply mask → irfft
    const maskedMag = new Float32Array(BINS)
    for (let i = 0; i < BINS; i++) maskedMag[i] = mag[i] * mask[i]
    const estimated = irfft(maskedMag, phase)

    // 5. Model 2: time-domain refinement
    const estTensor = new ort.Tensor('float32', new Float32Array(estimated), [1, 1, BLOCK_LEN])
    const out2 = await sess2.run({
        [names2.in[0]]: estTensor,
        [names2.in[1]]: state2,
    })
    const enhanced = out2[names2.out[0]].data  // Float32Array length BLOCK_LEN
    state2         = out2[names2.out[1]]

    // 6. Overlap-add synthesis (matches Python exactly)
    outOLA.copyWithin(0, BLOCK_SHIFT)
    outOLA.fill(0, BLOCK_LEN - BLOCK_SHIFT)
    for (let i = 0; i < BLOCK_LEN; i++) outOLA[i] += enhanced[i]

    // Output the first BLOCK_SHIFT samples
    const output = outOLA.slice(0, BLOCK_SHIFT)
    audioPort.postMessage({ type: 'audio', samples: output }, [output.buffer])
}
