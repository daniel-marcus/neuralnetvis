import { useEffect, useState } from "react"
import type * as tf from "@tensorflow/tfjs"
import * as THREE from "three/webgpu"
import { storage } from "three/tsl"
import { isDebug, useSceneStore } from "@/store"
import { getMeshParams } from "./layout"
import { getUnits } from "./helpers"
import { getLayerDef } from "@/model/layers"
import type { InstancedMesh } from "three/webgpu"
import type { Layer } from "@tensorflow/tfjs-layers/dist/exports_layers"
import type { LayerPos, NeuronLayer, LayerType } from "./types"

// returns an array of all visible layers
export function useLayers() {
  const model = useSceneStore((s) => s.model)
  const ds = useSceneStore((s) => s.ds)
  const setAllLayers = useSceneStore((s) => s.setAllLayers)
  const modelLoadState = useSceneStore((s) => s.modelLoadState)
  const isActive = useSceneStore((s) => s.isActive)
  const isHovered = useSceneStore((s) => s.isHovered)
  const isLargeModel = useSceneStore((s) => s.isLargeModel)
  const _showHiddenLayers = useSceneStore((s) => s.vis.showHiddenLayers) // set to true to preload all layers
  const showHiddenLayers = _showHiddenLayers || (!isLargeModel && (isActive || isHovered))

  const [layers, setLayers] = useState<NeuronLayer[]>([])

  useEffect(() => {
    if (!model) {
      setLayers([]) // eslint-disable-line react-hooks/set-state-in-effect
      setAllLayers([])
      return
    }
    const visibleIdxMap = getVisibleIdxMap(model, showHiddenLayers)
    const bufferSlots = getBufferSlots(model, `${model.name}_${modelLoadState}`, ds?.task)
    const newLayers =
      model.layers.reduce((acc, tfLayer, layerIndex) => {
        const visibleIdx = visibleIdxMap.get(layerIndex) ?? -1
        if (shouldSkip(visibleIdx, visibleIdxMap.size)) return acc

        const className = tfLayer.getClassName() as LayerType
        const layerPos = getLayerPos(layerIndex, model)

        const prevLayer = acc.find((l) => l.visibleIdx === visibleIdx - 1)

        const { outputShape, units } = getLayerShape(tfLayer, layerPos, ds?.task)
        const meshParams =
          ["BatchNormalization", "RandomRotation", "Add"].includes(className) && !!prevLayer
            ? prevLayer.meshParams
            : getMeshParams(tfLayer, layerPos, units)
        const numBiases = (tfLayer.getConfig().filters as number) ?? units

        const hasColorChannels = layerPos === "input" && outputShape[3] === 3
        const channels = hasColorChannels ? 3 : 1
        const meshRefs = Array.from({ length: channels }).map(createMeshRef)

        const lid = `${model.name}_${modelLoadState}_${tfLayer.name}_${units}`
        const { page, offset: bufferOffset } = bufferSlots.get(layerIndex)!
        const activations = page.activations.subarray(bufferOffset, bufferOffset + units)
        const channelActivations = channelViews(activations, units, channels)

        const layer: NeuronLayer = {
          lid,
          index: layerIndex,
          visibleIdx,
          layerType: className,
          layerPos,
          tfLayer,
          outputShape,
          prevLayer,
          numNeurons: units,
          numBiases,
          meshRefs,
          meshParams,
          hasLabels:
            (layerPos === "input" && !!ds?.inputLabels?.length) ||
            (layerPos === "output" && !!ds?.outputLabels?.length) ||
            (layerPos === "input" && !!ds?.tokenizer),
          hasColorChannels,
          activations,
          channelActivations,
          activationsBuffer: page.actBuffer,
          storageNode: page.storageNode,
          bufferOffset,
        }
        return [...acc, layer]
      }, [] as NeuronLayer[]) ?? []
    if (isDebug()) {
      const totalNeurons = newLayers.reduce((acc, l) => acc + l.numNeurons, 0)
      console.log({ model: model.name, totalNeurons })
    }
    setLayers(newLayers)
    setAllLayers(newLayers)
  }, [model, ds, modelLoadState, showHiddenLayers, setAllLayers])

  return layers
}

function channelViews(activations: Float32Array, units: number, channels = 3) {
  // for color layers: create a new view on the layer activations buffer that includes only the values for the given channelIdx
  // layer activations buffer has to be like: [...allRed, ...allGreen, ...allBlue], see activations.ts
  const channelUnits = units / channels
  return Array.from({ length: channels }).map((_, channelIdx) => {
    const offset = channelIdx * channelUnits
    return activations.subarray(offset, offset + channelUnits)
  })
}

