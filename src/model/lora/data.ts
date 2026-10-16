import * as tf from "@tensorflow/tfjs"
import type { TokenizerType } from "@/data/tokenizer"

// Training data for next token prediction from a text: windows of seqLen + 1 tokens, the inputs are the first
// seqLen tokens, the targets the same shifted by one. The last window is padded, padded targets are masked out
// of the loss (otherwise the model would learn to predict padding after padding).

export interface TokenWindow {
  x: Int32Array // [seqLen]
  y: Int32Array // [seqLen]: next token at each position
  mask: Float32Array // [seqLen]: 1 for real targets, 0 for padding
}

export interface TokenBatch {
  xs: tf.Tensor2D // [batch, seqLen] int32
  ys: tf.Tensor1D // [batch * seqLen] int32
  mask: tf.Tensor1D // [batch * seqLen]
}

// <START> text <END>, e.g. <|endoftext|> text <|endoftext|> for GPT-2 (encode adds <START>)
export function textToTokens(text: string, tokenizer: TokenizerType) {
  const end = tokenizer.encodeDict["<END>"]
  if (end === undefined) throw new Error("Tokenizer without <END> token")
  return Int32Array.from([...tokenizer.encode(text), end])
}

// windows with a stride of seqLen: the last token of a window is the first input of the next one
export function makeWindows(tokens: ArrayLike<number>, seqLen: number, padToken: number) {
  const all = Int32Array.from(tokens)
  const windows: TokenWindow[] = []
  for (let start = 0; start < all.length - 1; start += seqLen) {
    const chunk = all.subarray(start, start + seqLen + 1)
    const numTargets = chunk.length - 1
    const x = new Int32Array(seqLen).fill(padToken)
    const y = new Int32Array(seqLen).fill(padToken)
    const mask = new Float32Array(seqLen)
    x.set(chunk.slice(0, numTargets))
    y.set(chunk.slice(1))
    mask.fill(1, 0, numTargets)
    windows.push({ x, y, mask })
  }
  return windows
}

// last windows for validation, none if the split would be less than one window
export function splitWindows(windows: TokenWindow[], validationSplit: number) {
  const numValidation = Math.floor(windows.length * validationSplit)
  const numTrain = windows.length - numValidation
  return { train: windows.slice(0, numTrain), validation: windows.slice(numTrain) }
}

export function shuffle<T>(items: T[], random = Math.random) {
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function getBatches<T>(windows: T[], batchSize: number) {
  return Array.from({ length: Math.ceil(windows.length / batchSize) }, (_, i) =>
    windows.slice(i * batchSize, (i + 1) * batchSize),
  )
}

export function toTensors(windows: TokenWindow[]): TokenBatch {
  const seqLen = windows[0].x.length
  const concat = <T extends Int32Array | Float32Array>(
    arrays: T[],
    ArrayType: new (n: number) => T,
  ) => {
    const result = new ArrayType(arrays.length * seqLen)
    arrays.forEach((arr, i) => result.set(arr, i * seqLen))
    return result
  }
  return {
    xs: tf.tensor2d(
      concat(
        windows.map((w) => w.x),
        Int32Array,
      ),
      [windows.length, seqLen],
      "int32",
    ),
    ys: tf.tensor1d(
      concat(
        windows.map((w) => w.y),
        Int32Array,
      ),
      "int32",
    ),
    mask: tf.tensor1d(
      concat(
        windows.map((w) => w.mask),
        Float32Array,
      ),
    ),
  }
}
