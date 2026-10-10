import * as tf from "@tensorflow/tfjs"
import type { PreprocessFuncDef } from "./types"

// TODO: only use shaped input tensors (no more flattened)

const normalizeImage: PreprocessFuncDef = (inputTensor) => inputTensor.div(255)

// [-1, 1] as in keras.applications.mobilenet_v2.preprocess_input
const normalizeImageSigned: PreprocessFuncDef = (inputTensor) => inputTensor.div(127.5).sub(1)

export const normalizeHandLandmarks: PreprocessFuncDef = (inputTensor, inputDims) => {
  // all coordinates relative to wrist (0, 0, 0) + invert axes
  const numHands = inputDims[2]
  const inputShape = inputTensor.shape
  const normalized = tf.tidy(() => {
    const reshaped = inputTensor.reshape([-1, ...inputDims])
    const wrists = reshaped.slice([0, 0, 0, 0], [-1, 1, 3, numHands ?? 1])
    const xyzAxisInvertMask = tf.tensor([-1, -1, -1], [1, 1, 3, 1]).tile([1, 21, 1, 1])
    return reshaped.sub(wrists).mul(xyzAxisInvertMask).reshape(inputShape) as typeof inputTensor
  })
  return normalized
}

export const preprocessFuncs = {
  normalizeImage,
  normalizeImageSigned,
  normalizeHandLandmarks,
} as const

export type PreprocessFuncName = keyof typeof preprocessFuncs

// value range of the model input for image datasets
export const imageInputRanges: Partial<Record<PreprocessFuncName, [number, number]>> = {
  normalizeImage: [0, 1],
  normalizeImageSigned: [-1, 1],
}
