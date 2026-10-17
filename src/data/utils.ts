import * as tf from "@tensorflow/tfjs"

export function normalize(tensor: tf.Tensor): tf.Tensor {
  // max-abs-normalization between -1 and 1, keeps sign
  return tf.tidy(() => {
    const epsilon = tf.scalar(1e-7) // Small value to prevent division by zero
    const maxAbs = tensor.abs().max().maximum(epsilon)
    return tensor.div(maxAbs)
  })
}

// sequences of token models (e.g. GPT-2: huge activations at the first token and in a few feature dimensions):
// scaled by the mean absolute value of the text's positions (hardly affected by a few large values) and compressed
// to [-1, 1] with tanh, so that the outliers saturate instead of washing out all other activations
export function normalizeSequence(tensor: tf.Tensor, numPositions: number): tf.Tensor {
  return tf.tidy(() => {
    // numPositions: the text's tokens, the padding after them is left out of the scale. It contains zeros
    // (incremental activations) or activations of padding tokens (full forward pass), which would make the
    // scale depend on the length of the text
    const text = tensor.slice([0, 0], [-1, numPositions]) // [B, numPositions, D]
    const scale = text.abs().mean().mul(SEQUENCE_CONTRAST).maximum(1e-7)
    return tensor.div(scale).tanh()
  })
}
const SEQUENCE_CONTRAST = 8 // tanh(x / (8 * mean|x|)): average activations at ~1/8 of the color range

export function scaleNormalize(tensor: tf.Tensor, _mean?: tf.Tensor, _std?: tf.Tensor) {
  // z-scale and normalize between -1 and 1
  return tf.tidy(() => {
    const mean = _mean ?? tensor.mean()
    const std = _std ?? tf.moments(tensor).variance.sqrt()
    const scaled = tensor.sub(mean).div(std)
    return normalize(scaled)
  })
}

export function normalizeWithSign(values: number[] | undefined) {
  // returns values between -1 and 1 and keeps the sign, as normalize (plain JS: no GPU round trip)
  if (typeof values === "undefined") return values
  let maxAbs = 1e-7 // prevents division by zero
  for (const v of values) if (Math.abs(v) > maxAbs) maxAbs = Math.abs(v) // NaN is skipped
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

export function round(val: number | undefined, dec = 1) {
  if (typeof val === "undefined") return
  return Math.round(val * 10 ** dec) / 10 ** dec
}

export function centerCropResize(
  imgTensor: tf.Tensor3D,
  targetHeight: number,
  targetWidth: number,
): tf.Tensor3D {
  return tf.tidy(() => {
    const [height, width, channels] = imgTensor.shape
    const cropSize = Math.min(height, width)
    const offsetHeight = Math.floor((height - cropSize) / 2)
    const offsetWidth = Math.floor((width - cropSize) / 2)

    const cropped = tf.slice(
      imgTensor,
      [offsetHeight, offsetWidth, 0],
      [cropSize, cropSize, channels],
    )

    return tf.image.resizeBilinear(cropped, [targetHeight, targetWidth])
  })
}
