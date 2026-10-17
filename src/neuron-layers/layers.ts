import { useEffect, useMemo } from "react"
import type * as tf from "@tensorflow/tfjs"
import * as THREE from "three/webgpu"
import { storage } from "three/tsl"
import { isDebug, useSceneStore } from "@/store"
import { getMeshParams } from "./layout"
import { getUnits } from "./helpers"
import { getLayerDef } from "@/model/layers"
import { getNodeIdx } from "@/model/get-layer-activations"
import type { InstancedMesh } from "three/webgpu"
import type { Layer } from "@tensorflow/tfjs-layers/dist/exports_layers"
import type { GroupRef, LayerPos, NeuronLayer, LayerType } from "./types"

const NO_LAYERS: NeuronLayer[] = []

// returns the layers of the model that can be shown (without invisible layers like Flatten)
// the layers are created once per model: which of them are mounted and shown is decided in Model
export function useLayers() {
  const model = useSceneStore((s) => s.model)
  const modelLoadState = useSceneStore((s) => s.modelLoadState)
  const task = useSceneStore((s) => s.ds?.task)
  const hasInputLabels = useSceneStore((s) => !!s.ds?.inputLabels?.length || !!s.ds?.tokenizer)
  const hasOutputLabels = useSceneStore((s) => !!s.ds?.outputLabels?.length)
  const setAllLayers = useSceneStore((s) => s.setAllLayers)

  const layers = useMemo(() => {
    if (!model) return NO_LAYERS
    const modelKey = `${model.name}_${modelLoadState}`
    return createLayers(model, modelKey, { task, hasInputLabels, hasOutputLabels })
  }, [model, modelLoadState, task, hasInputLabels, hasOutputLabels])

  useEffect(() => setAllLayers(layers), [layers, setAllLayers])

  return layers
}

interface LayerOptions {
  task?: string
  hasInputLabels: boolean
  hasOutputLabels: boolean
}

function createLayers(model: tf.LayersModel, modelKey: string, options: LayerOptions) {
  const { task, hasInputLabels, hasOutputLabels } = options
  const bufferSlots = getBufferSlots(model, modelKey, task)
  const tfLayers = [...model.layers.entries()].filter(([, tfLayer]) => isVisible(tfLayer))

  const layers: NeuronLayer[] = []
  const layersByTfLayer = new Map<Layer, NeuronLayer>()
  for (const [layerIndex, tfLayer] of tfLayers) {
    const className = tfLayer.getClassName() as LayerType
    const layerPos = getLayerPos(layerIndex, model)
    const inputLayers = getInputTfLayers(tfLayer)
      .map((l) => layersByTfLayer.get(l))
      .filter((l) => !!l)
    // fallback: inputs that are not layers of this model (e.g. from a nested model)
    const lastLayer = layers.at(-1)
    if (!inputLayers.length && lastLayer && hasInboundLayers(tfLayer)) inputLayers.push(lastLayer)
    const prevLayer = inputLayers.at(0)

    const { outputShape, units } = getLayerShape(tfLayer, layerPos, task)
    const meshParams =
      ["BatchNormalization", "RandomRotation", "Add", "Multiply"].includes(className) && !!prevLayer
        ? prevLayer.meshParams
        : getMeshParams(tfLayer, layerPos, units)
    // Dense on sequences: the units are applied to every position
    const { filters, units: unitsPerPosition } = tfLayer.getConfig()
    const numBiases = (filters as number) ?? (unitsPerPosition as number) ?? units

    const hasColorChannels = layerPos === "input" && outputShape[3] === 3
    const channels = hasColorChannels ? 3 : 1
    const meshRefs = Array.from({ length: channels }).map(createMeshRef)
    const groupRefs = Array.from({ length: channels }).map(createGroupRef)

    const { page, offset: bufferOffset } = bufferSlots.get(layerIndex)!
    const activations = page.activations.subarray(bufferOffset, bufferOffset + units)
    const channelActivations = channelViews(activations, units, channels)

    const layer: NeuronLayer = {
      lid: `${modelKey}_${tfLayer.name}_${units}`,
      index: layerIndex,
      layerType: className,
      layerPos,
      tfLayer,
      outputShape,
      inputLayers,
      prevLayer,
      numNeurons: units,
      numBiases,
      meshRefs,
      groupRefs,
      meshParams,
      hasLabels:
        (layerPos === "input" && hasInputLabels) || (layerPos === "output" && hasOutputLabels),
      hasColorChannels,
      activations,
      channelActivations,
      activationsBuffer: page.actBuffer,
      storageNode: page.storageNode,
      bufferOffset,
    }
    layers.push(layer)
    layersByTfLayer.set(tfLayer, layer)
  }

  if (isDebug()) {
    const totalNeurons = layers.reduce((acc, l) => acc + l.numNeurons, 0)
    console.log({ model: model.name, totalNeurons })
  }
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

function createGroupRef() {
  return { current: null } as GroupRef
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

// keyed by model (not by name): buffers can be garbage collected together with their model,
// and models that share a name never share slots
const bufferSlotsCache = new WeakMap<tf.LayersModel, Map<string | undefined, BufferSlots>>() // model -> task -> slots

// allocates slots for all layers that might be shown (incl. hidden layers), so buffers don't change when toggling them
function getBufferSlots(model: tf.LayersModel, modelKey: string, task?: string): BufferSlots {
  let modelCache = bufferSlotsCache.get(model)
  if (!modelCache) {
    modelCache = new Map()
    bufferSlotsCache.set(model, modelCache)
  }
  const cached = modelCache.get(task)
  if (cached) return cached
  const key = `${modelKey}_${task}`
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
  modelCache.set(task, slots)
  return slots
}

// the visible layers that feed a layer, in the order of its inputs
// invisible layers (e.g. Flatten) are skipped: their inputs are used instead
export function getInputTfLayers(tfLayer: Layer, nodeIdx = getNodeIdx(tfLayer)) {
  const node = tfLayer.inboundNodes[nodeIdx]
  const inputLayers = new Set<Layer>()
  for (const [i, inboundLayer] of (node?.inboundLayers ?? []).entries()) {
    const inboundNodeIdx = node.nodeIndices[i] ?? 0
    // shared layers: only the visualized call is shown, other calls are skipped like invisible layers
    const isShown = isVisible(inboundLayer) && inboundNodeIdx === getNodeIdx(inboundLayer)
    if (isShown) inputLayers.add(inboundLayer)
    else for (const l of getInputTfLayers(inboundLayer, inboundNodeIdx)) inputLayers.add(l)
  }
  return [...inputLayers]
}

function hasInboundLayers(tfLayer: Layer) {
  return !!tfLayer.inboundNodes[getNodeIdx(tfLayer)]?.inboundLayers.length
}

export function isVisible(layer: Layer) {
  const className = layer.getClassName()
  const layerDef = getLayerDef(className)
  // the output layer is always visible, even an Activation (e.g. softmax after a tied ReversibleEmbedding)
  const isOutput = layer.outboundNodes.length === 0
  return !layerDef?.isInvisible || isOutput
}

function getLayerPos(layerIndex: number, model: tf.LayersModel): LayerPos {
  if (layerIndex === 0) return "input"
  else if (layerIndex === model.layers.length - 1) return "output"
  else return "hidden"
}
