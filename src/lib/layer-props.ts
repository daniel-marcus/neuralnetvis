import { createRef, useMemo } from "react"
import * as tf from "@tensorflow/tfjs"
import { normalizeTensor } from "./normalization"
import { Index3D, Neuron, NeuronRefType, Nid } from "@/components/neuron"
import { Dataset } from "./datasets"
import { LayerLayout } from "./layer-layout"
import { LayerDef, LayerPosition, LayerType } from "@/components/layer"
import { DEBUG } from "@/lib/_debug"

// TODO: fix rawInput

type NeuronStem = {
  nid: Nid
  index: number
  index3d: Index3D
  layerIndex: number
  ref: React.RefObject<NeuronRefType>
  _inputNids: Nid[] // temporary, will be replaced by inputNeurons later
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

export function useLayerProps(
  model: tf.LayersModel | undefined,
  ds: Dataset | undefined,
  layerLayouts: LayerLayout[],
  activations: tf.Tensor[] // number[][]
  // rawInput?: LayerInput
) {
  const neuronStems = useNeuronStems(model)
  const layerProps = useMemo(() => {
    if (!model) return []
    const startTime = Date.now()
    const weightsAndBiases = getWeightsAndBiases(model)
    const visibleLayers = model.layers.filter((l) => getUnits(l))
    const result = model.layers.reduce((acc, l, i) => {
      const layerType = l.getClassName() as LayerType

      const visibleIndex = visibleLayers.indexOf(l)
      const layerPosition = getLayerPosition(l, model)
      const prevLayer = acc[i - 1]
      const prevVisibleTfLayer = getLastVisibleLayer(l, model)
      const prevVisibleIndex = prevVisibleTfLayer
        ? model.layers.indexOf(prevVisibleTfLayer)
        : undefined
      const prevVisibleLayer =
        typeof prevVisibleIndex !== "undefined"
          ? acc[prevVisibleIndex]
          : undefined
      const { geometry, spacing, positions: neuronPositions } = layerLayouts[i]
      const outputShape = l.outputShape as number[] // [batch, height, width, channels]

      const layerActivations = activations?.[i]?.dataSync() // as number[] | undefined
      const normalizedActivations =
        layerPosition === "output"
          ? layerActivations
          : layerType === "Flatten"
          ? undefined
          : normalizeTensor(activations?.[i]).dataSync()
      // const inputs = activations?.[i - 1]

      const { biases, weights } = weightsAndBiases[i]
      // Conv2D has parameter sharing: 1 bias per filter + [filterSize] weights
      // for Dense layers we just set "filters" to the number of units to get the right weights and biases with the same code
      const filters = (l.getConfig().filters as number) ?? getUnits(l)
      const flattenedWeights =
        (weights?.reshape([filters, -1]).arraySync() as number[][]) ?? []
      const biasesArray = biases?.arraySync() as number[] | undefined

      const maxAbsWeight = // needed only for dense connections
        layerType === "Dense"
          ? (weights?.abs().max().dataSync()[0] as number | undefined)
          : undefined

      const neurons: Neuron[] = neuronStems[i].map((neuronStem, j) => {
        const activation = layerActivations?.[j]
        const filterIndex = j % filters // for dense layers this would be j
        const bias = biasesArray?.[filterIndex]
        const thisWeights = flattenedWeights[filterIndex]
        return {
          ...neuronStem,
          visibleLayerIndex: visibleIndex,
          layerType,
          position: neuronPositions?.[j] ?? [0, 0, 0],
          activation,
          normalizedActivation: normalizedActivations?.[j],
          hasColorChannels: layerPosition === "input" && outputShape[3] > 1,
          prevLayer,
          prevVisibleLayer,
          bias,
          label:
            layerPosition === "output"
              ? ds?.output.labels?.[j]
              : layerPosition === "input"
              ? ds?.input?.labels?.[j]
              : undefined,
          weights: thisWeights,
          // inputs: inputs,
        }
      })
      const layer = {
        index: i,
        visibleIndex,
        layerType,
        layerPosition,
        tfLayer: l,
        prevLayer,
        prevVisibleLayer,
        neurons,
        neuronsMap: new Map(neurons.map((n) => [n.nid, n])),
        geometry,
        spacing,
        ds,
        maxAbsWeight,
      }
      return [...acc, layer]
    }, [] as LayerDef[])
    const endTime = Date.now()
    if (DEBUG)
      console.log(`LayerProps took ${endTime - startTime}ms`, { result })
    return result
  }, [activations, model, ds, layerLayouts, neuronStems])
  const neuronRefs = useMemo(
    () => neuronStems.map((layer) => layer.map((n) => n.ref)),
    [neuronStems]
  )
  return [layerProps, neuronRefs] as const
}

function getNid(layerIndex: number, index3d: Index3D) {
  return `${layerIndex}_${index3d.join(".")}` as Nid
}

export function getNeuronFromNidInLayer(nid: Nid, layer?: LayerDef) {
  return layer?.neurons.find((n) => n.nid === nid)
}

function getNeuronIndex3d(flatIndex: number, outputShape: number[]) {
  const [, , width = 1, depth = 1] = outputShape
  const depthIndex = flatIndex % depth
  const widthIndex = Math.floor(flatIndex / depth) % width
  const heightIndex = Math.floor(flatIndex / (depth * width))
  return [heightIndex, widthIndex, depthIndex] as Index3D
}

export function getVisibleLayers(allLayers: LayerDef[]) {
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

function getWeightsAndBiases(model: tf.LayersModel) {
  return model.layers.map((layer) => {
    const [weights, biases] = layer.getWeights()
    return { biases, weights }
  })
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

function useNeuronStems(model: tf.LayersModel | undefined): NeuronStem[][] {
  return useMemo(() => {
    return (
      model?.layers
        .reduce(
          (acc, layer, layerIndex) => {
            const units = getUnits(layer)
            const prevLayer = getLastVisibleLayer(layer, model)
            const prevIndex = prevLayer
              ? model.layers.indexOf(prevLayer)
              : undefined
            const layerInputNids = getInputNeurons(layer, prevLayer, prevIndex)

            const prev =
              typeof prevIndex === "number" ? acc[prevIndex] : undefined

            const neurons = Array.from({ length: units }).map((_, index) => {
              const outputShape = layer.outputShape as number[]
              const index3d = getNeuronIndex3d(index, outputShape)
              const _inputNids = layerInputNids?.[index] ?? []
              return {
                nid: getNid(layerIndex, index3d),
                index,
                index3d,
                layerIndex,
                _inputNids,
                inputNeurons: prev
                  ? _inputNids.map((nid) => prev.neuronsMap.get(nid))
                  : [],
                ref: createRef<NeuronRefType>(),
              }
            })
            const neuronsMap = new Map(neurons.map((n) => [n.nid, n]))
            return [...acc, { neurons, neuronsMap }]
          },
          [] as {
            neurons: NeuronStem[]
            neuronsMap: Map<Nid, NeuronStem>
          }[]
        )
        .map((o) => o.neurons) ?? []
    )
  }, [model])
}
