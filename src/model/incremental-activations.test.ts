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
  multiply,
} from "@tensorflow/tfjs-layers/dist/exports_layers"
import type { Layer, SymbolicTensor } from "@tensorflow/tfjs-layers/dist/engine/topology"
import { MultiHeadAttention } from "./layers/multi-head-attention"
import { RMSNormalization } from "./layers/rms-normalization"
import { ZeroPadding1D } from "./layers/zero-padding1d"
import { DepthwiseConv1D } from "./layers/depthwise-conv1d"
import { RotaryGroupQueryAttention } from "./layers/rotary-group-query-attention"
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

// LFM2: a short convolution block (C * conv(B * x), causal) and an attention block (RoPE, GQA, qk-norm), each
// with a SwiGLU MLP, see ml-notebooks/lfm2.py
const apply = (layer: Layer, x: SymbolicTensor | SymbolicTensor[]) =>
  layer.apply(x) as SymbolicTensor

function createLfm2() {
  const inp = input({ shape: [seqLen], dtype: "int32" })
  let x = apply(embedding({ inputDim: vocabSize, outputDim: dim }), inp)
  for (const block of ["conv", "attention"]) {
    let h = apply(RMSNormalization.constructorFunc({ epsilon: 1e-5 }), x)
    if (block === "conv") {
      const [b, c, v] = [0, 1, 2].map(() => apply(dense({ units: dim, useBias: false }), h))
      const padded = apply(
        ZeroPadding1D.constructorFunc({ padding: [2, 0] }),
        apply(multiply(), [b, v]),
      )
      const conv = apply(DepthwiseConv1D.constructorFunc({ kernelSize: 3, useBias: false }), padded)
      h = apply(dense({ units: dim, useBias: false }), apply(multiply(), [c, conv]))
    } else {
      const attention = RotaryGroupQueryAttention.constructorFunc({
        headDim: 2,
        numQueryHeads: 4,
        numKeyValueHeads: 2,
        qkNormEpsilon: 1e-5,
      })
      h = attention.apply([h, h], { useCausalMask: true }) as SymbolicTensor
    }
    x = apply(add(), [x, h])
    h = apply(RMSNormalization.constructorFunc({ epsilon: 1e-5 }), x)
    const gate = apply(dense({ units: 2 * dim, activation: "swish", useBias: false }), h)
    const up = apply(dense({ units: 2 * dim, useBias: false }), h)
    x = apply(add(), [
      x,
      apply(dense({ units: dim, useBias: false }), apply(multiply(), [gate, up])),
    ])
  }
  const logits = apply(dense({ units: vocabSize }), x)
  const out = apply(activation({ activation: "softmax" }), logits)
  return createModel({ inputs: inp, outputs: out }) as unknown as tf.LayersModel
}

const tokens = [3, 1, 4, 1, 5, 9, 2, 6]
const pad = (text: number[]) => [...text, ...Array(seqLen - text.length).fill(0)]
const maxDiff = (a: tf.Tensor, b: tf.Tensor) => tf.tidy(() => a.sub(b).abs().max().dataSync()[0])

describe.each([
  ["GPT-2", createDecoder],
  ["LFM2", createLfm2],
])("IncrementalActivations (%s)", (_, create) => {
  const model = create()
  // incl. the input layer, without the padding layers (invisible, longer sequence)
  const outputs = model.layers
    .filter((l) => l.getClassName() !== "ZeroPadding1D")
    .map((l) => l.output as tf.SymbolicTensor)
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

  it("keeps only the rows, the keys and values and the convolution inputs of the current text", () => {
    const incremental = new IncrementalActivations(model, outputs)
    tf.dispose(incremental.update(tokens.slice(0, 2), outputs))
    const numTensors = tf.memory().numTensors
    tf.dispose(incremental.update(tokens.slice(0, 3), outputs))
    tf.dispose(incremental.update([5, 5], outputs)) // edited: starts over
    expect(tf.memory().numTensors).toBe(numTensors)
    incremental.dispose()
  })
})
