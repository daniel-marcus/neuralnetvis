import { describe, it, expect } from "vitest"
import * as tf from "@tensorflow/tfjs"
// ESM files instead of the CJS bundle, see multi-head-attention.test.ts
import { input, model as createModel } from "@tensorflow/tfjs-layers/dist/exports"
import {
  activation,
  add,
  dense,
  embedding,
  layerNormalization,
} from "@tensorflow/tfjs-layers/dist/exports_layers"
import type { SymbolicTensor } from "@tensorflow/tfjs-layers/dist/engine/topology"
import { MultiHeadAttention } from "./layers/multi-head-attention"
import { KVCache } from "./kv-cache"

const [vocabSize, seqLen, dim] = [11, 8, 8]

// two pre-LN decoder blocks: embedding -> (LN -> attention -> add -> dense -> add) x 2
// (without PositionEmbedding: it extends the CJS tfjs-layers, see multi-head-attention.test.ts)
function createDecoder() {
  const inp = input({ shape: [seqLen], dtype: "int32" })
  let x = embedding({ inputDim: vocabSize, outputDim: dim }).apply(inp) as SymbolicTensor
  for (let i = 0; i < 2; i++) {
    const h = layerNormalization().apply(x) as SymbolicTensor
    const mha = MultiHeadAttention.constructorFunc({ numHeads: 2, keyDim: 4 })
    x = add().apply([
      x,
      mha.apply([h, h], { useCausalMask: true }) as SymbolicTensor,
    ]) as SymbolicTensor
    const ff = dense({ units: dim, activation: "relu" }).apply(x) as SymbolicTensor
    x = add().apply([x, ff]) as SymbolicTensor
  }
  const logits = dense({ units: vocabSize }).apply(x) as SymbolicTensor
  const out = activation({ activation: "softmax" }).apply(logits) as SymbolicTensor
  return createModel({ inputs: inp, outputs: out }) as unknown as tf.LayersModel
}

// next-token probabilities after the tokens with a full forward pass (padded input, causal: padding is ignored)
function predictNext(model: tf.LayersModel, tokens: number[]) {
  return tf.tidy(() => {
    const padded = [...tokens, ...Array(seqLen - tokens.length).fill(0)]
    const probs = model.predict(tf.tensor2d([padded], [1, seqLen], "int32")) as tf.Tensor
    return probs.slice([0, tokens.length - 1], [1, 1]).reshape([-1])
  })
}

const maxDiff = (a: tf.Tensor, b: tf.Tensor) => tf.tidy(() => a.sub(b).abs().max().dataSync()[0])

describe("KVCache", () => {
  const model = createDecoder()
  const tokens = [3, 1, 4, 1, 5, 9, 2, 6]

  it("predicts the same as a full forward pass: prompt, then one token at a time", () => {
    const cache = new KVCache(model)
    const prompt = 3
    const steps = [tokens.slice(0, prompt), ...tokens.slice(prompt).map((t) => [t])]
    for (const step of steps) {
      const probs = cache.append(step)
      const expected = predictNext(model, tokens.slice(0, cache.length))
      expect(probs.shape).toEqual([vocabSize])
      expect(maxDiff(probs, expected)).toBeLessThan(1e-5)
      tf.dispose([probs, expected])
    }
    expect(cache.length).toBe(tokens.length)
    cache.dispose()
  })

  it("keeps only the cached keys and values between steps", () => {
    const cache = new KVCache(model)
    tf.dispose(cache.append(tokens.slice(0, 2)))
    const numTensors = tf.memory().numTensors
    tf.dispose(cache.append([tokens[2]]))
    expect(tf.memory().numTensors).toBe(numTensors) // replaced, not added
    cache.dispose()
    expect(tf.memory().numTensors).toBe(numTensors - 2 * 2) // key + value of 2 attention layers
  })
})
