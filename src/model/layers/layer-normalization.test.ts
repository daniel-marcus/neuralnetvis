import { describe, it, expect } from "vitest"
import * as tf from "@tensorflow/tfjs"
// ESM files instead of the CJS bundle, see multi-head-attention.test.ts
import { input, model as createModel, loadLayersModel } from "@tensorflow/tfjs-layers/dist/exports"
import { layerNormalization } from "@tensorflow/tfjs-layers/dist/exports_layers"
import { LayerNormalization as TfjsLayerNormalization } from "@tensorflow/tfjs-layers/dist/layers/normalization"
import type { Layer, SymbolicTensor } from "@tensorflow/tfjs-layers/dist/engine/topology"
import type { LayersModel } from "@tensorflow/tfjs-layers/dist/engine/training"
import { LayerNormalization } from "./layer-normalization"

const shape = [4, 6] // [seq, features]

const maxDiff = (a: tf.Tensor, b: tf.Tensor) => a.sub(b).abs().max().dataSync()[0]

// both layers with the same random gamma and beta
function createLayers(axis: number | number[]) {
  const args = { axis, epsilon: 1e-5 }
  const ours = LayerNormalization.constructorFunc(args)
  const ref = new TfjsLayerNormalization(args)
  for (const layer of [ours, ref]) layer.build([null, ...shape])
  const weights = ours.getWeights().map((w) => tf.randomNormal(w.shape))
  for (const layer of [ours, ref]) layer.setWeights(weights)
  return { ours, ref }
}

function getGrads(layer: Layer, x: tf.Tensor, target: tf.Tensor) {
  const f = (inp: tf.Tensor) => (layer.apply(inp) as tf.Tensor).mul(target).sum() as tf.Scalar
  const dx = tf.grad(f)(x)
  const vars = layer.trainableWeights.map((w) => w.read() as tf.Variable)
  const { grads } = tf.variableGrads(() => f(x), vars)
  return [dx, ...vars.map((v) => grads[v.name])]
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

describe.each([{ axis: -1 }, { axis: [1, 2] }])("LayerNormalization (axis $axis)", ({ axis }) => {
  it("gives the same output as tfjs' LayerNormalization", () => {
    const { ours, ref } = createLayers(axis)
    const x = tf.randomNormal([2, ...shape], 3, 2)
    expect(maxDiff(ours.apply(x) as tf.Tensor, ref.apply(x) as tf.Tensor)).toBeLessThan(1e-5)
  })

  it("gives the same gradients for the input, gamma and beta", () => {
    const { ours, ref } = createLayers(axis)
    const x = tf.randomNormal([2, ...shape], 3, 2)
    const target = tf.randomNormal([2, ...shape])
    const [oursGrads, refGrads] = [ours, ref].map((layer) => getGrads(layer, x, target))
    expect(oursGrads).toHaveLength(3)
    for (const [i, grad] of oursGrads.entries()) {
      expect(maxDiff(grad, refGrads[i])).toBeLessThan(1e-4)
    }
  })
})

it("is used for LayerNormalization when loading a model", async () => {
  const inp = input({ shape })
  const out = layerNormalization().apply(inp) as SymbolicTensor
  const artifacts = await getArtifacts(createModel({ inputs: inp, outputs: out }))
  const loaded = await loadLayersModel(tf.io.fromMemory(artifacts))
  const layer = loaded.layers.find((l) => l.getClassName() === "LayerNormalization")
  expect(layer).toBeInstanceOf(TfjsLayerNormalization)
  expect(layer?.constructor).not.toBe(TfjsLayerNormalization)
})
