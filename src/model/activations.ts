import { useCallback, useEffect, useRef } from "react"
import * as tf from "@tensorflow/tfjs"
import { useThree } from "@react-three/fiber"
import { useSample, type Sample } from "@/data"
import { useSceneStore, isDebug } from "@/store"
import { type ActivationStats, useActivationStats } from "./activation-stats"
import { getLayerActivationsAsync, getSingleOutput } from "./get-layer-activations"
import { isWebGPUBackend, useBackend } from "@/utils/webgpu"
import { normalize, scaleNormalize } from "@/data/utils"
import { getSeqPosition } from "@/data/next-token"
import { getTokenAttribution } from "./token-attribution"
import type Backend from "three/src/renderers/common/Backend.js"
import type { NeuronLayer } from "@/neuron-layers"
import type { LayerActivations } from "./types"
import type { TokenizerType } from "@/data/tokenizer"
import type { Dataset } from "@/data/types"
import type { UserData } from "@/scene-views/3d-model/layer-instanced"

type UpdateTracker = Map<Sample["index"], Set<NeuronLayer["lid"]>>

export function ActivationUpdater({ layers }: { layers: NeuronLayer[] }) {
  const currSample = useSample()
  const model = useSceneStore((s) => s.model)
  const stats = useActivationStats()
  const setActivations = useSceneStore((s) => s.setActivations)
  const currFocusIdx = useFlatViewFocussed()
  const invalidate = useThree((s) => s.invalidate)
  const backend = useBackend()
  const hasRendered = useSceneStore((s) => s.hasRendered)
  const isRegression = useSceneStore((s) => s.isRegression())
  const ds = useSceneStore((s) => s.ds)

  // keep track which layers already show the current sample
  const updateTracker = useRef<UpdateTracker>(new Map())
  const latestSampleIdx = useRef<Sample["index"]>(-1)

  const maybeUpdate = useCallback(
    async (sample?: Sample, focusIdx?: number) => {
      if (!model || !sample) return
      latestSampleIdx.current = sample.index

      const updatedLayers = updateTracker.current.get(sample.index) ?? new Set()
      const needsUpdate = (l: NeuronLayer) => !updatedLayers.has(l.lid)
      // nextToken: the next word suggestions (TextArea) need the output layer even if another layer is focussed
      const keepOutput = ds?.task === "nextToken"
      const isFocussed = (l: NeuronLayer) =>
        l.index === focusIdx || (keepOutput && l.layerPos === "output")
      const layersToUpdate =
        typeof focusIdx === "number"
          ? layers.filter((l) => isFocussed(l) && needsUpdate(l))
          : layers.filter(needsUpdate)

      if (!layersToUpdate.length) return

      const seqPos = ds?.task === "nextToken" ? getSeqPosition(sample.X, ds.tokenizer) : undefined
      const tokenInput = ds?.tokenizer ? { tokenizer: ds.tokenizer, task: ds.task } : undefined
      const isStale = () => latestSampleIdx.current !== sample.index // model changed (see reset below)

      const t0 = performance.now()
      // let lastYield = t0

      const LAYERS_PER_BATCH = 500 // TODO: tune for large models
      for (let i = 0; i < layersToUpdate.length; i += LAYERS_PER_BATCH) {
        if (latestSampleIdx.current !== sample.index) return // abort if sample changed already
        const layersBatch = layersToUpdate.slice(i, i + LAYERS_PER_BATCH)
        const newActivations = await getActivations(
          backend,
          model,
          layersBatch,
          sample,
          isRegression,
          stats,
          seqPos,
          tokenInput,
          isStale,
        )
        if (!newActivations) return // aborted
        setActivations(newActivations)
        invalidate()
        // await new Promise((r) => setTimeout(r, 0)) // yield to avoid blocking
      }
      const dt = performance.now() - t0
      if (isDebug()) console.log(`>> total: ${dt}ms (${layersToUpdate.length})`)

      const newUpdated = new Set(updatedLayers)
      layersToUpdate.forEach((l) => newUpdated.add(l.lid))
      updateTracker.current = new Map()
      updateTracker.current.set(sample.index, newUpdated)
    },
    [backend, model, layers, invalidate, setActivations, isRegression, stats, ds],
  )

  // reset update tracker when model changes
  useEffect(() => {
    return () => {
      updateTracker.current.clear()
      latestSampleIdx.current = -1
    }
  }, [maybeUpdate])

  // At most one update at a time: requests in the meantime replace each other, only the latest one runs
  // afterwards. Otherwise fast input (typing, autocomplete) queues up forward passes that block the
  // main thread and compete with rendering on the GPU.
  const queue = useRef<{ isRunning: boolean; next?: () => Promise<void> }>({ isRunning: false })
  const requestUpdate = useCallback(
    async (sample?: Sample, focusIdx?: number) => {
      const q = queue.current
      q.next = () => maybeUpdate(sample, focusIdx) // with the current model
      if (q.isRunning) return
      q.isRunning = true
      try {
        while (q.next) {
          const update = q.next
          q.next = undefined
          await update().catch((e) => console.error("Error updating activations", e))
        }
      } finally {
        q.isRunning = false
      }
    },
    [maybeUpdate],
  )

  useEffect(() => {
    if (!hasRendered) return // make sure scene has rendered at least once for activation buffer binding
    requestUpdate(currSample, currFocusIdx)
  }, [currSample, currFocusIdx, requestUpdate, hasRendered])

  return null
}

