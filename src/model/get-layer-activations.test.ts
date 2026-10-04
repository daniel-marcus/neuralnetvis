import { describe, it, expect } from "vitest"
import * as tf from "@tensorflow/tfjs"
// ESM build of tfjs-layers, as the MultiHeadAttention layer (see multi-head-attention.test.ts)
import { input, model as createModel } from "@tensorflow/tfjs-layers/dist/exports"
import { add, dense, layerNormalization } from "@tensorflow/tfjs-layers/dist/exports_layers"
import type { SymbolicTensor } from "@tensorflow/tfjs-layers/dist/engine/topology"
import type { LayersModel } from "@tensorflow/tfjs-layers/dist/engine/training"
import { MultiHeadAttention } from "./layers/multi-head-attention"
import { getLayerActivationsAsync, getSingleOutput } from "./get-layer-activations"

const [seqLen, dim] = [6, 8]

function createDecoderBlock() {
  // pre-LN decoder block as in ml-notebooks/tweets.py: x is used by several layers
  const inp = input({ shape: [seqLen, dim] })
  const x = dense({ units: dim }).apply(inp) as SymbolicTensor
  const h = layerNormalization().apply(x) as SymbolicTensor
  const mha = MultiHeadAttention.constructorFunc({ numHeads: 2, keyDim: 4 })
  const attn = mha.apply([h, h], { useCausalMask: true }) as SymbolicTensor
  const res = add().apply([x, attn]) as SymbolicTensor
  const out = dense({ units: 3, activation: "softmax" }).apply(res) as SymbolicTensor
  return createModel({ inputs: inp, outputs: out })
}

describe("getLayerActivationsAsync", () => {
  const model = createDecoderBlock()
  const outputs = model.layers.slice(1).map(getSingleOutput) as unknown as tf.SymbolicTensor[]
  const xs = tf.randomNormal([1, seqLen, dim])
  const asTfjs = model as unknown as tf.LayersModel

  it("computes the same activations as predict()", async () => {
    const reference = createModel({ inputs: model.inputs, outputs }) as unknown as LayersModel
    const expected = reference.predict(xs) as tf.Tensor[]
    const activations = await getLayerActivationsAsync(asTfjs, xs, outputs, { sliceMs: 0 })
    expect(activations).toHaveLength(outputs.length)
    for (const [i, t] of activations!.entries()) {
      expect(t.shape).toEqual(expected[i].shape)
      expect(t.sub(expected[i]).abs().max().dataSync()[0]).toBe(0)
    }
  })

  it("disposes the intermediate tensors", async () => {
    const lastOnly = outputs.slice(-1)
    await getLayerActivationsAsync(asTfjs, xs, lastOnly).then((r) => tf.dispose(r)) // warm up
    const numTensors = tf.memory().numTensors
    const activations = await getLayerActivationsAsync(asTfjs, xs, lastOnly, { sliceMs: 0 })
    expect(tf.memory().numTensors).toBe(numTensors + 1)
    tf.dispose(activations)
  })

  it("keeps running when the input tensor is disposed in between (new sample)", async () => {
    const x = xs.clone()
    const pending = getLayerActivationsAsync(asTfjs, x, outputs, { sliceMs: 0 })
    x.dispose()
    const activations = await pending
    expect(activations).toHaveLength(outputs.length)
    tf.dispose(activations)
  })

  it("stops when aborted and disposes what was computed", async () => {
    const numTensors = tf.memory().numTensors
    const opts = { sliceMs: 0, shouldAbort: () => true }
    expect(await getLayerActivationsAsync(asTfjs, xs, outputs, opts)).toBeUndefined()
    expect(tf.memory().numTensors).toBe(numTensors)
  })
})
