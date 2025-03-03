import type { PreprocessFunc } from "./types"

// note: training uses input w/ batchInputShape, sample uses flattened input

const normalizeImage: PreprocessFunc = (inputTensor) => inputTensor.div(255)

export const preprocessFuncs = {
  normalizeImage,
} as const
