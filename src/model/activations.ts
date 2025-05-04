import * as tf from "@tensorflow/tfjs"
import { ActivationStats, useActivationStats } from "./activation-stats"
import {
  checkShapeMatch,
  normalizeConv2DActivations,
  normalizeTensor,
  scaleNormalize,
} from "@/data/utils"
import type { LayerActivations } from "./types"
import type { Sample } from "@/data"
import { useEffect, useMemo, useRef } from "react"
import { isDebug, useSceneStore } from "@/store"
import {
  getChannelColor,
  getHighlightColor,
  getPredictionQualityColor,
} from "@/utils/colors"
import { NeuronLayer } from "@/neuron-layers"

export function useActivations() {
  const model = useSceneStore((s) => s.model)
  const ds = useSceneStore((s) => s.ds)
  const sample = useSceneStore((s) => s.sample)
  const activationStats = useActivationStats(model, ds)
  const isRegression = useSceneStore((s) => s.isRegression())
  const setActivations = useSceneStore((s) => s.setActivations)
  const visibleLayers = useSceneStore((s) => s.allLayers)
  const focussedIdx = useSceneStore((s) => s.focussedLayerIdx)
  const lastSample = useRef<Sample | undefined>(undefined)
  useEffect(() => {
    async function update() {
      if (!model || !sample || !visibleLayers.length) return
      const hasFocussed = typeof focussedIdx === "number"
      if (hasFocussed && sample === lastSample.current) return
      lastSample.current = sample

      const layers = hasFocussed
        ? visibleLayers.filter((l) => l.index === focussedIdx)
        : visibleLayers

      const startTime = performance.now()
      await tf.ready()
      const newActivations = await getProcessedActivations(
        model,
        layers,
        sample,
        activationStats,
        isRegression
      )
      const endTime = performance.now()
      if (isDebug()) console.log(`Activations took ${endTime - startTime}ms`)
      setActivations(newActivations)
    }
    update()
  }, [
    visibleLayers,
    focussedIdx,
    model,
    sample,
    activationStats,
    isRegression,
    setActivations,
  ])
}

export function useLayerActivations(
  layerIdx: number
): LayerActivations | undefined {
  return useSceneStore((s) => s.activations[layerIdx])
}

export function useActivation(layerIdx: number, neuronIdx: number) {
  const activations = useLayerActivations(layerIdx)
  return useMemo(() => {
    if (!activations) return undefined
    return activations.activations[neuronIdx]
  }, [activations, neuronIdx])
}

async function getProcessedActivations(
  model: tf.LayersModel,
  layers: NeuronLayer[],
  sample: Sample,
  activationStats?: ActivationStats[],
  isRegression?: boolean
) {
  const outputs = layers.map((l) => l.tfLayer.output as tf.SymbolicTensor) // assume single output
  const activationTensors = tf.tidy(() => {
    const allActivations = getLayerActivations(model, sample.xTensor, outputs)
    const activations = layers.map((layer, i) => {
      const layerActivations = allActivations?.[i]
      if (!layerActivations) return
      const flattened = layerActivations.reshape([-1]) as tf.Tensor1D
      const hasDepthDim = typeof layer.tfLayer.outputShape[3] === "number"
      const isSoftmax = layer.tfLayer.getConfig().activation === "softmax"
      const normalizedFlattened = hasDepthDim
        ? normalizeConv2DActivations(layerActivations as tf.Tensor4D).flatten()
        : isRegression && layer.layerPos !== "input" && activationStats
        ? scaleNormalize(
            flattened,
            activationStats[layer.index].mean,
            activationStats[layer.index].std
          )
        : isSoftmax
        ? flattened
        : normalizeTensor(flattened)
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

      for (let nIdx = 0; nIdx < normAct.length; nIdx += 1) {
        const a = normAct[nIdx]
        const color = layer.hasColorChannels
          ? getChannelColor(nIdx % 3, a)
          : isRegressionOutput
          ? getPredictionQualityColor(
              act[nIdx],
              sample.y,
              activationStats?.[i].mean.dataSync()[0]
            )
          : getHighlightColor(a)
        rgbColors.set(color.rgb, nIdx * 3)
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
    return []
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
