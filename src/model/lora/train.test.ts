import { describe, it, expect } from "vitest"
import * as tf from "@tensorflow/tfjs"
// ESM files instead of the CJS bundle, see multi-head-attention.test.ts
import { input, model as createModel } from "@tensorflow/tfjs-layers/dist/exports"
import { activation, add, dense, embedding } from "@tensorflow/tfjs-layers/dist/exports_layers"
import type { SymbolicTensor } from "@tensorflow/tfjs-layers/dist/engine/topology"
import type { LayersModel } from "@tensorflow/tfjs-layers"
import { MultiHeadAttention } from "@/model/layers/multi-head-attention"
import { attachLora } from "./adapter"
import { makeWindows } from "./data"
import { LoraTrainer } from "./train"
import type { BatchLog, EpochLog } from "@/components/ui-elements/training-log"

const vocabSize = 7
const seqLen = 8
const PAD = 0

// tiny causal language model: embedding -> self-attention (causal) + residual -> logits -> softmax
function createLanguageModel({ softmax = true } = {}) {
  const inp = input({ shape: [seqLen], dtype: "int32" })
  const x = embedding({ inputDim: vocabSize, outputDim: 8 }).apply(inp) as SymbolicTensor
  const mha = MultiHeadAttention.constructorFunc({ numHeads: 2, keyDim: 4 })
  const attn = mha.apply([x, x], { useCausalMask: true }) as SymbolicTensor
  const res = add().apply([x, attn]) as SymbolicTensor
  const logits = dense({ units: vocabSize }).apply(res) as SymbolicTensor
  const out = softmax
    ? (activation({ activation: "softmax" }).apply(logits) as SymbolicTensor)
    : logits
  return createModel({ inputs: inp, outputs: out }) as unknown as LayersModel
}

// a repeating pattern that the model can learn
const tokens = Array.from({ length: 120 }, (_, i) => 1 + (i % 6))
const windows = makeWindows(tokens, seqLen, PAD)

function setup(learningRate = 1e-3) {
  const model = createLanguageModel()
  const adapter = attachLora(model, { rank: 4, alpha: 8, targets: ["qkv", "output"] })
  const trainer = new LoraTrainer(model, adapter, learningRate)
  const cleanup = () => {
    trainer.dispose()
    adapter.detach()
  }
  return { model, adapter, trainer, cleanup }
}

describe("LoraTrainer", () => {
  it("computes the mean cross-entropy of the unmasked targets", () => {
    const { model, trainer, cleanup } = setup()
    const batch = makeWindows([1, 2, 3, 4, 5], seqLen, PAD) // 4 targets, 4 masked
    const probs = (
      model.predict(tf.tensor2d([[...batch[0].x]], [1, seqLen], "int32")) as tf.Tensor
    ).arraySync() as number[][][]
    const expected =
      -[1, 2, 3, 4].map((pos) => Math.log(probs[0][pos - 1][pos + 1])).reduce((a, b) => a + b) / 4
    expect(trainer.loss(batch).dataSync()[0]).toBeCloseTo(expected, 5)

    // masked targets don't count
    const changed = batch.map((w) => ({ ...w, y: w.y.map((t, i) => (w.mask[i] ? t : 6)) }))
    expect(trainer.loss(changed).dataSync()[0]).toBeCloseTo(expected, 6)
    cleanup()
  })

  it("trains the adapter: lower loss, frozen base weights, logs per batch and epoch", async () => {
    const { model, trainer, cleanup } = setup(5e-2)
    const baseWeights = model.getWeights().map((w) => w.clone())
    const before = await trainer.evaluate(windows, 4)
    const batchLogs: BatchLog[] = []
    const epochLogs: EpochLog[] = []
    const result = await trainer.train(
      windows,
      { epochs: 20, batchSize: 4, validationSplit: 0.2 },
      {
        onBatchEnd: (log) => void batchLogs.push(log),
        onEpochEnd: (log) => void epochLogs.push(log),
      },
    )
    const after = await trainer.evaluate(windows, 4)
    expect(after).toBeLessThan(before * 0.5) // 0.3 at most in 8 runs
    for (const [i, w] of model.getWeights().entries()) {
      expect(w.sub(baseWeights[i]).abs().max().dataSync()[0]).toBe(0)
    }

    // 15 windows: 12 for training (3 batches of 4), 3 for validation
    expect(result).toEqual({ epochs: 20, steps: 60, stopped: false })
    expect(batchLogs).toHaveLength(60)
    expect(batchLogs[0]).toMatchObject({ epoch: 0, batch: 0, size: 4 })
    expect(epochLogs.map((l) => l.epoch)).toEqual(Array.from({ length: 20 }, (_, i) => i))
    expect(
      epochLogs.every((l) => typeof l.loss === "number" && typeof l.val_loss === "number"),
    ).toBe(true)
    cleanup()
  })

  it("stops, continues the epoch count and doesn't leak tensors", async () => {
    const { trainer, cleanup } = setup()
    const config = { epochs: 2, batchSize: 4, validationSplit: 0 }
    const stopped = await trainer.train(windows, config, { shouldStop: () => true })
    expect(stopped).toEqual({ epochs: 0, steps: 1, stopped: true })

    const numTensors = tf.memory().numTensors // after the 1st step: incl. the optimizer state
    const epochs: number[] = []
    await trainer.train(
      windows,
      { ...config, initialEpoch: 3 },
      { onEpochEnd: (l) => void epochs.push(l.epoch) },
    )
    expect(epochs).toEqual([3, 4])
    expect(tf.memory().numTensors).toBe(numTensors)
    cleanup()
  })

  it("starts a new optimizer for a new learning rate", async () => {
    const { trainer, cleanup } = setup()
    await trainer.step(windows.slice(0, 2))
    const numTensors = tf.memory().numTensors
    trainer.learningRate = 1e-2
    expect(trainer.learningRate).toBe(1e-2)
    expect(tf.memory().numTensors).toBeLessThan(numTensors) // Adam state of the old optimizer disposed
    cleanup()
  })

  it("throws for a disabled adapter, longer sequences and models without softmax output", async () => {
    const { adapter, trainer, cleanup } = setup()
    adapter.setEnabled(false)
    await expect(trainer.step(windows.slice(0, 1))).rejects.toThrow("enabled")
    adapter.setEnabled(true)
    await expect(trainer.step(makeWindows(tokens, seqLen * 2, PAD))).rejects.toThrow(
      "sequence length",
    )
    await expect(
      trainer.train([], { epochs: 1, batchSize: 1, validationSplit: 0 }),
    ).rejects.toThrow("no training data")
    cleanup()

    const model = createLanguageModel({ softmax: false })
    const other = attachLora(model)
    expect(() => new LoraTrainer(model, other)).toThrow("softmax")
    other.detach()
  })
})
