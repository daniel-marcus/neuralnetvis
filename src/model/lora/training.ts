import { useEffect } from "react"
import * as tf from "@tensorflow/tfjs"
import throttle from "lodash.throttle"
import { getScene, setStatus, useSceneStore } from "@/store"
import { attachLora, type LoraAdapter } from "./adapter"
import { exportPeft, importPeft, PEFT_CONFIG_FILE, PEFT_WEIGHTS_FILE } from "./peft"
import { loadTrainingWindows } from "./data"
import { LoraTrainer } from "./train"
import type { LayersModel } from "@tensorflow/tfjs-layers"
import type { Dataset } from "@/data/types"
import type { TrainingConfig } from "@/model/types"
import type { LoraState } from "@/store/model"

// LoRA training in the scene (see useTraining): the adapter is attached on the first training run and stays
// until the model changes or the training is reset, the logs and counts go to the training store as for
// model.fit (logs plot, progress)

export const MAX_LORA_BATCH_SIZE = 4
// GPU memory of a training step grows with the number of positions (GPT-2: ~4.5 GB above the model for 256),
// longer batches are split (tfjs shares the GPU device with three.js: out of memory loses both)
export const MAX_LORA_TOKENS_PER_STEP = 256

const LORA_TRAIN_CONFIG: Partial<TrainingConfig> = {
  batchSize: 2,
  epochs: 10,
  validationSplit: 0,
  learningRate: 1e-3,
}

const STATUS_ID = "training_progress"

export function isLoraDs(ds?: Dataset) {
  return !!ds?.loraTraining
}

export function canTrainLora() {
  return tf.getBackend() === "webgpu" // too slow on the other backends
}

// disposes the adapter when it's replaced (new model, reset), sets the default config for LoRA datasets
export function useLora(ds?: Dataset) {
  const lora = useSceneStore((s) => s.lora)
  useEffect(() => {
    if (!lora) return
    return () => {
      lora.trainer.dispose()
      lora.adapter.detach()
    }
  }, [lora])

  const setTrainConfig = useSceneStore((s) => s.setTrainConfig)
  const isLora = isLoraDs(ds)
  useEffect(() => {
    if (isLora) setTrainConfig(LORA_TRAIN_CONFIG)
  }, [isLora, setTrainConfig])
}

function getOrCreateLora(model: LayersModel, learningRate: number): LoraState {
  const scene = getScene().getState()
  if (scene.lora) return scene.lora
  const adapter = attachLora(model)
  const lora = { adapter, trainer: new LoraTrainer(model, adapter, learningRate) }
  scene.setLora(lora)
  return lora
}

// PEFT files of the adapter (see peft.ts), base model: Hugging Face repo of the model
export async function exportLora(adapter: LoraAdapter, ds?: Dataset) {
  const baseModel = ds?.model?.sourceUrl?.match(/^https:\/\/huggingface\.co\/(.+)$/)?.[1]
  const { weights, config } = await exportPeft(adapter, baseModel)
  return [
    new File([weights], PEFT_WEIGHTS_FILE),
    new File([JSON.stringify(config, null, 2)], PEFT_CONFIG_FILE, { type: "application/json" }),
  ]
}

// replaces the current adapter (kept if the import fails), the training starts again (new optimizer and logs)
export async function importLora(model: LayersModel, files: File[]) {
  const weightsFile = files.find((f) => f.name.endsWith(".safetensors"))
  const configFile = files.find((f) => f.name.endsWith(".json"))
  if (!weightsFile || !configFile) {
    throw new Error(`Select ${PEFT_WEIGHTS_FILE} and ${PEFT_CONFIG_FILE}`)
  }
  const [buffer, config] = await Promise.all([
    weightsFile.arrayBuffer(),
    configFile.text().then(JSON.parse),
  ])
  const scene = getScene().getState()
  if (scene.isTraining) throw new Error("Stop the training first")
  const old = scene.lora?.adapter
  const wasEnabled = !!old?.enabled
  if (wasEnabled) old!.setEnabled(false) // the projections can only have one adapter
  let adapter: LoraAdapter | undefined
  try {
    adapter = importPeft(model, buffer, config)
    const trainer = new LoraTrainer(model, adapter, scene.trainConfig.learningRate)
    scene.setLora({ adapter, trainer }) // the old one is disposed in useLora
  } catch (e) {
    adapter?.detach()
    if (wasEnabled) old!.setEnabled(true)
    throw e
  }
  scene.resetTrainCounts()
}

export async function trainLora(
  model: LayersModel,
  ds: Dataset,
  config: TrainingConfig,
  initialEpoch: number,
  isCancelled: () => boolean,
) {
  const scene = getScene()
  if (!canTrainLora()) {
    setStatus("LoRA training needs WebGPU", null, { id: STATUS_ID })
    return scene.setState({ isTraining: false })
  }
  const windows = await loadTrainingWindows(ds)
  if (!windows.length) {
    setStatus("No training samples yet", null, { id: STATUS_ID })
    return scene.setState({ isTraining: false })
  }

  const { adapter, trainer } = getOrCreateLora(model, config.learningRate)
  trainer.learningRate = config.learningRate
  if (!adapter.enabled) adapter.setEnabled(true) // trains the fine-tuned model
  scene.getState().bumpAdapterVersion()

  const { epochs, validationSplit } = config
  const batchSize = Math.min(config.batchSize, MAX_LORA_BATCH_SIZE)
  const maxTokens = MAX_LORA_TOKENS_PER_STEP
  let batchesPerEpoch = 1
  const updateStatus = throttle(setStatus, 30)
  const startTime = Date.now()

  const result = await trainer.train(
    windows,
    { epochs, batchSize, maxTokens, validationSplit, initialEpoch },
    {
      onEpochBegin: (_, numBatches) => {
        batchesPerEpoch = numBatches
      },
      onBatchEnd: (log) => {
        const state = scene.getState()
        state.addLog(log)
        state.setBatchCount((c) => c + 1)
        const epochsDone = log.epoch - initialEpoch + (log.batch + 1) / batchesPerEpoch
        const data = {
          Epoch: `${log.epoch + 1}/${initialEpoch + epochs}`,
          Batch: `${log.batch + 1}/${batchesPerEpoch}`,
          Loss: log.loss?.toFixed(3),
        }
        updateStatus({ title: "Training (LoRA) ...", data }, epochsDone / epochs, { id: STATUS_ID })
      },
      onEpochEnd: (log) => {
        const state = scene.getState()
        state.addLog(log)
        state.setEpochCount(log.epoch + 1)
        state.bumpAdapterVersion() // updates the predictions (e.g. next word suggestions)
      },
      shouldStop: () => isCancelled() || !scene.getState().isTraining,
    },
  )
  updateStatus.cancel()

  const lastLog = scene.getState().epochLogs.at(-1)
  const data = {
    Loss: lastLog?.loss?.toFixed(3),
    "Val. loss": lastLog?.val_loss?.toFixed(3),
    Time: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
  }
  setStatus({ title: "Training finished (LoRA)", data }, null, { id: STATUS_ID })
  if (!result.stopped) scene.setState({ isTraining: false })
  scene.getState().bumpAdapterVersion()
}
