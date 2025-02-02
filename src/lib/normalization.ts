import * as tf from "@tensorflow/tfjs"

export function normalize(data: number[] | unknown) {
  // min-max normalization [0, 1]
  if (!Array.isArray(data)) return [] as number[]
  const max = Math.max(...data)
  const min = Math.min(...data)
  return data.map((v) => (v - min) / (max - min))
}

export function normalizeTensor(tensor: tf.Tensor1D): tf.Tensor1D {
  const min = tensor.min()
  const max = tensor.max()
  return tensor.sub(min).div(max.sub(min))
}

export function normalizeConv2DActivations(tensor: tf.Tensor4D): tf.Tensor4D {
  return tf.tidy(() => {
    const [, height, width, channels] = tensor.shape
    const reshapedTensor = tensor.reshape([height * width, channels])
    const min = reshapedTensor.min(0)
    const max = reshapedTensor.max(0)

    // Handle edge case where min === max
    const range = max.sub(min)
    const epsilon = tf.scalar(1e-7) // Small value to prevent division by zero
    const safeRange = range.maximum(epsilon)

    const normalizedTensor = reshapedTensor.sub(min).div(safeRange)
    return normalizedTensor.reshape([1, height, width, channels])
  })
}

export function standardize(column: number[] | undefined) {
  if (!column) return [] as number[]
  const mean = column.reduce((acc, v) => acc + v, 0) / column.length
  const stdDev = Math.sqrt(
    column.reduce((acc, v) => acc + (v - mean) ** 2, 0) / column.length
  )
  const zScaled = column.map((v) => (v - mean) / stdDev)
  return zScaled
}

export function applyStandardScaler(data: number[][]) {
  const colums = data[0].map((_, j) => data.map((row) => row[j]))
  const scaledCols = colums.map((col) => standardize(col))
  const returnData = data.map((_, i) => scaledCols.map((col) => col[i]))
  // TODO: collect and reuse means and stdDevs for test data
  return returnData
}

export function normalizeWithSign(values: number[] | undefined) {
  // returns values between -1 and 1 and keeps the sign
  if (typeof values === "undefined") return values
  if (values.length === 0) return []

  const maxAbs = Math.max(...values.map(Math.abs))

  if (maxAbs === 0) {
    return values.map(() => 0)
  }

  return values.map((v) => v / maxAbs)
}
