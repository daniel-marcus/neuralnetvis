import { useEffect, useRef } from "react"
import * as tf from "@tensorflow/tfjs"
import { useActivationStats, type ActivationStats } from "./activation-stats"
import { normalize, channelNormalize, scaleNormalize } from "@/data/utils"
import { useSceneStore, isDebug } from "@/store"
import { getChannelColor, getActColor, getPredQualColor } from "@/utils/colors"
import type { NeuronLayer } from "@/neuron-layers"
import type { LayerActivations } from "./types"
import type { Sample } from "@/data"

export function useActivations() {
  const model = useSceneStore((s) => s.model)
  const ds = useSceneStore((s) => s.ds)
  const sample = useSceneStore((s) => s.sample)
  const actStats = useActivationStats(model, ds)
  const isRegression = useSceneStore((s) => s.isRegression())
  const setActivations = useSceneStore((s) => s.setActivations)
  const _layers = useSceneStore((s) => s.allLayers)
  const focusIdx = useSceneStore((s) => s.focussedLayerIdx)
  const lastSample = useRef<Sample | undefined>(undefined)
  useEffect(() => {
    async function update() {
      if (!model || !sample || !_layers.length) return
      const hasFocussed = typeof focusIdx === "number"
      if (hasFocussed && sample === lastSample.current) return
      lastSample.current = sample

      const focusFilter = (l: NeuronLayer) => l.index === focusIdx
      const layers = hasFocussed ? _layers.filter(focusFilter) : _layers

      const startTime = performance.now()
      const args = [model, layers, sample, actStats, isRegression] as const
      const newActivations = await getProcessedActivations(...args)
      const endTime = performance.now()
      if (isDebug()) console.log(`Activations took ${endTime - startTime}ms`)
      setActivations(newActivations)
    }
    update()
  }, [_layers, focusIdx, model, sample, actStats, isRegression, setActivations])
}

export function useLayerActivations(layerIdx: number) {
  return useSceneStore((s) => s.activations[layerIdx])
}

export function useActivation(layerIdx: number, neuronIdx: number) {
  return useSceneStore((s) => s.activations[layerIdx]?.activations[neuronIdx])
}

async function getProcessedActivations(
  model: tf.LayersModel,
  layers: NeuronLayer[],
  sample: Sample,
  activationStats?: ActivationStats[],
  isRegression?: boolean
) {
  const outputs = layers.map((l) => l.tfLayer.output as tf.SymbolicTensor) // assume single output
  await tf.ready()
  const activationTensors = tf.tidy(() => {
    const allActivations = getLayerActivations(model, sample.xTensor, outputs)
    const activations = layers.map((layer, i) => {
      const layerActivations = allActivations?.[i]
      if (!layerActivations) return
      const flattened = layerActivations.reshape([-1]) as tf.Tensor1D
      const hasDepthDim = typeof layer.tfLayer.outputShape[3] === "number"
      const isSoftmax = layer.tfLayer.getConfig().activation === "softmax"
      const stats = activationStats?.[layer.index]
      const normalizedFlattened = hasDepthDim
        ? channelNormalize(layerActivations as tf.Tensor4D).flatten()
        : isRegression && layer.layerPos !== "input" && !!stats
        ? scaleNormalize(flattened, stats.mean, stats.std)
        : isSoftmax
        ? flattened
        : normalize(flattened)
      return [flattened, normalizedFlattened]
    })
    return activations
  })

  const newLayerActivations: { [layerIdx: number]: LayerActivations } = {}
  try {
    for (const [i, layer] of layers.entries()) {
      if (!activationTensors[i]) continue
      const [actTensor, normActTensor] = activationTensors[i]
      const act = (await actTensor.data()) as Float32Array
      const normAct = (await normActTensor.data()) as Float32Array

      const isRegressionOutput = isRegression && layer.layerPos === "output"

      const rgbColors = new Float32Array(normAct.length * 3)
      const rgbaColors = new Uint32Array(normAct.length)

      const stats = activationStats?.[layer.index]
      for (let nIdx = 0; nIdx < normAct.length; nIdx += 1) {
        const a = normAct[nIdx]
        const color = layer.hasColorChannels
          ? getChannelColor(nIdx % 3, a)
          : isRegressionOutput && stats
          ? getPredQualColor(act[nIdx], sample.y, stats.mean.dataSync()[0])
          : getActColor(a)
        rgbColors[nIdx * 3] = color.rgb[0]
        rgbColors[nIdx * 3 + 1] = color.rgb[1]
        rgbColors[nIdx * 3 + 2] = color.rgb[2]
        rgbaColors[nIdx] = color.rgba
      }

      newLayerActivations[layer.index] = {
        activations: act,
        normalizedActivations: normAct,
        rgbColors,
        rgbaColors,
      }
    }
    return newLayerActivations
  } catch (e) {
    console.log("Error getting activations", e)
    return {}
  } finally {
    activationTensors.flat().forEach((t) => t?.dispose())
  }
}

export function getLayerActivations(
  model: tf.LayersModel,
  inputTensor: tf.Tensor,
  outputs?: tf.SymbolicTensor[]
) {
  const inputDimsModel = model.layers[0].batchInputShape.slice(1)
  const inputDimsSample = inputTensor.shape.slice(1)
  if (!checkShapeMatch(inputDimsModel, inputDimsSample)) return
  try {
    return tf.tidy(() => {
      const tmpModel = tf.model({
        inputs: model.input,
        outputs: outputs ?? model.layers.flatMap((layer) => layer.output),
      })
      const result = tmpModel.predict(inputTensor)
      return Array.isArray(result) ? result : [result]
    })
  } catch {
    return
  }
}

type Shape = (number | null)[]

export function checkShapeMatch(s1: Shape, s2: Shape) {
  return s1.every((value, idx) => value === s2[idx])
}
