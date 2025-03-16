import * as tf from "@tensorflow/tfjs"
import { describe, it, expect, beforeAll } from "vitest"
import { handPose } from "./datasets/hand-pose"
import { normalizeHandLandmarks } from "./preprocess"

describe("normalizeHandLandmarks", () => {
  let singleInput: tf.Tensor | undefined
  let batchInput: tf.Tensor | undefined
  let resultSingle: tf.Tensor | undefined
  let resultBatch: tf.Tensor | undefined

  beforeAll(async () => {
    const { xTrain } = await handPose.loadPreview!()
    batchInput = tf.tensor(xTrain.data, xTrain.shape)
    singleInput = batchInput.slice([0, 0, 0, 0], [1]).flatten()
    resultSingle = normalizeHandLandmarks(singleInput, handPose.inputDims)
    resultBatch = normalizeHandLandmarks(batchInput, handPose.inputDims)
  })

  it("should return correctly shaped input", async () => {
    if (!batchInput || !singleInput) throw new Error("No inputTensor")
    if (!resultSingle || !resultBatch) throw new Error("No result")
    console.log(resultSingle.shape, resultBatch.shape)
    expect(resultSingle.shape).toEqual(singleInput.shape)
    expect(resultBatch.shape).toEqual(batchInput.shape)
  })

  it("single input: should return correct values", async () => {
    if (!resultSingle || !singleInput) throw new Error("No data")
    const landmarks = singleInput
      .reshape(handPose.inputDims.slice(0, 2))
      .arraySync() as number[][]
    const normalized = manuallyNormalize(landmarks).flat().map(round)
    const result = resultSingle.arraySync() as number[]
    expect(result.map(round)).toEqual(normalized.map(round))
  })

  it("batch input: should return correct values", async () => {
    if (!resultBatch || !batchInput) throw new Error("No data")
    const SAMPLES = 5
    const testInput = batchInput.slice([0, 0, 0, 0], [SAMPLES]) // two samples
    const testResult = normalizeHandLandmarks(
      testInput,
      handPose.inputDims
    ).arraySync() as number[][][]
    for (let i = 0; i < SAMPLES; i++) {
      const sampleLandmarks = (testInput.arraySync() as number[][][])[i]
      const normalized = manuallyNormalize(sampleLandmarks).flat().map(round)
      const result = testResult[i].flat().map(round)
      expect(result).toEqual(normalized)
    }
  })

  // ... more tests for two hands?
})

function manuallyNormalize(landmarks: number[][]) {
  const wrist = landmarks[0]
  return landmarks.map((l) => [
    -1 * (l[0] - wrist[0]),
    -1 * (l[1] - wrist[1]),
    -1 * (l[2] - wrist[2]),
  ])
}

function round(val: number) {
  // round values to 6 decimal places, otherwise tf vs manual might have slightly different values
  const dec = 6
  const newVal = Math.round(val * 10 ** dec) / 10 ** dec
  return Object.is(newVal, -0) ? 0 : newVal
}
