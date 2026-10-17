import { describe, it, expect } from "vitest"
import * as tf from "@tensorflow/tfjs"
// ESM files instead of the CJS bundle, see multi-head-attention.test.ts
import { input, model as createModel } from "@tensorflow/tfjs-layers/dist/exports"
import type { Layer, SymbolicTensor } from "@tensorflow/tfjs-layers/dist/engine/topology"
import type { CachedKeysValues } from "./multi-head-attention"
import { RotaryGroupQueryAttention } from "./rotary-group-query-attention"

const [seqLen, dim, headDim, numQueryHeads, numKeyValueHeads] = [6, 8, 4, 4, 2]
const [ropeMaxWavelength, epsilon] = [100, 1e-5]

const maxDiff = (a: tf.Tensor, b: tf.Tensor) => a.sub(b).abs().max().dataSync()[0]

type AttentionLayer = Layer & {
  isCausal: boolean
  attendWithCache: (
    x: tf.Tensor,
    cached?: CachedKeysValues,
  ) => CachedKeysValues & { output: tf.Tensor }
}

function createAttention(qkNorm = true) {
  const inp = input({ shape: [seqLen, dim] })
  const layer = RotaryGroupQueryAttention.constructorFunc({
    headDim,
    numQueryHeads,
    numKeyValueHeads,
    ropeMaxWavelength,
    qkNormEpsilon: qkNorm ? epsilon : null,
  }) as AttentionLayer
  const out = layer.apply([inp, inp], { useCausalMask: true }) as SymbolicTensor // as in Keras: attn(x, x)
  layer.setWeights(layer.getWeights().map((w) => tf.randomNormal(w.shape))) // incl. random qk-norm scales
  return { model: createModel({ inputs: inp, outputs: out }), layer }
}

const rmsNorm = (t: tf.Tensor, scale: tf.Tensor) =>
  t.div(t.square().mean(-1, true).add(epsilon).sqrt()).mul(scale)

// straightforward implementation: each query head i uses key/value head floor(i / groupSize) (repeated),
// RoPE: features (j, j + headDim / 2) rotated by position / maxWavelength^(2j / headDim)
function reference(layer: Layer, x: tf.Tensor, qkNorm = true) {
  const norm = (t: tf.Tensor, scale: tf.Tensor) => (qkNorm ? rmsNorm(t, scale) : t)
  return tf.tidy(() => {
    const [wq, wk, wv, wo, normQ, normK] = layer.getWeights()
    const [batch, steps] = x.shape
    const project = (w: tf.Tensor, heads: number) =>
      tf.einsum("btd,dnh->bnth", x, w.reshape([dim, heads, headDim])) // [B, heads, T, H]
    const half = headDim / 2
    const invFreq = tf.pow(ropeMaxWavelength, tf.range(0, half).mul(-2 / headDim))
    const angles = tf.range(0, steps).expandDims(1).mul(invFreq.expandDims(0)) // [T, half]
    const [cos, sin] = [tf.cos(angles), tf.sin(angles)]
    const rope = (t: tf.Tensor) => {
      const [a, b] = tf.split(t, 2, -1) // [B, N, T, half]
      return tf.concat([a.mul(cos).sub(b.mul(sin)), b.mul(cos).add(a.mul(sin))], -1)
    }
    const groupSize = numQueryHeads / numKeyValueHeads
    const repeat = (t: tf.Tensor) =>
      tf.gather(
        t,
        Array.from({ length: numQueryHeads }, (_, i) => Math.floor(i / groupSize)),
        1,
      )
    const q = rope(norm(project(wq, numQueryHeads), normQ))
    const k = repeat(rope(norm(project(wk, numKeyValueHeads), normK)))
    const v = repeat(project(wv, numKeyValueHeads))
    const future = tf.linalg.bandPart(tf.ones([steps, steps]), 0, -1).sub(tf.eye(steps)) // above the diagonal
    const scores = tf.matMul(q, k, false, true).div(Math.sqrt(headDim)).add(future.mul(-1e9))
    const attended = tf.matMul(tf.softmax(scores), v) // [B, N, T, H]
    return tf
      .einsum("bnth,nhd->btd", attended, wo.reshape([numQueryHeads, headDim, dim]))
      .reshape([batch, steps, dim])
  })
}

describe("RotaryGroupQueryAttention", () => {
  const x = tf.randomNormal([2, seqLen, dim])

  it("should match the reference implementation (causal, with and without qk-norm)", () => {
    for (const qkNorm of [true, false]) {
      const { model, layer } = createAttention(qkNorm)
      expect(layer.isCausal).toBe(true)
      expect(layer.getWeights()).toHaveLength(qkNorm ? 6 : 4)
      const y = model.predict(x) as tf.Tensor
      expect(y.shape).toEqual([2, seqLen, dim])
      expect(maxDiff(y, reference(layer, x, qkNorm))).toBeLessThan(1e-4)
    }
  })

  it("should use a single graph input for [x, x]", () => {
    const { layer } = createAttention()
    expect(layer.inboundNodes[0].inboundLayers).toHaveLength(1)
  })

  it("should give the same outputs with a KV cache (new positions with an offset)", () => {
    const { model, layer } = createAttention()
    const full = model.predict(x) as tf.Tensor
    let cached: CachedKeysValues | undefined
    const outputs: tf.Tensor[] = []
    for (const [start, size] of [
      [0, 3],
      [3, 1],
      [4, 2],
    ]) {
      const { output, key, value } = layer.attendWithCache(x.slice([0, start], [-1, size]), cached)
      outputs.push(output)
      cached = { key, value }
      expect(key.shape).toEqual([2, numKeyValueHeads, start + size, headDim])
    }
    expect(maxDiff(tf.concat(outputs, 1), full)).toBeLessThan(1e-4)
  })

  it("should only support self-attention", () => {
    const { layer } = createAttention()
    const other = input({ shape: [seqLen, dim] })
    expect(() => layer.apply([input({ shape: [seqLen, dim] }), other])).toThrow(
      "only self-attention",
    )
  })
})