function useFlatViewFocussed() {
  // avoid updates during scrolling when focusIdx changes often
  const focusIdx = useSceneStore((s) => s.focussedLayerIdx)
  const isFlatView = useSceneStore((s) => s.vis.flatView)
  return isFlatView ? focusIdx : undefined
}

export function useLayerActivations(layerIdx: number) {
  return useSceneStore((s) => s.activations[layerIdx])
}

export function useActivation(layerIdx: number, neuronIdx: number) {
  return useSceneStore((s) => s.activations[layerIdx]?.activations?.[neuronIdx])
}

async function getActivations(
  backend: Backend,
  model: tf.LayersModel,
  layers: NeuronLayer[],
  sample: Sample,
  isRegression?: boolean,
  stats?: { [layerIdx: number]: ActivationStats | undefined },
  seqPos?: number, // nextToken: show only the output at this position
  tokenInput?: TokenInput, // input layer colors for tokenizer datasets, see getTokenInputColors
  shouldAbort?: () => boolean,
) {
  const tfBackend = tf.getBackend()
  const outputs = layers.map(({ tfLayer }) => getSingleOutput(tfLayer))
  await tf.ready()
  // yields to the main thread during the forward pass (rendering, input), see getLayerActivationsAsync
  const tensors = await getLayerActivationsAsync(model, sample.xTensor, outputs, { shouldAbort })
  if (!tensors) return
  const activationTensors = tf.tidy(() =>
    tensors.map((t, i) =>
      typeof seqPos === "number" && layers[i].layerPos === "output"
        ? t.slice([0, seqPos, 0], [1, 1, -1]).reshape([1, -1]) // [1, seqLen, vocab] -> [1, vocab]
        : t,
    ),
  )
  tensors.forEach((t, i) => t !== activationTensors[i] && t.dispose()) // replaced by the slice

  await new Promise((r) => setTimeout(r, 0)) // make sure layer component has mounted and buffer is attached

  const newLayerActivations: { [layerIdx: number]: LayerActivations } = {}
  try {
    const start = performance.now()
    for (const [i, layer] of layers.entries()) {
      const actTensor = activationTensors?.[i] as tf.Tensor | undefined
      if (!actTensor) continue
      const layerStats = stats?.[layer.index]
      const normalized =
        tokenInput && layer.layerPos === "input"
          ? getTokenInputColors(model, sample, tokenInput)
          : normalizeForLayer({ actTensor, layer, isRegression, layerStats })
      try {
        // WebGPU: try to copy the buffer directly in GPU
        let gpuUpdateSuccess = tryWebGPUUpdate({ backend, tfBackend, normalized, layer })
        // fallback if WebGPU is not available or failed: WASM/WebGL via CPU
        if (!gpuUpdateSuccess) {
          const data = await fallbackCPUUpdate({ normalized, layer })
          // textures are updated in textured-layer.tsx
          newLayerActivations[layer.index] = { normalizedActivations: data }
        }

        if (layer.layerPos === "output") {
          // for output layers we still need to download the activations for output ranking & regression labels
          const activations = (await actTensor.data()) as Float32Array
          newLayerActivations[layer.index] = newLayerActivations[layer.index] ?? {}
          newLayerActivations[layer.index].activations = activations
        }
      } catch (e) {
        console.error("Error getting activations", e)
      } finally {
        normalized.dispose()
      }
    }

    const end = performance.now()
    if (isDebug()) console.log(`download/colors: ${end - start}ms`)
    return newLayerActivations
  } catch (e) {
    console.log("Error getting activations", e)
    return {}
  } finally {
    activationTensors?.forEach((t) => t?.dispose())
  }
}

