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
import { useEffect, useMemo } from "react"
import { isDebug, useSceneStore } from "@/store"
import {
  getChannelColor,
  getHighlightColor,
  getPredictionQualityColor,
} from "@/utils/colors"

export function useActivations() {
  const model = useSceneStore((s) => s.model)
  const ds = useSceneStore((s) => s.ds)
  const sample = useSceneStore((s) => s.sample)
  const activationStats = useActivationStats(model, ds)
  const isRegression = useSceneStore((s) => s.isRegression())
  const setActivations = useSceneStore((s) => s.setActivations)

  useEffect(() => {
    async function update() {
      if (!model || !sample) return

      const startTime = performance.now()
      await tf.ready()
      const newActivations = await getProcessedActivations(
        model,
        sample,
        activationStats,
        isRegression
      )
      const endTime = performance.now()
      if (isDebug()) console.log(`Activations took ${endTime - startTime}ms`)
      setActivations(newActivations)
    }
    update()
  }, [model, sample, activationStats, isRegression, setActivations])
}

export function useLayerActivations(
  layerIdx: number
): LayerActivations | undefined {
  const activations = useSceneStore((s) => s.activations)
  return useMemo(() => activations[layerIdx], [activations, layerIdx])
}

export function useActivation(layerIdx: number, neuronIdx: number) {
  const activations = useLayerActivations(layerIdx)
  return useMemo(() => {
    if (!activations) return undefined
    return activations.activations[neuronIdx]
  }, [activations, neuronIdx])
}

export async function getProcessedActivations(
  model: tf.LayersModel,
  sample: Sample,
  activationStats?: ActivationStats[],
  isRegression?: boolean
) {
  const activationTensors = tf.tidy(() => {
    const layerActivations = getLayerActivations(model, sample.xTensor)
    const activations = layerActivations.map((layerActivation, i) => {
      const flattened = layerActivation.reshape([-1]) as tf.Tensor1D
      const hasDepthDim = typeof layerActivation.shape[3] === "number"
      const isSoftmax = model.layers[i].getConfig().activation === "softmax"
      const normalizedFlattened = hasDepthDim
        ? normalizeConv2DActivations(layerActivation as tf.Tensor4D).flatten()
        : isRegression && i > 0 && activationStats
        ? scaleNormalize(
            flattened,
            activationStats[i].mean,
            activationStats[i].std
          )
        : isSoftmax
        ? flattened
        : normalizeTensor(flattened)
      return [flattened, normalizedFlattened]
    })
    return activations
  })

  const newLayerActivations: LayerActivations[] = []
  try {
    for (const [i, [actTensor, normActTensor]] of activationTensors.entries()) {
      const act = (await actTensor.data()) as Float32Array
      const normAct = (await normActTensor.data()) as Float32Array

      const hasColorChannels = i === 0 && model.layers[i].outputShape[3] === 3
      const isRegressionOutput = isRegression && i === model.layers.length - 1

      const rgbColors = new Float32Array(normAct.length * 3)
      const rgbaColors = new Uint32Array(normAct.length)

      for (let nIdx = 0; nIdx < normAct.length; nIdx += 1) {
        const a = normAct[nIdx]
        const color = hasColorChannels
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

      newLayerActivations.push({
        activations: act,
        normalizedActivations: normAct,
        rgbColors,
        rgbaColors,
      })
    }
    return newLayerActivations
  } catch (e) {
    console.log("Error getting activations", e)
    return []
  } finally {
    activationTensors.flat().forEach((t) => t.dispose())
  }
}

export function getLayerActivations(
  model: tf.LayersModel,
  inputTensor: tf.Tensor
) {
  const inputDimsModel = model.layers[0].batchInputShape.slice(1)
  const inputDimsSample = inputTensor.shape.slice(1)
  if (!checkShapeMatch(inputDimsModel, inputDimsSample)) return []
  try {
    return tf.tidy(() => {
      const tmpModel = tf.model({
        inputs: model.input,
        outputs: model.layers.flatMap((layer) => layer.output),
      })
      const result = tmpModel.predict(inputTensor)
      return Array.isArray(result) ? result : [result]
    })
  } catch (e) {
    console.log("Error getting activations", e)
    return []
  }
}
