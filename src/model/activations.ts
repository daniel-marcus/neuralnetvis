import { useCallback, useEffect, useRef } from "react"
import * as tf from "@tensorflow/tfjs"
import * as THREE from "three/webgpu"
import { useThree } from "@react-three/fiber"
import { useSample, type Sample } from "@/data"
import { useSceneStore, isDebug, getThree } from "@/store"
import { useActivationStats } from "./activation-stats"
import type { NeuronLayer } from "@/neuron-layers"
import type { LayerActivations } from "./types"
import WebGPUBackend from "three/src/renderers/webgpu/WebGPUBackend.js"
import { normalize } from "@/data/utils"

type UpdateTracker = Map<Sample["index"], Set<NeuronLayer["index"]>>

export function ActivationUpdater() {
  const sample = useSample()
  const model = useSceneStore((s) => s.model)
  useActivationStats()
  const setActivations = useSceneStore((s) => s.setActivations)
  const layers = useSceneStore((s) => s.allLayers)
  const focusIdx = useFlatViewFocussed()
  const invalidate = useThree((s) => s.invalidate)

  // keep track which layers already show the current sample
  const updateTracker = useRef<UpdateTracker>(new Map())
  const latestSampleIdx = useRef<Sample["index"]>(-1)

  const maybeUpdate = useCallback(
    async (sample?: Sample, focusIdx?: number) => {
      if (!model || !sample) return
      latestSampleIdx.current = sample.index

      const updatedLayers = updateTracker.current.get(sample.index) ?? new Set()
      const needsUpdate = (l: NeuronLayer) => !updatedLayers.has(l.index)
      const isFocussed = (l: NeuronLayer) => l.index === focusIdx
      const layersToUpdate =
        typeof focusIdx === "number"
          ? layers.filter((l) => isFocussed(l) && needsUpdate(l))
          : layers.filter(needsUpdate)

      if (!layersToUpdate.length) return

      const t0 = performance.now()
      // let lastYield = t0

      const LAYERS_PER_BATCH = 500 // TODO: tune for large models
      for (let i = 0; i < layersToUpdate.length; i += LAYERS_PER_BATCH) {
        if (latestSampleIdx.current !== sample.index) return // abort if sample changed already
        const layersBatch = layersToUpdate.slice(i, i + LAYERS_PER_BATCH)
        const newActivations = await getActivations(model, layersBatch, sample)
        if (newActivations) setActivations(newActivations)
        invalidate()
        // await new Promise((r) => setTimeout(r, 0)) // yield to avoid blocking
      }
      const dt = performance.now() - t0
      if (isDebug()) console.log(`>> total: ${dt}ms (${layersToUpdate.length})`)

      const newUpdated = new Set(updatedLayers)
      layersToUpdate.forEach((l) => newUpdated.add(l.index))
      updateTracker.current = new Map()
      updateTracker.current.set(sample.index, newUpdated)
    },
    [model, layers, setActivations, invalidate]
  )

  // reset update tracker when model changes
  useEffect(() => updateTracker.current.clear(), [maybeUpdate])

  useEffect(() => {
    maybeUpdate(sample, focusIdx)
  }, [sample, focusIdx, maybeUpdate])

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
  return useSceneStore((s) => s.activations[layerIdx]?.activations[neuronIdx])
}

async function getActivations(
  model: tf.LayersModel,
  layers: NeuronLayer[],
  sample: Sample
) {
  const outputs = layers.map((l) => l.tfLayer.output as tf.SymbolicTensor) // assume single output
  await tf.ready()
  const activationTensors = tf.tidy(() => {
    const t0 = performance.now()
    const allActivations = getLayerActivations(model, sample.xTensor, outputs)
    const t1 = performance.now()
    if (isDebug()) console.log(`inference: ${t1 - t0}ms`)
    return allActivations
  })

  const newLayerActivations: { [layerIdx: number]: LayerActivations } = {}
  try {
    const start = performance.now()
    const renderer = getThree()!.gl as unknown as THREE.WebGPURenderer
    const backend = renderer.backend as WebGPUBackend
    const device =
      "device" in backend ? (backend.device as GPUDevice) : undefined
    const threeData =
      "data" in backend
        ? (backend.data as WeakMap<
            THREE.StorageBufferAttribute,
            { buffer: GPUBuffer }
          >)
        : undefined
    for (const [i, layer] of layers.entries()) {
      if (!activationTensors?.[i]) continue
      const actTensor = activationTensors[i] as tf.Tensor

      const isSoftmax = layer.tfLayer.getConfig().activation === "softmax"
      try {
        if (!device || !threeData) return
        if (layer.hasColorChannels) continue // TODO: handle color channels
        // @ts-expect-error type not compatible with tensor container
        const newGpuBuffer = tf.tidy(() => {
          const normalized = isSoftmax ? actTensor : normalize(actTensor)
          return normalized.dataToGPU().buffer
        }) as GPUBuffer | undefined
        const existingGpuBuffer = threeData.get(layer.activationsBuffer)?.buffer
        if (newGpuBuffer && existingGpuBuffer) {
          // console.log("copy GPU buffer", { newGpuBuffer, existingGpuBuffer })

          const commandEncoder = device.createCommandEncoder()
          commandEncoder.copyBufferToBuffer(
            newGpuBuffer, // from
            0, // sourceOffset
            existingGpuBuffer, // to
            0, // destinationOffset
            newGpuBuffer.size
          )

          const commands = commandEncoder.finish()
          device.queue.submit([commands])
          // await device.queue.onSubmittedWorkDone()
          // newGpuBuffer.destroy()
          continue
        }
      } catch (e) {
        console.error("Error copying GPU buffer", e)
      }
      const act = new Float32Array(0) // (await actTensor.data()) as Float32Array

      // reuse buffer from layer to avoid reallocating
      const { activations, channelActivations } = layer

      if (layer.hasColorChannels) {
        // different order in color layers: [...allRed, ...allGreen, ...allBlue]
        // see channelViews() in neuron-layers/layers.ts
        for (let nIdx = 0; nIdx < act.length; nIdx += 1) {
          const channelIdx = nIdx % 3
          const idxInChannel = Math.floor(nIdx / 3)
          channelActivations[channelIdx][idxInChannel] = act[nIdx] // TODO: switch dims in tensor above?
        }
      } else {
        activations.set(act)
      }

      newLayerActivations[layer.index] = {
        activations: act,
      }
    }
    const end = performance.now()
    if (isDebug()) console.log(`download/colors: ${end - start}ms`)
    return {} // newLayerActivations
  } catch (e) {
    console.log("Error getting activations", e)
    return {}
  } finally {
    activationTensors?.forEach((t) => t?.dispose())
  }
}

export function getLayerActivations(
  model: tf.LayersModel,
  inputTensor: tf.Tensor,
  outputs?: tf.SymbolicTensor[]
) {
  const inputDimsModel = model.layers[0].batchInputShape.slice(1)
  const inputDimsSample = inputTensor.shape.slice(1)
  if (!checkShapeMatch(inputDimsModel, inputDimsSample)) return
  try {
    return tf.tidy(() => {
      const tmpModel = tf.model({
        inputs: model.input,
        outputs: outputs ?? model.layers.flatMap((layer) => layer.output),
      })
      const result = tmpModel.predict(inputTensor)
      return Array.isArray(result) ? result : [result]
    })
  } catch {
    return
  }
}

type Shape = (number | null)[]

export function checkShapeMatch(s1: Shape, s2: Shape) {
  return s1.every((value, idx) => value === s2[idx])
}
