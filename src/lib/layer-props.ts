import { createRef, useEffect, useMemo, useState } from "react"
import * as tf from "@tensorflow/tfjs"
import { Index3D, Neuron, NeuronRefType, Nid } from "@/lib/neuron"
import { Dataset, useDatasetStore } from "@/data/datasets"
import { getMeshParams } from "./layer-layout"
import {
  LayerStateful,
  LayerPos,
  LayerStateless,
  LayerType,
} from "@/three/layer"
import { useActivations } from "../tf/activations"

export function useLayerProps(
  isPending: boolean,
  model?: tf.LayersModel,
  batchCount?: number
) {
  const { ds, input, rawInput } = useDatasetStore()
  const [_layers, neuronRefs] = useStatelessLayers(model, ds)
  const activations = useActivations(model, input)
  const weights = useWeights(isPending, model, batchCount)
  const layers = useStatefulLayers(_layers, weights, activations, rawInput)
  return [layers, neuronRefs] as const
}

function getNid(layerIndex: number, index3d: Index3D) {
  return `${layerIndex}_${index3d.join(".")}` as Nid
}

export function getNeuronFromNidInLayer(nid: Nid, layer?: LayerStateful) {
  return layer?.neurons.find((n) => n.nid === nid)
}

function getNeuronIndex3d(flatIndex: number, outputShape: number[]) {
  const [, , width = 1, depth = 1] = outputShape
  const depthIndex = flatIndex % depth
  const widthIndex = Math.floor(flatIndex / depth) % width
  const heightIndex = Math.floor(flatIndex / (depth * width))
  return [heightIndex, widthIndex, depthIndex] as Index3D
}

export function getVisibleLayers(allLayers: LayerStateful[]) {
  return allLayers.filter((l) => l.neurons.length)
}

export function getUnits(layer: tf.layers.Layer) {
  if (["Flatten", "Dropout"].includes(layer.getClassName())) return 0
  const [, ...dims] = layer.outputShape as number[]
  return dims.reduce((a, b) => a * b, 1)
}

function getLayerPos(layerIndex: number, model: tf.LayersModel): LayerPos {
  if (layerIndex === 0) return "input"
  else if (layerIndex === model.layers.length - 1) return "output"
  else return "hidden"
}

