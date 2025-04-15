import { createRef, useMemo } from "react"
import * as tf from "@tensorflow/tfjs"
import { getMeshParams } from "./layout"
import { getHighlightColor } from "@/utils/colors"
import { getLayerDef } from "@/model/layers"
import type { InstancedMesh } from "three"
import type { Layer } from "@tensorflow/tfjs-layers/dist/exports_layers"
import type { DatasetDef } from "@/data"
import type { LayerPos, LayerStateless, LayerType } from "./types"
import type { Index3D, Nid, NeuronDef } from "./types"

// here is all data that doesn't change for a given model

export function useStatelessLayers(model?: tf.LayersModel, ds?: DatasetDef) {
  const layers = useMemo(() => {
    if (!model) return []
    const visibleIdxMap = getVisibleIdxMap(model)
    return (
      model.layers.reduce((acc, tfLayer, layerIndex) => {
        const className = tfLayer.getClassName() as LayerType
        const layerPos = getLayerPos(layerIndex, model)

        const visibleIdx = visibleIdxMap.get(layerIndex) ?? 0
        const prevLayer = acc.find((l) => l.visibleIdx === visibleIdx - 1)

        const layerInputNids =
          model.layers.length > 5
            ? [] // TODO: load input nids on demand only?
            : getInputNids(tfLayer, prevLayer?.tfLayer, prevLayer?.index)

        const units = getUnits(tfLayer)
        const meshParams =
          ["BatchNormalization", "RandomRotation"].includes(className) &&
          !!prevLayer
            ? prevLayer.meshParams
            : getMeshParams(tfLayer, layerPos, units)
        const numBiases = (tfLayer.getConfig().filters as number) ?? units
        const outputShape = tfLayer.outputShape as number[]

        const hasColorChannels = layerPos === "input" && outputShape[3] === 3

        const layerStateless: LayerStateless = {
          index: layerIndex,
          visibleIdx,
          layerType: className,
          layerPos,
          tfLayer,
          prevLayer,
          numBiases,
          meshParams,
          hasLabels:
            (layerPos === "input" && !!ds?.inputLabels?.length) ||
            (layerPos === "output" && !!ds?.outputLabels?.length),
          hasColorChannels,
          neurons: [],
          groups: [],
          layerGroup: {
            // as dummy here
            index: 0,
            nids: [],
            nidsStr: "",
            meshRef: createRef<InstancedMesh>(),
          },
        }

        const groupCount = (tfLayer.outputShape?.[3] as number | undefined) ?? 1

        const meshRefs = Array.from({ length: groupCount }).map(() =>
          createRef<InstancedMesh>()
        )

        const neurons = shouldSkip(layerIndex, model.layers.length)
          ? []
          : Array.from({ length: units }).map((_, neuronIndex) => {
              const index3d = getIndex3d(neuronIndex, outputShape)
              const inputNids = layerInputNids?.[neuronIndex] ?? []
              const groupIndex = neuronIndex % groupCount
              const indexInGroup = Math.floor(neuronIndex / groupCount)
              return {
                nid: getNid(layerIndex, index3d),
                index: neuronIndex,
                index3d,
                layerIndex,
                groupIndex,
                indexInGroup,
                meshRef: hasColorChannels ? meshRefs[groupIndex] : meshRefs[0], // non-color layers share 1 instanced mesh now
                visibleLayerIndex: visibleIdx,
                inputNids,
                inputNeurons: prevLayer
                  ? (inputNids
                      .map((nid) => prevLayer.neuronsMap?.get(nid))
                      .filter(Boolean) as NeuronDef[])
                  : [],
                label:
                  layerPos === "output"
                    ? ds?.outputLabels?.[neuronIndex]
                    : layerPos === "input" &&
                      index3d[1] === 0 &&
                      index3d[2] === 0
                    ? ds?.inputLabels?.[index3d[0]]
                    : undefined,
                layer: layerStateless,
                color: getHighlightColor(0),
              }
            }) ?? []
        const neuronsMap = new Map(neurons.map((n) => [n.nid, n]))
        const groups = Array.from({ length: groupCount }).map((_, i) => {
          const groupedNeurons = neurons.filter((n) => n.groupIndex === i)
          const nids = groupedNeurons.map((n) => n.nid)
          const nidsStr = nids.join(",")
          return {
            index: i,
            nids,
            nidsStr,
            meshRef: meshRefs[i],
            neurons: groupedNeurons,
          }
        })
        const layerGroup = {
          index: 0,
          nids: neurons.map((n) => n.nid),
          nidsStr: neurons.map((n) => n.nid).join(","),
          meshRef: meshRefs[0],
          neurons,
        }
        const layer = {
          ...layerStateless,
          neurons,
          neuronsMap,
          groups,
          layerGroup,
        }
        return [...acc, layer]
      }, [] as LayerStateless[]) ?? []
    )
  }, [model, ds])

  return layers
}

const MAX_HIDDEN_LAYERS = 30

function shouldSkip(layerIdx: number, totalLayers: number) {
  // avoid browser crash with too large models
  if (layerIdx === 0 || layerIdx === totalLayers - 1) return false
  const result = layerIdx > MAX_HIDDEN_LAYERS
  return result
}

const getVisibleIdxMap = (model: tf.LayersModel) =>
  model.layers.reduce(
    (map, layer, index) => (getUnits(layer) ? map.set(index, map.size) : map),
    new Map<number, number>()
  )

export function getNid(layerIndex: number, index3d: Index3D) {
  return `${layerIndex}_${index3d.join(".")}` as Nid
}

export function getIndex3d(flatIndex: number, outputShape: number[]) {
  const [, , width = 1, depth = 1] = outputShape
  const depthIndex = flatIndex % depth
  const widthIndex = Math.floor(flatIndex / depth) % width
  const heightIndex = Math.floor(flatIndex / (depth * width))
  return [heightIndex, widthIndex, depthIndex] as Index3D
}

export function getUnits(layer: tf.layers.Layer) {
  const className = layer.getClassName()
  const layerDef = getLayerDef(className)
  if (layerDef?.isInvisible) return 0
  // if (["Flatten", "Dropout"].includes(layer.getClassName())) return 0
  const [, ...dims] = layer.outputShape as number[]
  return dims.reduce((a, b) => a * b, 1)
}

function getLayerPos(layerIndex: number, model: tf.LayersModel): LayerPos {
  if (layerIndex === 0) return "input"
  else if (layerIndex === model.layers.length - 1) return "output"
  else return "hidden"
}

function getInputNids(l: Layer, prev?: Layer, prevIdx?: number): Nid[][] {
  if (!prev || typeof prevIdx !== "number") return []
  const className = l.getClassName()
  const getterFunc = getLayerDef(className)?.getInputNids
  if (!getterFunc) return []
  else return getterFunc(l, prev, prevIdx)
}
