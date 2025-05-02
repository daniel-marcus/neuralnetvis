import * as tf from "@tensorflow/tfjs"
import { ActivationStats } from "./activation-stats"
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

export function useActivations(
  sample?: Sample,
  activationStats?: ActivationStats[]
) {
  const model = useSceneStore((s) => s.model)
  const isRegression = useSceneStore((s) => s.isRegression())

  const activations = useSceneStore((s) => s.activations)
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

  return activations
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
      const act = (await actTensor.array()) as number[]
      const normAct = (await normActTensor.array()) as number[]
      const hasColorChannels = i === 0 && model.layers[i].outputShape[3] === 3
      const isRegressionOutput = isRegression && i === model.layers.length - 1
      newLayerActivations.push({
        activations: act,
        normalizedActivations: normAct,
        colors: normAct.map((a, nIdx) =>
          hasColorChannels
            ? getChannelColor(nIdx % 3, a)
            : isRegressionOutput
            ? getPredictionQualityColor(
                act[nIdx],
                sample.y,
                activationStats?.[i].mean.dataSync()[0]
              )
            : getHighlightColor(a)
        ),
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
      const layerActivations = tmpModel.predict(
        inputTensor
      ) as tf.Tensor<tf.Rank>[]
      return layerActivations
    })
  } catch (e) {
    console.log("Error getting activations", e)
    return []
  }
}