interface TokenInput {
  tokenizer: TokenizerType
  task?: Dataset["task"]
}

// token ids as colors don't mean anything: classification shows the impact of each token on the prediction,
// nextToken stays neutral
function getTokenInputColors(
  model: tf.LayersModel,
  sample: Sample,
  { tokenizer, task }: TokenInput,
) {
  return task === "classification"
    ? getTokenAttribution(model, sample.xTensor, sample.X, tokenizer)
    : tf.zeros(sample.xTensor.shape)
}

interface NormalizeForLayerProps {
  actTensor: tf.Tensor<tf.Rank>
  layer: NeuronLayer
  isRegression?: boolean
  layerStats?: ActivationStats
}

function normalizeForLayer({ actTensor, layer, isRegression, layerStats }: NormalizeForLayerProps) {
  const isSoftmax = layer.tfLayer.getConfig().activation === "softmax"
  return tf.tidy(() => {
    const tensor = layer.hasColorChannels
      ? actTensor.transpose([0, 3, 1, 2]) // make channelIdx the first dimension to access separate color channels with offset ( [...allRed, ...allGreen, ...allBlue] )
      : actTensor
    if (isRegression && layer.layerPos === "hidden" && layerStats) {
      const { mean, std } = layerStats
      const meanTensor = tf.tensor(mean)
      const stdTensor = tf.tensor(std)
      return scaleNormalize(tensor, meanTensor, stdTensor)
    } else if (isSoftmax) {
      return tensor
    } else return normalize(tensor)
  })
}

interface TryWebGPUUpdateProps {
  backend: Backend
  tfBackend: string
  normalized: tf.Tensor<tf.Rank>
  layer: NeuronLayer
}
function tryWebGPUUpdate({ backend, tfBackend, normalized, layer }: TryWebGPUUpdateProps) {
  let success = false
  if (isWebGPUBackend(backend) && tfBackend === "webgpu") {
    let newGpuBuffer: GPUBuffer | undefined
    try {
      // @ts-expect-error type not compatible with tensor container
      newGpuBuffer = tf.tidy(() => normalized.dataToGPU().buffer) as GPUBuffer | undefined
    } catch {
      return false // data not on GPU (e.g. tf.zeros), use CPU fallback
    }
    const existingGpuBuffer = backend.get(layer.activationsBuffer)?.buffer
    if (newGpuBuffer && existingGpuBuffer) {
      if (isDebug()) console.log("copy GPU buffer")
      const commandEncoder = backend.device.createCommandEncoder()
      // buffer is shared with other layers: never write beyond this layer's slot
      const size = Math.min(newGpuBuffer.size, layer.numNeurons * 4)
      // args: from, sourceOffset, to, destinationOffset, size
      commandEncoder.copyBufferToBuffer(
        newGpuBuffer,
        0,
        existingGpuBuffer,
        layer.bufferOffset * 4,
        size,
      )

      const commands = commandEncoder.finish()
      backend.device.queue.submit([commands])
      success = true
    } else {
      console.warn("WebGPU buffer update: Coulnd't match buffers")
    }
  }
  return success
}

interface CPUUpdateProps {
  normalized: tf.Tensor<tf.Rank>
  layer: NeuronLayer
}

async function fallbackCPUUpdate({ normalized, layer }: CPUUpdateProps) {
  if (isDebug()) console.log("using fallback")
  const data = (await normalized.data()) as Float32Array
  layer.activations.set(data)
  // storage buffer updated via CPU (only this layer's range of the shared buffer)
  layer.activationsBuffer.addUpdateRange(layer.bufferOffset, data.length)
  layer.activationsBuffer.needsUpdate = true
  for (const meshRef of layer.meshRefs) {
    const userData = meshRef.current?.userData as UserData | undefined
    if (!userData?.instancedActivations) continue
    userData.instancedActivations.needsUpdate = true // instanced buffer updated via CPU
  }
  return data
}
