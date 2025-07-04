import * as tf from "@tensorflow/tfjs"

export function normalize(tensor: tf.Tensor): tf.Tensor {
  // max-abs-normalization between -1 and 1, keeps sign
  return tf.tidy(() => {
    const epsilon = tf.scalar(1e-7) // Small value to prevent division by zero
    const maxAbs = tensor.abs().max().maximum(epsilon)
    return tensor.div(maxAbs)
  })
}

export function minMaxNormalize(
  tensor: tf.Tensor,
  min: tf.Tensor,
  max: tf.Tensor
): tf.Tensor {
  // normalization between 0 and 1
  return tf.tidy(() => {
    const epsilon = tf.scalar(1e-7) // Small value to prevent division by zero
    const range = max.sub(min).maximum(epsilon)
    return tensor.sub(min).div(range)
  })
}

export function scaleNormalize(
  tensor: tf.Tensor,
  _mean?: tf.Tensor,
  _std?: tf.Tensor
) {
  // z-scale and normalize between -1 and 1
  return tf.tidy(() => {
    const mean = _mean ?? tensor.mean()
    const std = _std ?? tf.moments(tensor).variance.sqrt()
    const scaled = tensor.sub(mean).div(std)
    return normalize(scaled)
  })
}

export function channelNormalize(tensor: tf.Tensor4D): tf.Tensor4D {
  // normalize per channel, between -1 and 1
  return tf.tidy(() => {
    const [, height, width, channels] = tensor.shape
    const reshapedTensor = tensor.reshape([height * width, channels])

    const epsilon = tf.scalar(1e-7) // Small value to prevent division by zero
    const maxAbs = reshapedTensor.abs().max(0).maximum(epsilon)

    const normalizedTensor = reshapedTensor.div(maxAbs)
    return normalizedTensor.reshape([1, height, width, channels])
  })
}

export function normalizeWithSign(values: number[] | undefined) {
  // returns values between -1 and 1 and keeps the sign
  if (typeof values === "undefined") return values
  return tf.tidy(() => {
    const tensor = tf.tensor1d(values)
    const normalized = normalize(tensor)
    return normalized.arraySync() as number[]
  })
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

export function calculateRSquared(yTrue: tf.Tensor, yPred: tf.Tensor): number {
  return tf.tidy(() => {
    const yTrueMean = yTrue.mean()
    const residualSumSquares = yTrue.sub(yPred).pow(2).sum()
    const totalSumSquares = yTrue.sub(yTrueMean).pow(2).sum()
    const result = tf.scalar(1).sub(residualSumSquares.div(totalSumSquares))
    return result.dataSync()[0]
  })
}

export function round(val: number | undefined, dec = 1) {
  if (typeof val === "undefined") return
  return Math.round(val * 10 ** dec) / 10 ** dec
}

export function getMaxAbs(vals: Float32Array) {
  return vals.reduce((max, val) => Math.max(max, Math.abs(val)), 0)
}

export function centerCropResize(
  imgTensor: tf.Tensor3D,
  targetHeight: number,
  targetWidth: number
): tf.Tensor3D {
  return tf.tidy(() => {
    const [height, width, channels] = imgTensor.shape
    const cropSize = Math.min(height, width)
    const offsetHeight = Math.floor((height - cropSize) / 2)
    const offsetWidth = Math.floor((width - cropSize) / 2)

    const cropped = tf.slice(
      imgTensor,
      [offsetHeight, offsetWidth, 0],
      [cropSize, cropSize, channels]
    )

    return tf.image.resizeBilinear(cropped, [targetHeight, targetWidth])
  })
}
