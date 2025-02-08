import { createRef, useEffect, useMemo, useState } from "react"
import * as tf from "@tensorflow/tfjs"
import { Index3D, Neuron, NeuronRefType, Nid } from "@/lib/neuron"
import { Dataset, useDatasetStore } from "@/data/datasets"
import { getMeshParams } from "./layer-layout"
import {
  LayerStateful,
  LayerPosition,
  LayerStateless,
  LayerType,
} from "@/three/layer"
import { debug } from "@/lib/debug"
import { useActivations } from "../tf/activations"

// TODO: fix rawInput

export function useLayerProps(
  isPending: boolean,
  model: tf.LayersModel | undefined,
  batchCount?: number
) {
  const ds = useDatasetStore((s) => s.ds)
  const input = useDatasetStore((s) => s.input)
  const rawInput = useDatasetStore((s) => s.rawInput)

  const layers = useStatelessLayers(model, ds)
  const activations = useActivations(model, input)
  const weightsBiases = useWeightsAndBiases(
    isPending,
    layers,
    model,
    batchCount
  )
  const statefulLayers = useStatefulLayers(
    layers,
    weightsBiases,
    activations,
    rawInput
  )
  const neuronRefs = useMemo(
    () => layers.map((layer) => layer.neurons.map((n) => n.ref)),
    [layers]
  )
  return [statefulLayers, neuronRefs] as const
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
  const className = layer.getClassName()
  const unitsFromConfig = layer.getConfig().units as number
  if (unitsFromConfig) {
    // dense
    return unitsFromConfig
  } else if (layer.batchInputShape) {
    // input layer
    const [, ...dims] = layer.batchInputShape
    const flattenedNumber = (dims as number[]).reduce((a, b) => a * b, 1)
    return flattenedNumber
  } else if (className === "Flatten") {
    // flatten layer
    // eturn typeof layer.outputShape[1] === "number" ? layer.outputShape[1] : 0
    return 0
  } else if (["Conv2D", "MaxPooling2D"].includes(className)) {
    // Conv2D, MaxPooling2D, etc.
    const [, ...dims] = layer.outputShape as number[] // [batch, height, width, channels]
    const flattenedNumber = dims.reduce((a, b) => a * b, 1)
    return flattenedNumber
  } else if (className === "Dropout") {
    return 0
  } else {
    console.log("unknown layer", { className })
    return 0
  }
}

export function getLayerPosition(
  layer: tf.layers.Layer,
  model: tf.LayersModel
): LayerPosition {
  const index = model.layers.indexOf(layer)
  const totalLayers = model.layers.length
  if (index === 0) return "input"
  if (index === totalLayers - 1) return "output"
  if (getUnits(layer) === 0) return "invisible"
  return "hidden"
}

