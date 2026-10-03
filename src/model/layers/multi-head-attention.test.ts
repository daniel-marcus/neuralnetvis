import { describe, it, expect, vi } from "vitest"
import * as tf from "@tensorflow/tfjs"
// Under Node, @tensorflow/tfjs resolves to the CJS bundle, which has its own copy of the tfjs-layers
// classes. Build the models from the ESM files instead (as the browser bundle does), so that they
// share SymbolicTensor/Layer with the MultiHeadAttention subclass.
import { input, model as createModel, loadLayersModel } from "@tensorflow/tfjs-layers/dist/exports"
import { add, dense, globalAveragePooling1d } from "@tensorflow/tfjs-layers/dist/exports_layers"
import type { Layer, SymbolicTensor } from "@tensorflow/tfjs-layers/dist/engine/topology"
import type { LayersModel } from "@tensorflow/tfjs-layers/dist/engine/training"
import { MultiHeadAttention } from "./multi-head-attention"

const seqLen = 6
const dim = 8
const numHeads = 2
const keyDim = 4

type AttentionLayer = Layer & {
  getAttentionScores: (query: tf.Tensor) => tf.Tensor
  queryDense: Layer
  keyDense: Layer
}

function createSelfAttentionModel() {
  const inp = input({ shape: [seqLen, dim] })
  const x = dense({ units: dim }).apply(inp) as SymbolicTensor
  const mha = MultiHeadAttention.constructorFunc({ numHeads, keyDim }) as AttentionLayer
  const attn = mha.apply([x, x]) as SymbolicTensor // as in Keras: mha(x, x)
  const res = add().apply([x, attn]) as SymbolicTensor // x is used again after the attention layer
  const pooled = globalAveragePooling1d().apply(res) as SymbolicTensor
  const out = dense({ units: 2, activation: "softmax" }).apply(pooled) as SymbolicTensor
  return { model: createModel({ inputs: inp, outputs: out }), mha, mhaInput: x }
}

async function getArtifacts(model: LayersModel) {
  let artifacts: tf.io.ModelArtifacts | undefined
  await model.save(
    tf.io.withSaveHandler(async (a) => {
      artifacts = a
      return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: "JSON" } }
    }),
  )
  return artifacts!
}

describe("MultiHeadAttention (self-attention)", () => {
  const xs = tf.randomNormal([3, seqLen, dim])
  const ys = tf.oneHot(tf.tensor1d([0, 1, 0], "int32"), 2)

  it("uses a single graph input for [x, x]", () => {
    const { mha } = createSelfAttentionModel()
    expect(mha.inboundNodes[0].inboundLayers).toHaveLength(1)
  })

  it("works with predict and evaluate", () => {
    const { model } = createSelfAttentionModel()
    model.compile({ optimizer: "sgd", loss: "categoricalCrossentropy" })
    const pred = model.predict(xs) as tf.Tensor
    expect(pred.shape).toEqual([3, 2])
    const loss = model.evaluate(xs, ys) as tf.Scalar
    expect(Number.isFinite(loss.dataSync()[0])).toBe(true)
  })

  it("loads models exported from Keras with [x, x] inputs", async () => {
    const { model } = createSelfAttentionModel()
    const artifacts = await getArtifacts(model)
    const topology = artifacts.modelTopology as { config: { layers: KerasLayerJson[] } }
    const mhaJson = topology.config.layers.find((l) => l.class_name === "MultiHeadAttention")!
    const [x] = mhaJson.inbound_nodes[0]
    mhaJson.inbound_nodes = [[x, x]]

    const warn = vi.spyOn(console, "warn")
    const loaded = await loadLayersModel(tf.io.fromMemory(artifacts))
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("non-serializable"))
    warn.mockRestore()

    const expected = (model.predict(xs) as tf.Tensor).arraySync()
    expect((loaded.predict(xs) as tf.Tensor).arraySync()).toEqual(expected)
  })

  it("returns attention scores equal to softmax(QK^T / sqrt(keyDim))", () => {
    const { model, mha, mhaInput } = createSelfAttentionModel()
    const x = createModel({ inputs: model.inputs, outputs: mhaInput }).predict(xs) as tf.Tensor
    const scores = mha.getAttentionScores(x)
    expect(scores.shape).toEqual([3, numHeads, seqLen, seqLen])

    const expected = tf.tidy(() => {
      const q = (mha.queryDense.apply(x) as tf.Tensor).transpose([0, 2, 1, 3]) // [b, heads, seq, keyDim]
      const k = (mha.keyDense.apply(x) as tf.Tensor).transpose([0, 2, 1, 3])
      return tf.softmax(tf.matMul(q, k, false, true).div(Math.sqrt(keyDim)))
    })
    const maxDiff = scores.sub(expected).abs().max().dataSync()[0]
    expect(maxDiff).toBeLessThan(1e-6)
  })
})

type KerasLayerJson = {
  class_name: string
  inbound_nodes: unknown[][]
}
