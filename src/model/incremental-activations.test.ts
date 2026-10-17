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
import { IncrementalActivations } from "./incremental-activations"

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

const tokens = [3, 1, 4, 1, 5, 9, 2, 6]
const pad = (text: number[]) => [...text, ...Array(seqLen - text.length).fill(0)]
const maxDiff = (a: tf.Tensor, b: tf.Tensor) => tf.tidy(() => a.sub(b).abs().max().dataSync()[0])

describe("IncrementalActivations", () => {
  const model = createDecoder()
  const outputs = model.layers.map((l) => l.output as tf.SymbolicTensor) // incl. the input layer
  const reference = createModel({ inputs: model.inputs, outputs }) as unknown as tf.LayersModel

  // full forward pass vs. incremental: same activations at the text's positions, zeros after it
  function expectSameAsFullPass(activations: tf.Tensor[], text: number[]) {
    const expected = reference.predict(
      tf.tensor2d([pad(text)], [1, seqLen], "int32"),
    ) as tf.Tensor[]
    const n = text.length
    for (const [i, t] of activations.entries()) {
      const isModelOutput = i === outputs.length - 1 // only the last position
      const exp = isModelOutput ? expected[i].slice([0, n - 1], [1, 1]) : expected[i]
      expect(t.shape).toEqual(exp.shape)
      if (isModelOutput) expect(maxDiff(t, exp)).toBeLessThan(1e-5)
      else {
        expect(maxDiff(t.slice([0, 0], [1, n]), exp.slice([0, 0], [1, n]))).toBeLessThan(1e-5)
        expect(tf.tidy(() => t.slice([0, n]).abs().max().dataSync()[0])).toBe(0) // padding
      }
    }
    tf.dispose(expected)
  }

  it("matches a full forward pass while the text grows and after an edit", () => {
    const incremental = new IncrementalActivations(model, outputs)
    // prompt, one token, two tokens (causal mask with an offset), one token, edited text
    const texts = [3, 4, 6, 7].map((n) => tokens.slice(0, n)).concat([[7, 7, 7, 7, 7]])
    for (const text of texts) {
      const activations = incremental.update(text, outputs)!
      expectSameAsFullPass(activations, text)
      tf.dispose(activations)
    }
    incremental.dispose()
    expect(incremental.update(tokens, outputs)).toBeUndefined()
  })

  it("keeps only the rows and the keys and values of the current text", () => {
    const incremental = new IncrementalActivations(model, outputs)
    tf.dispose(incremental.update(tokens.slice(0, 2), outputs))
    const numTensors = tf.memory().numTensors
    tf.dispose(incremental.update(tokens.slice(0, 3), outputs))
    tf.dispose(incremental.update([5, 5], outputs)) // edited: starts over
    expect(tf.memory().numTensors).toBe(numTensors)
    incremental.dispose()
  })
})