function getInputNeurons(
  l: tf.layers.Layer,
  prevVisibleLayer: tf.layers.Layer | undefined,
  prevVisibleIndex: number | undefined
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
  // TODO: padding? use tensors to calculate the receptive field?
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

function useStatelessLayers(
  model: tf.LayersModel | undefined,
  ds?: Dataset
): LayerStateful[] {
  // here is all data that doesn't change for a given model
  return useMemo(() => {
    if (!model) return []
    const visibleLayers = model.layers.filter((l) => getUnits(l))

    return (
      model.layers.reduce((acc, tfLayer, layerIndex) => {
        const layerType = tfLayer.getClassName() as LayerType

        const visibleIndex = visibleLayers?.indexOf(tfLayer) // no ...
        const layerPos = getLayerPosition(tfLayer, model)

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

        const layerStateless: LayerStateless = {
          index: layerIndex,
          visibleIndex,
          layerType,
          layerPos,
          tfLayer,
          numBiases,
          prevLayer,
          prevVisibleLayer,
          meshParams,
          neurons: [],
          hasLabels:
            (layerPos === "input" && !!ds?.input?.labels?.length) ||
            (layerPos === "output" && !!ds?.output.labels?.length),
        }

        const neurons =
          Array.from({ length: units }).map((_, neuronIndex) => {
            const outputShape = tfLayer.outputShape as number[]
            const index3d = getNeuronIndex3d(neuronIndex, outputShape)
            const inputNids = layerInputNids?.[neuronIndex] ?? []
            return {
              nid: getNid(layerIndex, index3d),
              index: neuronIndex,
              index3d,
              layerIndex,
              visibleLayerIndex: visibleIndex,
              inputNids,
              inputNeurons: prevVisibleLayer
                ? (inputNids
                    .map((nid) => prevVisibleLayer.neuronsMap?.get(nid))
                    .filter(Boolean) as Neuron[])
                : [],
              ref: createRef<NeuronRefType>(),
              hasColorChannels: layerPos === "input" && outputShape[3] > 1,
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
        const groupCount = (tfLayer.outputShape?.[3] as number | undefined) ?? 1
        const groups = Array.from({ length: groupCount }).map((_, i) => {
          const groupedNeurons = neurons.filter(
            (n) => n.index % groupCount === i
          )
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
  weights?: number[][] | number[][][] // Dense vs Conv2D
  biases?: number[]
  maxAbsWeight?: number
}

function useWeightsAndBiases(
  isPending: boolean,
  layers: LayerStateless[],
  model?: tf.LayersModel,
  batchCount?: number
) {
  const [weightsBiases, setWeightsBiases] = useState<WeightsBiases[]>([])
  useEffect(() => {
    if (!model || isPending) return
    async function updateWeights() {
      const newStates = await Promise.all(
        layers.map(async (l) => {
          const { layerType, tfLayer } = l
          const [ws, bs, maw] = tf.tidy(() => {
            try {
              const [_weights, biases] = tfLayer.getWeights()
              const weights = _weights?.transpose()
              const maxAbsWeight = // needed only for dense connections
                layerType === "Dense"
                  ? (_weights?.abs().max() as tf.Tensor2D) // .dataSync()[0]
                  : undefined
              return [weights, biases, maxAbsWeight]
            } catch {
              // console.log("error getting weights", { l, e })
              return [undefined, undefined, undefined]
            }
          })
          try {
            await tf.ready()
            const weights = await ws?.array()
            const biases = await bs?.array()
            const maxAbsWeight = await maw?.array()
            return { weights, biases, maxAbsWeight } as WeightsBiases
          } catch (e) {
            console.log("error updating weights", { bs, ws, maw, e })
            return { weights: undefined, biases: undefined, maxAbsWeight: 0 }
          } finally {
            ws?.dispose()
            maw?.dispose()
          }
        })
      )
      if (debug()) console.log("newStates", newStates)
      setWeightsBiases(newStates)
    }
    updateWeights()
    // TODO: add trigger for update to dependencies
  }, [isPending, layers, model, batchCount])
  return weightsBiases
}

function useStatefulLayers(
  statelessLayers: LayerStateful[], // ??
  weightsBiases: WeightsBiases[],
  activations?: { activations: number[]; normalizedActivations: number[] }[],
  rawInput?: number[]
) {
  const statefulLayers = useMemo(() => {
    const startTime = Date.now()
    // if (!activations) return statelessLayers
    if (!weightsBiases.length) return statelessLayers
    const result = statelessLayers.reduce((acc, layer, i) => {
      const { layerPos, layerType } = layer

      // add state to each neuron

      const layerActivations = activations?.[i]?.activations
      const normalizedActivations =
        layerPos === "output"
          ? layerActivations
          : layerType === "Flatten"
          ? undefined
          : activations?.[i]?.normalizedActivations

      const prevActivations = activations?.[i - 1]?.activations // aka inputs

      const { weights, biases, maxAbsWeight } = weightsBiases[i] ?? {}

      /* const { transposedWeights, biasesArray, maxAbsWeight } = tf.tidy(() => {
        const [weights, biases] = tfLayer.getWeights()
        const transposedWeights = weights
          ?.transpose()
          .arraySync() as number[][][]
        const biasesArray = biases?.arraySync() as number[] | undefined

        const maxAbsWeight = // needed only for dense connections
          layerType === "Dense"
            ? (weights?.abs().max().dataSync()[0] as number | undefined)
            : undefined

        return { transposedWeights, biasesArray, maxAbsWeight }
      }) */

      const neurons: Neuron[] = statelessLayers[i].neurons.map((neuron, j) => {
        const activation = layerActivations?.[j]
        // Conv2D has parameter sharing: 1 bias per filter + [filterSize] weights
        const filterIndex = j % layer.numBiases // for dense layers this would be j
        const bias = biases?.[filterIndex]
        const thisWeights = weights?.[filterIndex]?.flat(2)
        const inputs =
          layer.layerType === "Dense"
            ? prevActivations
            : (neuron.inputNeurons?.map(
                // for Conv2D: only inputs from receptive field
                (n) => prevActivations?.[n.index]
              ) as number[])
        return {
          ...neuron,
          layerType,
          activation,
          rawInput: layer.layerPos === "input" ? rawInput?.[j] : undefined,
          normalizedActivation: normalizedActivations?.[j],
          bias,
          weights: thisWeights,
          inputs,
        }
      })
      const statefullLayer = {
        ...layer,
        neurons,
        neuronsMap: new Map(neurons.map((n) => [n.nid, n])),
        // ds, // replace with shape or whatever is needed
        maxAbsWeight,
      }
      return [...acc, statefullLayer]
    }, [] as LayerStateful[])
    const endTime = Date.now()

    if (debug())
      console.log(`LayerProps took ${endTime - startTime}ms`, { result })
    return result
  }, [statelessLayers, activations, weightsBiases, rawInput])

  return statefulLayers
}
