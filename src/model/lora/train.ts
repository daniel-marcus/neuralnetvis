import * as tf from "@tensorflow/tfjs"
// ESM: same Container/SymbolicTensor classes as the model's layers (also in tests, see multi-head-attention.test.ts)
import { model as createModel } from "@tensorflow/tfjs-layers/dist/exports"
import type { LayersModel } from "@tensorflow/tfjs-layers"
import type { SymbolicTensor } from "@tensorflow/tfjs-layers/dist/engine/topology"
import { getTokenBatches, shuffle, splitWindows, toTensors } from "./data"
import type { TokenBatch, TokenWindow } from "./data"
import type { LoraAdapter } from "./adapter"
import type { BatchLog, EpochLog } from "@/components/ui-elements/training-log"

// Training loop for LoRA adapters (instead of model.fit): the loss is computed on the logits with a mask for
// padded targets, only the adapter weights are trained (gradients only for them, not for the frozen model).

export interface LoraTrainConfig {
  epochs: number
  batchSize: number // max. windows per batch
  maxTokens?: number // max. positions per batch (windows x longest window), limits the GPU memory per step
  validationSplit: number
  initialEpoch?: number // to continue the epoch count of previous runs
  random?: () => number // for shuffling
}

export interface LoraTrainCallbacks {
  onEpochBegin?: (epoch: number, numBatches: number) => void | Promise<void>
  onBatchEnd?: (log: BatchLog) => void | Promise<void>
  onEpochEnd?: (log: EpochLog) => void | Promise<void>
  shouldStop?: () => boolean // checked after each batch
}

export class LoraTrainer {
  private readonly logitsModel: LayersModel
  private optimizer: tf.Optimizer
  private _learningRate: number
  readonly seqLen?: number // max. sequence length of the model (null: variable)

  constructor(
    model: LayersModel,
    private readonly adapter: LoraAdapter,
    learningRate = 1e-3,
  ) {
    this.logitsModel = getLogitsModel(model)
    this.seqLen = (model.inputs[0].shape[1] as number | null) ?? undefined
    this._learningRate = learningRate
    this.optimizer = tf.train.adam(learningRate)
  }

  get learningRate() {
    return this._learningRate
  }

  // the Adam state (moments) is kept across train() calls, a new learning rate starts a new optimizer
  set learningRate(learningRate: number) {
    if (learningRate === this._learningRate) return
    this.optimizer.dispose()
    this.optimizer = tf.train.adam(learningRate)
    this._learningRate = learningRate
  }

  // mean loss of the unmasked targets in the batch
  loss(windows: TokenWindow[]) {
    const batch = toTensors(windows)
    try {
      return this.computeLoss(batch, false)
    } finally {
      tf.dispose(Object.values(batch))
    }
  }

  // one optimizer step, returns the loss of the batch (before the step)
  async step(windows: TokenWindow[]) {
    this.checkAdapter(windows)
    const batch = toTensors(windows) // disposed after the step: the mask is needed for the gradients
    let cost: tf.Scalar | null = null
    try {
      cost = this.optimizer.minimize(() => this.computeLoss(batch, true), true, this.adapter.vars)
      const [loss] = await cost!.data() // waits for the GPU
      return loss
    } finally {
      tf.dispose([...Object.values(batch), ...(cost ? [cost] : [])])
    }
  }

  // mean loss of all unmasked targets (weighted by the number of targets per batch)
  async evaluate(windows: TokenWindow[], batchSize: number, maxTokens?: number) {
    let lossSum = 0
    let numTargets = 0
    for (const batch of getTokenBatches(windows, batchSize, maxTokens)) {
      const loss = this.loss(batch)
      const [value] = await loss.data()
      loss.dispose()
      const count = batch.reduce((n, w) => n + w.mask.reduce((a, b) => a + b, 0), 0)
      lossSum += value * count
      numTargets += count
    }
    return numTargets ? lossSum / numTargets : NaN
  }

  async train(windows: TokenWindow[], config: LoraTrainConfig, callbacks: LoraTrainCallbacks = {}) {
    const { epochs, batchSize, maxTokens, validationSplit, initialEpoch = 0, random } = config
    const { onEpochBegin, onBatchEnd, onEpochEnd, shouldStop } = callbacks
    const { train, validation } = splitWindows(windows, validationSplit)
    if (!train.length) throw new Error("LoRA: no training data")
    let steps = 0
    for (let epoch = initialEpoch; epoch < initialEpoch + epochs; epoch++) {
      const batches = getTokenBatches(shuffle(train, random), batchSize, maxTokens)
      await onEpochBegin?.(epoch, batches.length)
      let lossSum = 0
      for (const [batchIdx, batch] of batches.entries()) {
        const loss = await this.step(batch)
        lossSum += loss
        steps++
        await onBatchEnd?.({ epoch, batch: batchIdx, size: batch.length, loss })
        await tf.nextFrame() // keep the UI responsive
        if (shouldStop?.()) return { epochs: epoch - initialEpoch, steps, stopped: true }
      }
      const loss = lossSum / batches.length
      // no val_loss key without validation data (the logs plot shows a metric for each key)
      const val_loss = validation.length
        ? await this.evaluate(validation, batchSize, maxTokens)
        : undefined
      await onEpochEnd?.({ epoch, loss, ...(val_loss !== undefined && { val_loss }) })
    }
    return { epochs, steps, stopped: false }
  }

  dispose() {
    this.optimizer.dispose() // not the logits model: it shares the layers (and weights) with the model
  }

  private computeLoss({ xs, ys, mask }: TokenBatch, training: boolean) {
    return tf.tidy(() => {
      const logits = this.logitsModel.apply(xs, { training }) as tf.Tensor // [batch, seqLen, vocab]
      const vocabSize = logits.shape[logits.rank - 1]!
      // one-hot labels: softmaxCrossEntropy has a fused gradient (softmax - labels), gather with batchDims
      // would compute the gradient with one unsortedSegmentSum per position
      const labels = tf.oneHot(ys, vocabSize).cast("float32")
      const flat = logits.reshape([-1, vocabSize])
      const reduction = tf.Reduction.SUM_BY_NONZERO_WEIGHTS
      return tf.losses.softmaxCrossEntropy(labels, flat, mask, 0, reduction) as tf.Scalar
    })
  }

  private checkAdapter(windows: TokenWindow[]) {
    if (this.adapter.isDetached || !this.adapter.enabled) {
      throw new Error("LoRA: the adapter must be enabled for training")
    }
    const seqLen = windows[0]?.x.length ?? 0
    if (this.seqLen && seqLen > this.seqLen) {
      throw new Error(`LoRA: sequence length ${seqLen} > ${this.seqLen} of the model`)
    }
  }
}

// model with the logits as output: input of the softmax output layer (e.g. added in import-keras.ts)
function getLogitsModel(model: LayersModel) {
  const outputLayer = model.outputs[0].sourceLayer
  const isSoftmax =
    outputLayer.getClassName() === "Activation" && outputLayer.getConfig().activation === "softmax"
  if (model.outputs.length !== 1 || !isSoftmax) {
    throw new Error("LoRA: the model needs a softmax output layer")
  }
  const logits = outputLayer.input as SymbolicTensor
  return createModel({ inputs: model.inputs, outputs: logits }) as unknown as LayersModel
}