function getInputNeurons(
  l: tf.layers.Layer,
  prevVisibleLayer?: tf.layers.Layer,
  prevVisibleIndex?: number
): Nid[][] {
  if (!prevVisibleLayer || typeof prevVisibleIndex !== "number") return []
  if (l.getClassName() !== "Conv2D" && l.getClassName() !== "MaxPooling2D") {
    // fully connected layer / Dense
    const prevUnits = getUnits(prevVisibleLayer)
    return Array.from({ length: getUnits(l) }).map(() =>
      Array.from({ length: prevUnits }).map((_, i) => {
        const index3d = getNeuronIndex3d(
          i,
          prevVisibleLayer.outputShape as number[]
        )
        return getNid(prevVisibleIndex, index3d)
      })
    )
  }

  // Conv2D or MaxPooling2D
  // TODO: use tf.slice?

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
  const prevOutputShape = prevVisibleLayer.outputShape as number[]
  const depth = prevOutputShape[3]

  const units = getUnits(l)

  const inputNids: Nid[][] = []
  // TODO: padding? use tf to calculate the receptive field?
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
      const inputNid = getNid(prevVisibleIndex, index3d)
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

function useStatelessLayers(model: tf.LayersModel | undefined, ds?: Dataset) {
  // here is all data that doesn't change for a given model
  const layers = useMemo(() => {
    if (!model) return []
    const visibleLayers = model.layers.filter((l) => getUnits(l))

    return (
      model.layers.reduce((acc, tfLayer, layerIndex) => {
        const layerType = tfLayer.getClassName() as LayerType

        const visibleIdx = visibleLayers?.indexOf(tfLayer) // no ...
        const layerPos = getLayerPos(layerIndex, model)

        const prevLayer = acc[layerIndex - 1]
        const prevVisibleTfLayer = getLastVisibleLayer(tfLayer, model)
        const prevVisibleIndex = prevVisibleTfLayer
          ? model.layers.indexOf(prevVisibleTfLayer)
          : undefined
        const prevVisibleLayer =
          typeof prevVisibleIndex !== "undefined"
            ? acc[prevVisibleIndex]
            : undefined

        const units = getUnits(tfLayer)
        const meshParams = getMeshParams(tfLayer, layerPos, units)

        const layerInputNids = getInputNeurons(
          tfLayer,
          prevVisibleTfLayer,
          prevVisibleIndex
        )

        const numBiases = (tfLayer.getConfig().filters as number) ?? units

        const outputShape = tfLayer.outputShape as number[]

        const layerStateless: LayerStateless = {
          index: layerIndex,
          visibleIdx,
          layerType,
          layerPos,
          tfLayer,
          numBiases,
          prevLayer,
          prevVisibleLayer,
          meshParams,
          hasLabels:
            (layerPos === "input" && !!ds?.input?.labels?.length) ||
            (layerPos === "output" && !!ds?.output.labels?.length),
          hasColorChannels: layerPos === "input" && outputShape[3] > 1,
          neurons: [],
          groups: [],
        }

        const groupCount = (tfLayer.outputShape?.[3] as number | undefined) ?? 1

        const neurons =
          Array.from({ length: units }).map((_, neuronIndex) => {
            const index3d = getNeuronIndex3d(neuronIndex, outputShape)
            const inputNids = layerInputNids?.[neuronIndex] ?? []
            return {
              nid: getNid(layerIndex, index3d),
              index: neuronIndex,
              index3d,
              layerIndex,
              groupIndex: neuronIndex % groupCount,
              visibleLayerIndex: visibleIdx,
              inputNids,
              inputNeurons: prevVisibleLayer
                ? (inputNids
                    .map((nid) => prevVisibleLayer.neuronsMap?.get(nid))
                    .filter(Boolean) as Neuron[])
                : [],
              ref: createRef<NeuronRefType>(),
              label:
                layerPos === "output"
                  ? ds?.output.labels?.[neuronIndex]
                  : layerPos === "input"
                  ? ds?.input?.labels?.[neuronIndex]
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
            nids,
            nidsStr,
          }
        })
        const layer = {
          ...layerStateless,
          neurons,
          neuronsMap,
          groups,
        }
        return [...acc, layer]
      }, [] as LayerStateful[]) ?? []
    )
  }, [model, ds])

  const neuronRefs = useMemo(
    () => layers.map((layer) => layer.neurons.map((n) => n.ref)),
    [layers]
  )

  return [layers, neuronRefs] as const
}

function getLastVisibleLayer(
  l: tf.layers.Layer | undefined,
  model: tf.LayersModel
) {
  if (!l) return
  const prev = model.layers[model.layers.indexOf(l) - 1]
  if (!prev) return
  else if (getUnits(prev)) return prev
  else return getLastVisibleLayer(prev, model)
}

interface WeightsBiases {
  weights?: number[][] // weights per neuron / filter
  biases?: number[]
  maxAbsWeight?: number
}

function useWeights(
  isPending: boolean,
  model?: tf.LayersModel,
  batchCount?: number
) {
  const [weightsBiases, setWeightsBiases] = useState<WeightsBiases[]>([])
  useEffect(() => {
    if (!model || isPending) return
    async function updateWeights() {
      if (!model) return
      const _newStates = model.layers.map((l) => {
        return tf.tidy(() => {
          const [_weights, biases] = l.getWeights()
          const numWeights = _weights?.shape[_weights?.shape.length - 1]
          const weights = _weights?.transpose().reshape([numWeights, -1])
          const maxAbsWeight = // needed only for dense connections
            l.getClassName() === "Dense" ? _weights?.abs().max() : undefined
          return { weights, biases, maxAbsWeight } as const
        })
      })

      try {
        const newStates = await Promise.all(
          _newStates.map(async (l) => ({
            weights: (await l.weights?.array()) as number[][] | undefined,
            biases: (await l.biases?.array()) as number[] | undefined,
            maxAbsWeight: (await l.maxAbsWeight?.array()) as number | undefined,
          }))
        )
        setWeightsBiases(newStates)
      } catch (e) {
        console.log("Error updating weights", e)
      } finally {
        _newStates.forEach((l) => {
          l.weights?.dispose()
          // l.biases?.dispose()
          l.maxAbsWeight?.dispose()
        })
      }
    }
    updateWeights()
  }, [isPending, model, batchCount])
  return weightsBiases
}

function useStatefulLayers(
  statelessLayers: LayerStateless[],
  weightsBiases: WeightsBiases[],
  activations?: { activations: number[]; normalizedActivations: number[] }[],
  rawInput?: number[]
) {
  const statefulLayers = useMemo(
    () =>
      statelessLayers.reduce((acc, layer, lIdx) => {
        const { layerPos, layerType } = layer

        // add state to each neuron
        const layerActivations = activations?.[lIdx]?.activations
        const normalizedActivations =
          layerPos === "output"
            ? layerActivations
            : layerType === "Flatten"
            ? undefined
            : activations?.[lIdx]?.normalizedActivations

        const { weights, biases, maxAbsWeight } = weightsBiases[lIdx] ?? {}

        const neurons: Neuron[] = statelessLayers[lIdx].neurons.map(
          (neuron, nIdx) => {
            const activation = layerActivations?.[nIdx]
            // Conv2D has parameter sharing: 1 bias per filter + [filterSize] weights
            const filterIndex = nIdx % layer.numBiases // for dense layers this would be nIdx
            const statefulNeuron = {
              ...neuron,
              activation,
              rawInput:
                layer.layerPos === "input" ? rawInput?.[nIdx] : undefined,
              normalizedActivation: normalizedActivations?.[nIdx],
              weights: weights?.[filterIndex],
              bias: biases?.[filterIndex],
            }
            return statefulNeuron
          }
        )
        const statefulLayer = {
          ...layer,
          neurons,
          maxAbsWeight,
        }
        return [...acc, statefulLayer]
      }, [] as LayerStateful[]),
    [statelessLayers, activations, weightsBiases, rawInput]
  )
  return statefulLayers
}