function getLayerShape(tfLayer: tf.layers.Layer, layerPos: LayerPos, task?: string) {
  // nextToken: output layer shows only the prediction at the current position (see next-token.ts)
  const isSeqOutput = layerPos === "output" && task === "nextToken"
  const tfShape = tfLayer.outputShape as number[]
  const outputShape = isSeqOutput ? [tfShape[0], tfShape[tfShape.length - 1]] : tfShape
  const units = isSeqOutput ? outputShape[1] : getUnits(tfLayer)
  return { outputShape, units }
}

function createMeshRef() {
  return { current: null } as React.RefObject<InstancedMesh | null>
}

// Activations of all layers share a few large storage buffers ("pages"), each layer reads from its offset.
// This way all layers can use the same material, so three.js only has to build the shader once.
// Page size = WebGPU default limit for maxStorageBufferBindingSize (128 MiB)
const MAX_PAGE_UNITS = (128 * 1024 * 1024) / 4

interface BufferPage {
  activations: Float32Array
  actBuffer: THREE.StorageBufferAttribute
  storageNode: THREE.StorageBufferNode<"float">
}

interface BufferSlot {
  page: BufferPage
  offset: number
}

type BufferSlots = Map<number, BufferSlot> // layerIndex -> slot

// TODO: implement buffer disposal
const bufferSlotsCache = new Map<string, BufferSlots>()

// allocates slots for all layers that might be shown (incl. hidden layers), so buffers don't change when toggling them
function getBufferSlots(model: tf.LayersModel, modelKey: string, task?: string): BufferSlots {
  const key = `${modelKey}_${task}`
  if (bufferSlotsCache.has(key)) return bufferSlotsCache.get(key)!
  const pageLayers: { layerIndex: number; offset: number }[][] = [[]]
  let pageUnits = 0
  const pageSizes: number[] = []
  for (const [layerIndex, tfLayer] of model.layers.entries()) {
    if (!isVisible(tfLayer)) continue
    const { units } = getLayerShape(tfLayer, getLayerPos(layerIndex, model), task)
    if (pageUnits > 0 && pageUnits + units > MAX_PAGE_UNITS) {
      pageSizes.push(pageUnits)
      pageLayers.push([])
      pageUnits = 0
    }
    pageLayers[pageLayers.length - 1].push({ layerIndex, offset: pageUnits })
    pageUnits += units
  }
  pageSizes.push(pageUnits)

  const slots: BufferSlots = new Map()
  pageLayers.forEach((layers, pageIdx) => {
    const activations = new Float32Array(Math.max(pageSizes[pageIdx], 1))
    const actBuffer = new THREE.StorageBufferAttribute(activations, 1)
    actBuffer.name = `${key}_activations_${pageIdx}`
    // fixed name: otherwise the WGSL var is named after the node id, making every page's shader unique
    const storageNode = storage(actBuffer, "float", activations.length).setName("activations")
    const page = { activations, actBuffer, storageNode }
    for (const { layerIndex, offset } of layers) slots.set(layerIndex, { page, offset })
  })
  bufferSlotsCache.set(key, slots)
  return slots
}

const MAX_VISIBLE_LAYERS = 200

// avoid browser crash with too large models
function shouldSkip(visibleIdx: number, totalVisibleLayers: number) {
  if (visibleIdx === -1) return true
  if (visibleIdx === totalVisibleLayers - 1) return false // always include output layer
  const result = visibleIdx > MAX_VISIBLE_LAYERS
  if (result) {
    const msg = `Max visible layers exceeded. Skipping layer ${visibleIdx}/${totalVisibleLayers}`
    console.log(msg)
  }
  return result
}

export function isVisible(layer: Layer) {
  const className = layer.getClassName()
  const layerDef = getLayerDef(className)
  // the output layer is always visible, even an Activation (e.g. softmax after a tied ReversibleEmbedding)
  const isOutput = layer.outboundNodes.length === 0
  return !layerDef?.isInvisible || isOutput
}

const getVisibleIdxMap = (model: tf.LayersModel, showHiddenLayers: boolean) => {
  return model.layers.reduce((map, layer, i) => {
    const layerPos = getLayerPos(i, model)
    if (!showHiddenLayers && layerPos === "hidden") return map
    return isVisible(layer) ? map.set(i, map.size) : map
  }, new Map<number, number>())
}

function getLayerPos(layerIndex: number, model: tf.LayersModel): LayerPos {
  if (layerIndex === 0) return "input"
  else if (layerIndex === model.layers.length - 1) return "output"
  else return "hidden"
}
