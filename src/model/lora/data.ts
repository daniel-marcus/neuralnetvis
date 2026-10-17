import * as tf from "@tensorflow/tfjs"
import { getAll } from "@/data/db"
import { getSeqPosition } from "@/data/next-token"
import type { TokenizerType } from "@/data/tokenizer"
import type { Dataset, DbBatch } from "@/data/types"

// Training data for next token prediction from texts: windows of seqLen + 1 tokens, the inputs are the first
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

// number of positions up to the last target (the rest is padding, trimmed in toTensors)
export function getWindowLength(window: TokenWindow) {
  return window.mask.findLastIndex((m) => m > 0) + 1
}

// batches of up to maxBatchSize windows with at most maxTokens positions (windows x longest window): the GPU
// memory of a training step grows with the number of positions, a window longer than maxTokens gets its own batch
export function getTokenBatches(
  windows: TokenWindow[],
  maxBatchSize: number,
  maxTokens = Infinity,
) {
  const batches: TokenWindow[][] = []
  let batch: TokenWindow[] = []
  let maxLength = 0
  for (const window of windows) {
    const length = Math.max(maxLength, getWindowLength(window))
    const fits = batch.length < maxBatchSize && (batch.length + 1) * length <= maxTokens
    if (batch.length && !fits) {
      batches.push(batch)
      batch = []
      maxLength = 0
    }
    batch.push(window)
    maxLength = Math.max(maxLength, getWindowLength(window))
  }
  if (batch.length) batches.push(batch)
  return batches
}

// trimmed to the longest window of the batch: the positions after it are padding without targets, in a causal
// model they don't change the outputs at the earlier positions (batches of short samples are much cheaper)
export function toTensors(windows: TokenWindow[]): TokenBatch {
  const length = Math.max(1, ...windows.map(getWindowLength))
  const concat = <T extends Int32Array | Float32Array>(
    arrays: T[],
    ArrayType: new (n: number) => T,
  ) => {
    const result = new ArrayType(arrays.length * length)
    arrays.forEach((arr, i) => result.set(arr.subarray(0, length), i * length))
    return result
  }
  return {
    xs: tf.tensor2d(
      concat(
        windows.map((w) => w.x),
        Int32Array,
      ),
      [windows.length, length],
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

// sample of a nextToken dataset (tokens as in the input area, padded) -> <START> text <END>.
// A sample that fills the whole window is continued by the next one (long texts, see getTextSamples): no <END>
export function sampleToTokens(X: ArrayLike<number>, tokenizer: TokenizerType) {
  const end = tokenizer.encodeDict["<END>"]
  const length = getSeqPosition(X, tokenizer) + 1 // up to the last token of the text
  const tokens = Array.from(X).slice(0, length)
  return Int32Array.from(length < X.length ? [...tokens, end] : tokens)
}

// the train samples of the dataset (e.g. texts saved in the input area), one window per sample
export async function loadTrainingWindows(ds: Dataset) {
  const { tokenizer } = ds
  if (!tokenizer) throw new Error("LoRA: dataset without tokenizer")
  const [seqLen] = ds.inputDims
  const pad = tokenizer.encodeDict["<PAD>"]
  const batches = await getAll<DbBatch>(ds.key, "train")
  const samples = batches
    .flatMap((b) => getBatches(Array.from(b.xs), seqLen))
    .slice(0, ds.train.totalSamples)
  return samples.flatMap((X) => makeWindows(sampleToTokens(X, tokenizer), seqLen, pad))
}
