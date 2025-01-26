import { createRef, useMemo } from "react"
import * as tf from "@tensorflow/tfjs"
import { Index3D, Neuron, NeuronRefType, Nid } from "@/components/neuron"
import { Dataset, LayerInput } from "./datasets"
import { getGeometryAndSpacing } from "./layer-layout"
import {
  LayerStateful,
  LayerPosition,
  LayerStatic,
  LayerType,
} from "@/components/layer"
import { DEBUG } from "@/lib/_debug"
import { useActivations } from "./activations"

// TODO: fix rawInput

export function useLayerProps(
  model: tf.LayersModel | undefined,
  ds: Dataset | undefined,
  input: LayerInput | undefined
  // rawInput?: LayerInput
) {
  const statelessLayers = useStatelessLayers(model, ds)
  const activations = useActivations(model, input)
  const statefulLayers = useStatefulLayers(statelessLayers, activations)
  const neuronRefs = useMemo(
    () => statelessLayers.map((layer) => layer.neurons.map((n) => n.ref)),
    [statelessLayers]
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
  const unitsFromConfig = layer.getConfig().units as number
  if (unitsFromConfig) {
    // dense
    return unitsFromConfig
  } else if (layer.batchInputShape) {
    // input layer
    const [, ...dims] = layer.batchInputShape
    const flattenedNumber = (dims as number[]).reduce((a, b) => a * b, 1)
    return flattenedNumber
  } else if (layer.getClassName() === "Flatten") {
    // flatten layer
    // eturn typeof layer.outputShape[1] === "number" ? layer.outputShape[1] : 0
    return 0
  }
  // Conv2D, MaxPooling2D, etc.
  const [, ...dims] = layer.outputShape as number[] // [batch, height, width, channels]
  const flattenedNumber = dims.reduce((a, b) => a * b, 1)
  return flattenedNumber
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

  // the receptive field
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
        const [geometry, spacing] = getGeometryAndSpacing(
          tfLayer,
          layerPos,
          units
        )

        const layerInputNids = getInputNeurons(
          tfLayer,
          prevVisibleTfLayer,
          prevVisibleIndex
        )

        const layerStatic: LayerStatic = {
          index: layerIndex,
          visibleIndex,
          layerType,
          layerPos,
          tfLayer,
          prevLayer,
          prevVisibleLayer,
          geometry,
          spacing,
          neurons: [],
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
              layer: layerStatic,
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
          ...layerStatic,
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

function useStatefulLayers(
  statelessLayers: LayerStateful[],
  activations?: { activations: number[]; normalizedActivations: number[] }[]
) {
  const statefulLayers = useMemo(() => {
    const startTime = Date.now()
    if (!activations) return statelessLayers
    const result = statelessLayers.reduce((acc, layer, i) => {
      const { tfLayer, layerPos, layerType } = layer
      const units = layer.neurons.length

      // add state to each neuron

      const layerActivations = activations?.[i]?.activations
      const normalizedActivations =
        layerPos === "output"
          ? layerActivations
          : layerType === "Flatten"
          ? undefined
          : activations?.[i]?.normalizedActivations

      const inputs = activations?.[i - 1]?.activations

      const { transposedWeights, biasesArray, maxAbsWeight } = tf.tidy(() => {
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
      })
      // Conv2D has parameter sharing: 1 bias per filter + [filterSize] weights
      // for Dense layers we just set "filters" to the number of units to get the right weights and biases with the same code
      const filters = (tfLayer.getConfig().filters as number) ?? units

      const neurons: Neuron[] = statelessLayers[i].neurons.map((neuron, j) => {
        const activation = layerActivations?.[j]
        const filterIndex = j % filters // for dense layers this would be j
        const bias = biasesArray?.[filterIndex]
        const thisWeights = transposedWeights?.[filterIndex].flat(2)
        return {
          ...neuron,
          layerType,
          activation,
          normalizedActivation: normalizedActivations?.[j],
          bias,
          weights: thisWeights,
          inputs: inputs,
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

    if (DEBUG)
      console.log(`LayerProps took ${endTime - startTime}ms`, { result })
    return result
  }, [statelessLayers, activations])

  return statefulLayers
}
