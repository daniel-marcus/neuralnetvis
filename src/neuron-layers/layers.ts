import { createRef, useEffect, useMemo } from "react"
import * as tf from "@tensorflow/tfjs"
import * as THREE from "three/webgpu"
import { storage } from "three/tsl"
import { isDebug, useSceneStore } from "@/store"
import { getMeshParams } from "./layout"
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
  const showHiddenLayers =
    _showHiddenLayers || (!isLargeModel && (isActive || isHovered))
  const layers = useMemo(() => {
    if (!model) return []
    const visibleIdxMap = getVisibleIdxMap(model, showHiddenLayers)
    const newLayers =
      model.layers.reduce((acc, tfLayer, layerIndex) => {
        const visibleIdx = visibleIdxMap.get(layerIndex) ?? -1
        if (shouldSkip(visibleIdx, visibleIdxMap.size)) return acc

        const className = tfLayer.getClassName() as LayerType
        const layerPos = getLayerPos(layerIndex, model)

        const prevLayer = acc.find((l) => l.visibleIdx === visibleIdx - 1)

        const units = getUnits(tfLayer)
        const meshParams =
          ["BatchNormalization", "RandomRotation", "Add"].includes(className) &&
          !!prevLayer
            ? prevLayer.meshParams
            : getMeshParams(tfLayer, layerPos, units)
        const numBiases = (tfLayer.getConfig().filters as number) ?? units
        const outputShape = tfLayer.outputShape as number[]

        const hasColorChannels = layerPos === "input" && outputShape[3] === 3

        const layerMeshRef = createRef<InstancedMesh>()
        const groupCount = (tfLayer.outputShape?.[3] as number | undefined) ?? 1
        const groupMeshRefs = Array.from({ length: groupCount }).map(() =>
          createRef<InstancedMesh>()
        )

        const lid = `${model.name}_${modelLoadState}_${tfLayer.name}_${units}`
        const { activations, actBuffer } = getBuffers(lid, units)

        const channels = hasColorChannels ? 3 : 1
        const channelActivations = channelViews(activations, units, channels)

        const layer: NeuronLayer = {
          lid,
          index: layerIndex,
          visibleIdx,
          layerType: className,
          layerPos,
          tfLayer,
          prevLayer,
          numNeurons: units,
          numBiases,
          meshRefs: hasColorChannels ? groupMeshRefs : [layerMeshRef],
          meshParams,
          hasLabels:
            (layerPos === "input" && !!ds?.inputLabels?.length) ||
            (layerPos === "output" && !!ds?.outputLabels?.length) ||
            (layerPos === "input" && ds?.decodeInput),
          hasColorChannels,
          activations,
          channelActivations,
          activationsBuffer: actBuffer,
          storageNode: storage(actBuffer),
        }
        return [...acc, layer]
      }, [] as NeuronLayer[]) ?? []
    if (isDebug()) {
      const totalNeurons = newLayers.reduce((acc, l) => acc + l.numNeurons, 0)
      console.log({ model: model.name, totalNeurons })
    }
    return newLayers
  }, [model, ds, modelLoadState, showHiddenLayers])
  useEffect(() => {
    setAllLayers(layers)
  }, [layers, setAllLayers])
  return layers
}

function channelViews(activations: Float32Array, units: number, channels = 3) {
  // for color layers: create a new view on the layer activations buffer that includes only the values for the given channelIdx
  // layer activations buffer has to be like: [...allRed, ...allGreen, ...allBlue], see activations.ts
  const channelUnits = units / channels
  return Array.from({ length: channels }).map((_, channelIdx) => {
    const offset = channelIdx * channelUnits * 4
    return new Float32Array(activations.buffer, offset, channelUnits)
  })
}

type Buffers = {
  activations: Float32Array
  actBuffer: THREE.StorageBufferAttribute
}

// TODO: implement buffer disposal
const bufferCache = new Map<NeuronLayer["lid"], Buffers>()

function getBuffers(lid: NeuronLayer["lid"], units: number): Buffers {
  if (bufferCache.has(lid)) return bufferCache.get(lid)!
  const activations = new Float32Array(units)
  const actBuffer = new THREE.StorageBufferAttribute(activations, 1)
  actBuffer.name = lid
  const buffers = { activations, actBuffer }
  bufferCache.set(lid, buffers)
  return buffers
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
  return !layerDef?.isInvisible
}

const getVisibleIdxMap = (model: tf.LayersModel, showHiddenLayers: boolean) => {
  return model.layers.reduce((map, layer, i) => {
    const layerPos = getLayerPos(i, model)
    if (!showHiddenLayers && layerPos === "hidden") return map
    return isVisible(layer) ? map.set(i, map.size) : map
  }, new Map<number, number>())
}

export function getUnits(layer: Layer) {
  const [, ...dims] = layer.outputShape as number[]
  return dims.reduce((a, b) => a * b, 1)
}

function getLayerPos(layerIndex: number, model: tf.LayersModel): LayerPos {
  if (layerIndex === 0) return "input"
  else if (layerIndex === model.layers.length - 1) return "output"
  else return "hidden"
}
