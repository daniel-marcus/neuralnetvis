import * as tf from "@tensorflow/tfjs"
import type { PreprocessFuncDef } from "./types"

// TODO: only use shaped input tensors (no more flattened)

const normalizeImage: PreprocessFuncDef = (inputTensor) => inputTensor.div(255)

export const normalizeHandLandmarks: PreprocessFuncDef = (
  inputTensor,
  inputDims
) => {
  // all coordinates relative to wrist (0, 0, 0) + invert axises
  const numHands = inputDims[2]
  const inputShape = inputTensor.shape
  const normalized = tf.tidy(() => {
    const reshaped = inputTensor.reshape([-1, ...inputDims])
    const wrists = reshaped.slice([0, 0, 0, 0], [-1, 1, 3, numHands ?? 1])
    const xyzAxisInvertMask = tf
      .tensor([-1, -1, -1], [1, 1, 3, 1])
      .tile([1, 21, 1, 1])
    const normalized = reshaped
      .sub(wrists)
      .mul(xyzAxisInvertMask)
      .reshape(inputShape) as typeof inputTensor
    return normalized
  })
  return normalized
}

export const preprocessFuncs = {
  normalizeImage,
  normalizeHandLandmarks,
} as const
