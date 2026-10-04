import * as tf from "@tensorflow/tfjs"
import { getSeqPosition } from "@/data/next-token"
import type { TokenizerType } from "@/data/tokenizer"

const EPS = 1e-6

/**
 * Text classification: impact of each input token on the predicted class, by occlusion. Each visible token
 * is replaced by <OOV> (1 batched forward pass), impact = drop in the log-odds of the predicted class.
 * Log-odds instead of probabilities, because a confident prediction (p ≈ 1) barely changes in probability.
 * Returns [1, seqLen] in [-1, 1] (relative to the token with the largest impact):
 * positive = token supports the predicted class, negative = argues against it, padding = 0
 */
export function getTokenAttribution(
  model: tf.LayersModel,
  xTensor: tf.Tensor,
  tokens: ArrayLike<number>,
  tokenizer: TokenizerType,
) {
  const seqLen = xTensor.shape[1]!
  const numVisible = getSeqPosition(tokens, tokenizer) + 1
  const { "<OOV>": oov, "<PAD>": pad = 0 } = tokenizer.encodeDict
  return tf.tidy(() => {
    const mask = tf.oneHot(tf.range(0, numVisible, 1, "int32"), seqLen).cast("bool")
    const replacement = tf.fill(mask.shape, oov ?? pad, xTensor.dtype)
    const occluded = tf.where(mask, replacement, xTensor.tile([numVisible, 1]))
    const batch = tf.concat([xTensor, occluded]) // 1st row: original sample
    const probs = toClassProbs(model.predict(batch) as tf.Tensor) // [1 + numVisible, classes]
    const predicted = probs.slice([0, 0], [1, -1]).argMax(1)
    const p = probs
      .gather(predicted, 1)
      .reshape([-1])
      .clipByValue(EPS, 1 - EPS)
    const logOdds = p.log().sub(tf.scalar(1).sub(p).log())
    const impact = logOdds.slice(0, 1).sub(logOdds.slice(1)) // original - occluded
    const normalized = impact.div(impact.abs().max().maximum(EPS))
    return normalized.pad([[0, seqLen - numVisible]]).reshape([1, seqLen])
  })
}

// sigmoid output (1 unit) -> 2 classes
function toClassProbs(probs: tf.Tensor) {
  return probs.shape[1] === 1 ? tf.concat([tf.scalar(1).sub(probs), probs], 1) : probs
}
