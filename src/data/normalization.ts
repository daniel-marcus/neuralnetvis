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

export class StandardScaler {
  private mean: tf.Tensor | null = null
  private std: tf.Tensor | null = null

  fit(tensor: tf.Tensor): void {
    const { mean, variance } = tf.moments(tensor, 0)
    this.mean = mean
    this.std = variance.sqrt().add(1e-7)
  }

  transform(tensor: tf.Tensor): tf.Tensor {
    if (this.mean === null || this.std === null) {
      throw new Error("Scaler has not been fitted. Call fit() first.")
    }
    // returns z-scaled values
    return tensor.sub(this.mean).div(this.std)
  }

  fitTransform(tensor: tf.Tensor): tf.Tensor {
    this.fit(tensor)
    return this.transform(tensor)
  }
}
