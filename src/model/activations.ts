import { useCallback, useEffect, useRef } from "react"
import * as tf from "@tensorflow/tfjs"
import { useThree } from "@react-three/fiber"
import { useSample, type Sample } from "@/data"
import { useActivationStats, type ActivationStats } from "./activation-stats"
import { normalize, channelNormalize, scaleNormalize } from "@/data/utils"
import { useSceneStore, isDebug } from "@/store"
import { getChannelColor, getActColor, getPredQualColor } from "@/utils/colors"
import type { NeuronLayer } from "@/neuron-layers"
import type { LayerActivations } from "./types"

type UpdateTracker = Map<Sample["index"], Set<NeuronLayer["index"]>>

export function ActivationUpdater() {
  const sample = useSample()
  const model = useSceneStore((s) => s.model)
  const ds = useSceneStore((s) => s.ds)
  const actStats = useActivationStats(model, ds)
  const isRegr = useSceneStore((s) => s.isRegression())
  const setActivations = useSceneStore((s) => s.setActivations)
  const layers = useSceneStore((s) => s.allLayers)
  const focusIdx = useFlatViewFocussed()
  const invalidate = useThree((s) => s.invalidate)

  // keep track which layers already show the current sample
  const updateTracker = useRef<UpdateTracker>(new Map())

  const maybeUpdate = useCallback(
    async (sample?: Sample, focusIdx?: number) => {
      if (!model || !sample) return

      const updatedLayers = updateTracker.current.get(sample.index) ?? new Set()
      const needsUpdate = (l: NeuronLayer) => !updatedLayers.has(l.index)
      const isFocussed = (l: NeuronLayer) => l.index === focusIdx
      const layersToUpdate =
        typeof focusIdx === "number"
          ? layers.filter((l) => isFocussed(l) && needsUpdate(l))
          : layers.filter(needsUpdate)

      if (!layersToUpdate.length) return

      const t0 = performance.now()
      const args = [model, layersToUpdate, sample, actStats, isRegr] as const
      const newActivations = await getProcessedActivations(...args)
      const dt = performance.now() - t0
      if (isDebug()) console.log(`>> total: ${dt}ms (${layersToUpdate.length})`)

      setActivations(newActivations)
      invalidate()

      const newUpdated = new Set(updatedLayers)
      layersToUpdate.forEach((l) => newUpdated.add(l.index))
      updateTracker.current.set(sample.index, newUpdated)
    },
    [model, layers, actStats, isRegr, setActivations, invalidate]
  )

  // reset update tracker when model changes
  useEffect(() => updateTracker.current.clear(), [maybeUpdate])

  useEffect(() => {
    maybeUpdate(sample, focusIdx)
  }, [sample, focusIdx, maybeUpdate])

  return null
}

function useFlatViewFocussed() {
  // avoid updates during scrolling when focusIdx changes often
  const focusIdx = useSceneStore((s) => s.focussedLayerIdx)
  const isFlatView = useSceneStore((s) => s.vis.flatView)
  return isFlatView ? focusIdx : undefined
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
    const t0 = performance.now()
    const allActivations = getLayerActivations(model, sample.xTensor, outputs)
    const t1 = performance.now()
    if (isDebug()) console.log(`inference: ${t1 - t0}ms`)
    const activations: (tf.Tensor[] | undefined)[] = []
    for (const [i, layer] of layers.entries()) {
      const layerActivations = allActivations?.[i]
      if (!layerActivations) {
        activations.push(undefined)
        continue
      }
      const flattened = layerActivations.flatten()
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
      activations.push([flattened, normalizedFlattened])
    }
    if (isDebug()) console.log(`normalization: ${performance.now() - t1}ms`)
    return activations
  })

  const newLayerActivations: { [layerIdx: number]: LayerActivations } = {}
  try {
    const start = performance.now()
    for (const [i, layer] of layers.entries()) {
      if (!activationTensors[i]) continue
      const [, normActTensor] = activationTensors[i]
      // const act = (await actTensor.data()) as Float32Array
      const normAct = (await normActTensor.data()) as Float32Array

      // reuse color buffers from layer to avoid reallocating
      const { rgbColors } = layer

      if (layer.hasColorChannels) {
        for (let nIdx = 0; nIdx < normAct.length; nIdx += 1) {
          const channelIdx = nIdx % 3
          const channelOffset = channelIdx * layer.numNeurons
          const newIdx = Math.floor((channelOffset + nIdx) / 3)
          rgbColors[newIdx] = normAct[nIdx]
        }
      } else {
        rgbColors.set(normAct)
      }

      /* 
      const isRegressionOutput = isRegression && layer.layerPos === "output"
      const stats = activationStats?.[layer.index]

      for (let nIdx = 0; nIdx < normAct.length; nIdx += 1) {
        const a = normAct[nIdx]
        const color = layer.hasColorChannels
          ? getChannelColor(nIdx % 3, a)
          : isRegressionOutput && stats
          ? getPredQualColor(act[nIdx], sample.y, stats.mean.dataSync()[0])
          : getActColor(a)
        if (!color) continue
        if (layer.hasColorChannels) {
          // for color layers we need a different order: [...allRed, ...allGreen, ...allBlue]
          // see useColorArray in layer-instanced.tsx for details
          const channelIdx = nIdx % 3
          const channelOffset = channelIdx * layer.numNeurons
          if (!color) continue
          rgbColors[channelOffset + nIdx] = color.rgb[channelIdx]
        } else {
          rgbColors[nIdx] = a
          rgbColors[nIdx * 3] = color.rgb[0]
          rgbColors[nIdx * 3 + 1] = color.rgb[1]
          rgbColors[nIdx * 3 + 2] = color.rgb[2]
        }
        rgbaColors[nIdx] = color.rgba
      }
      */

      newLayerActivations[layer.index] = {
        activations: normAct,
        normalizedActivations: normAct,
      }
    }
    const end = performance.now()
    if (isDebug()) console.log(`download/colors: ${end - start}ms`)
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
