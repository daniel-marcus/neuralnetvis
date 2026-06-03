import * as tf from "@tensorflow/tfjs"
import type { Dataset, Sample, SampleRaw } from "./types"

export function preprocessSample(sampleRaw?: SampleRaw, ds?: Dataset) {
  if (!sampleRaw || !ds) return
  const rawX = sampleRaw.rawX ?? sampleRaw.X
  const xTensor = tf.tidy(() => {
    const tensor = tf.tensor(sampleRaw.X, [1, ...ds.inputDims])
    return ds.preprocess ? ds.preprocess(tensor) : tensor
  })
  const sample: Sample = { ...sampleRaw, rawX, xTensor }
  return sample
}
