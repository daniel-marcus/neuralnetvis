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

export async function getProcessedActivations(
  model: tf.LayersModel,
  sample: Sample,
  activationStats?: ActivationStats[],
  isRegression?: boolean
) {
  await tf.ready()
  const activationTensors = tf.tidy(() => {
    const layerActivations = getLayerActivations(model, sample.xTensor)
    const activations = layerActivations.map((layerActivation, i) => {
      const flattened = layerActivation.reshape([-1]) as tf.Tensor1D
      const hasDepthDim = typeof layerActivation.shape[3] === "number"
      const normalizedFlattened = hasDepthDim
        ? normalizeConv2DActivations(layerActivation as tf.Tensor4D).flatten()
        : isRegression && i > 0 && activationStats
        ? scaleNormalize(
            flattened,
            activationStats[i].mean,
            activationStats[i].std
          )
        : normalizeTensor(flattened)
      return [flattened, normalizedFlattened]
    })
    return activations
  })

  const newLayerActivations: LayerActivations[] = []
  try {
    for (const [actTensor, normActTensor] of activationTensors) {
      const act = (await actTensor.array()) as number[]
      const normAct = (await normActTensor.array()) as number[]
      newLayerActivations.push({
        activations: act,
        normalizedActivations: normAct,
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
}
