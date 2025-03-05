import { createRef, useMemo } from "react"
import * as tf from "@tensorflow/tfjs"
import { getMeshParams } from "./layout"
import type { DatasetDef } from "@/data"
import type { LayerPos, LayerStateless, LayerType } from "./types"
import type { Index3D, Nid, NeuronDef } from "./types"
import type { InstancedMesh } from "three"

// here is all data that doesn't change for a given model

export function useStatelessLayers(model?: tf.LayersModel, ds?: DatasetDef) {
  const layers = useMemo(() => {
    if (!model) return []
    const visibleIdxMap = getVisibleIdxMap(model)
    return (
      model.layers.reduce((acc, tfLayer, layerIndex) => {
        const layerType = tfLayer.getClassName() as LayerType
        const layerPos = getLayerPos(layerIndex, model)

        const visibleIdx = visibleIdxMap.get(layerIndex) ?? 0
        const prevLayer = acc.find((l) => l.visibleIdx === visibleIdx - 1)
        const layerInputNids = getInputNeurons(tfLayer, prevLayer)

        const units = getUnits(tfLayer)
        const meshParams = getMeshParams(tfLayer, layerPos, units)
        const numBiases = (tfLayer.getConfig().filters as number) ?? units
        const outputShape = tfLayer.outputShape as number[]

        const layerStateless: LayerStateless = {
          index: layerIndex,
          visibleIdx,
          layerType,
          layerPos,
          tfLayer,
          prevLayer,
          numBiases,
          meshParams,
          hasLabels:
            (layerPos === "input" && !!ds?.inputLabels?.length) ||
            (layerPos === "output" && !!ds?.outputLabels?.length),
          hasColorChannels: layerPos === "input" && outputShape[3] === 3,
          neurons: [],
          groups: [],
        }

        const groupCount = (tfLayer.outputShape?.[3] as number | undefined) ?? 1

        const meshRefs = Array.from({ length: groupCount }).map(() =>
          createRef<InstancedMesh>()
        )

        const neurons =
          Array.from({ length: units }).map((_, neuronIndex) => {
            const index3d = getNeuronIndex3d(neuronIndex, outputShape)
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
              meshRef: meshRefs[groupIndex],
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
                  : layerPos === "input" && index3d[1] === 0 && index3d[2] === 0
                  ? ds?.inputLabels?.[index3d[0]]
                  : undefined,
              layer: layerStateless,
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
          }
        })
        const layer = {
          ...layerStateless,
          neurons,
          neuronsMap,
          groups,
        }
        return [...acc, layer]
      }, [] as LayerStateless[]) ?? []
    )
  }, [model, ds])

  return layers
}

const getVisibleIdxMap = (model: tf.LayersModel) =>
  model.layers.reduce(
    (map, layer, index) => (getUnits(layer) ? map.set(index, map.size) : map),
    new Map<number, number>()
  )

function getNid(layerIndex: number, index3d: Index3D) {
  return `${layerIndex}_${index3d.join(".")}` as Nid
}

function getNeuronIndex3d(flatIndex: number, outputShape: number[]) {
  const [, , width = 1, depth = 1] = outputShape
  const depthIndex = flatIndex % depth
  const widthIndex = Math.floor(flatIndex / depth) % width
  const heightIndex = Math.floor(flatIndex / (depth * width))
  return [heightIndex, widthIndex, depthIndex] as Index3D
}

function getUnits(layer: tf.layers.Layer) {
  if (["Flatten", "Dropout"].includes(layer.getClassName())) return 0
  const [, ...dims] = layer.outputShape as number[]
  return dims.reduce((a, b) => a * b, 1)
}

function getLayerPos(layerIndex: number, model: tf.LayersModel): LayerPos {
  if (layerIndex === 0) return "input"
  else if (layerIndex === model.layers.length - 1) return "output"
  else return "hidden"
}

function getInputNeurons(l: tf.layers.Layer, prev?: LayerStateless): Nid[][] {
  if (!prev) return []
  if (l.getClassName() !== "Conv2D" && l.getClassName() !== "MaxPooling2D") {
    // fully connected layer / Dense
    const shape = prev.tfLayer.outputShape as number[]
    const prevUnits = getUnits(prev.tfLayer)
    return Array.from({ length: getUnits(l) }).map(() =>
      Array.from({ length: prevUnits }).map((_, i) => {
        const index3d = getNeuronIndex3d(i, shape)
        return getNid(prev.index, index3d)
      })
    )
  }

  // Conv2D or MaxPooling2D
  // get the receptive field
  const [filterHeight, filterWidth] =
    (l.getConfig().kernelSize as number[]) ??
    (l.getConfig().poolSize as number[]) ??
    ([] as number[])
  const [strideHeight, strideWidth] = (l.getConfig().strides as number[]) ?? [
    1, 1,
  ]
  const filterSize = filterHeight * filterWidth

  const outputShape = l.outputShape as number[]
  const prevOutputShape = prev.tfLayer.outputShape as number[]
  const depth = prevOutputShape[3]

  const units = getUnits(l)

  const inputNids: Nid[][] = []
  // TODO: padding?
  for (let j = 0; j < units; j++) {
    const unitInputNids: Nid[] = []
    for (let k = 0; k < filterSize * depth; k++) {
      const [thisY, thisX, thisDepth] = getNeuronIndex3d(j, outputShape)
      const depthIndex = k % depth
      if (l.getClassName() === "MaxPooling2D" && depthIndex !== thisDepth)
        continue
      const widthIndex =
        thisX * strideWidth + (Math.floor(k / depth) % filterWidth)
      const heightIndex =
        thisY * strideHeight + Math.floor(k / (depth * filterWidth))
      const index3d = [heightIndex, widthIndex, depthIndex] as Index3D
      const inputNid = getNid(prev.index, index3d)
      if (!inputNid) {
        console.warn("no inputNid", { index3d })
        continue
      }
      unitInputNids.push(inputNid)
    }
    inputNids.push(unitInputNids)
  }
  return inputNids
}
