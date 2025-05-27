import { useCallback, useEffect, useRef } from "react"
import * as tf from "@tensorflow/tfjs"
import * as THREE from "three/webgpu"
import { useThree } from "@react-three/fiber"
import { useSample, type Sample } from "@/data"
import { useSceneStore, isDebug } from "@/store"
import { useActivationStats } from "./activation-stats"
import { isWebGPUBackend } from "@/utils/webgpu"
import { normalize } from "@/data/utils"
import type { NeuronLayer } from "@/neuron-layers"
import type { LayerActivations } from "./types"

type UpdateTracker = Map<Sample["index"], Set<NeuronLayer["lid"]>>

export function ActivationUpdater() {
  const sample = useSample()
  const model = useSceneStore((s) => s.model)
  useActivationStats()
  const setActivations = useSceneStore((s) => s.setActivations)
  const layers = useSceneStore((s) => s.allLayers)
  const focusIdx = useFlatViewFocussed()
  const invalidate = useThree((s) => s.invalidate)
  const renderer = useThree((s) => s.gl as unknown as THREE.WebGPURenderer)

  // keep track which layers already show the current sample
  const updateTracker = useRef<UpdateTracker>(new Map())
  const latestSampleIdx = useRef<Sample["index"]>(-1)

  const maybeUpdate = useCallback(
    async (sample?: Sample, focusIdx?: number) => {
      if (!model || !sample) return
      latestSampleIdx.current = sample.index

      const updatedLayers = updateTracker.current.get(sample.index) ?? new Set()
      const needsUpdate = (l: NeuronLayer) => !updatedLayers.has(l.lid)
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
        const newActivations = await getActivations(
          renderer,
          model,
          layersBatch,
          sample
        )
        if (newActivations) setActivations(newActivations)
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
    [renderer, model, layers, invalidate, setActivations]
  )

  // reset update tracker when model changes
  useEffect(() => {
    return () => {
      updateTracker.current.clear()
      latestSampleIdx.current = -1
    }
  }, [maybeUpdate])

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
  renderer: THREE.WebGPURenderer,
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

  await new Promise((r) => setTimeout(r, 0)) // make sure layer component has mounted and buffer is attached

  const newLayerActivations: { [layerIdx: number]: LayerActivations } = {}
  try {
    const start = performance.now()
    const backend = renderer.backend
    for (const [i, layer] of layers.entries()) {
      if (!activationTensors?.[i]) continue
      const actTensor = activationTensors[i] as tf.Tensor
      const isSoftmax = layer.tfLayer.getConfig().activation === "softmax"
      const normalized = tf.tidy(() => {
        const tensor = layer.hasColorChannels
          ? actTensor.transpose([0, 3, 1, 2]) // make channelIdx the first dimension to access separate color channels with offset ( [...allRed, ...allGreen, ...allBlue] )
          : actTensor
        return isSoftmax ? tensor : normalize(tensor)
      })
      try {
        if (isWebGPUBackend(backend)) {
          // WebGPU is available: we can copy the buffer directly in GPU
          // @ts-expect-error type not compatible with tensor container
          const newGpuBuffer = tf.tidy(() => {
            return normalized.dataToGPU().buffer
          }) as GPUBuffer | undefined
          const existingGpuBuffer = backend.data.get(
            layer.activationsBuffer
          )?.buffer
          if (newGpuBuffer && existingGpuBuffer) {
            if (isDebug()) console.log("copy GPU buffer")
            const commandEncoder = backend.device.createCommandEncoder()
            commandEncoder.copyBufferToBuffer(
              newGpuBuffer, // from
              0, // sourceOffset
              existingGpuBuffer, // to
              0, // destinationOffset
              newGpuBuffer.size
            )

            const commands = commandEncoder.finish()
            backend.device.queue.submit([commands])
            // await device.queue.onSubmittedWorkDone()
            // newGpuBuffer.destroy()
            // continue
          }
        } else {
          // fallback if WebGPU is not available: fallback for WASM/WebGL via CPU
          if (isDebug()) console.log("using fallback")
          const data = await normalized.data()
          layer.activations.set(data)
          layer.activationsBuffer.needsUpdate = true
        }

        if (layer.layerPos === "output") {
          // for output layers we still need to download the activations
          // for output ranking & regression labels
          const activations = (await actTensor.data()) as Float32Array
          newLayerActivations[layer.index] = {
            activations,
          }
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
