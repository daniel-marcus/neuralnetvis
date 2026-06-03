import * as tf from "@tensorflow/tfjs"

export function getSingleOutput(tfLayer: tf.layers.Layer) {
  const nodeIdx = tfLayer.inboundNodes.length - 1 // last inbound node; normally this is just 0, but in cases of nested models (e.g. Sequential as a layer) it is 1
  const result = tfLayer.getOutputAt(nodeIdx)
  return Array.isArray(result) ? result[0] : result
}

type Shape = (number | null)[]

function checkShapeMatch(s1: Shape, s2: Shape) {
  return s1.every((value, idx) => value === s2[idx])
}

export function getLayerActivations(
  model: tf.LayersModel,
  inputTensor: tf.Tensor,
  outputs?: tf.SymbolicTensor[],
) {
  const inputDimsModel = model.layers[0].batchInputShape.slice(1)
  const inputDimsSample = inputTensor.shape.slice(1)
  if (!checkShapeMatch(inputDimsModel, inputDimsSample)) return
  try {
    return tf.tidy(() => {
      const tmpModel = tf.model({
        inputs: model.input,
        outputs: outputs ?? model.layers.map(getSingleOutput),
      })
      const result = tmpModel.predict(inputTensor)
      return Array.isArray(result) ? result : [result]
    })
  } catch {
    return
  }
}
