import { LayerDef } from "@/components/layer"
import { getLayerPosition, getUnits, LayerPosition } from "@/lib/layer-props"
import * as tf from "@tensorflow/tfjs"
import { useMemo } from "react"

export function useNeuronPositions(model?: tf.LayersModel) {
  const neuronPositions = useMemo(
    () => model?.layers.map((l) => getNeuronPositions(l, model)),
    [model]
  )
  return neuronPositions
}

export const LAYER_SPACING = 11
type OutputOrient = "horizontal" | "vertical"
export const OUTPUT_ORIENT: OutputOrient = "vertical"

export function getOffsetX(_layerIndex: number, allLayers: LayerDef[]) {
  const visibleLayers = allLayers.filter((l) => l.neurons.length)
  const layerIndex = visibleLayers.indexOf(allLayers[_layerIndex])
  const totalLayers = visibleLayers.length
  return layerIndex * LAYER_SPACING + (totalLayers - 1) * LAYER_SPACING * -0.5
}

function getNeuronPositions(layer: tf.layers.Layer, model: tf.LayersModel) {
  const units = getUnits(layer)
  const type = getLayerPosition(layer, model)
  const offsetX = 0 // control offsetX with groups in Layer component
  const colorChannels = model.layers[0].batchInputShape?.[3] ?? 1
  const positions = Array.from({ length: units }).map((_, i) => {
    const [x, y, z] =
      type === "output"
        ? getLineXYZ(i, units, OUTPUT_ORIENT)
        : type === "input" && units <= 10
        ? getLineXYZ(i, units, "vertical")
        : type === "input"
        ? getGroupedGridXYZ(i, units, type, colorChannels, false) // splitColors
        : getGroupedGridXYZ(i, units, type)
    return [x + offsetX, y, z] as [number, number, number]
  })
  return positions
}

function getNeuronSpacing(layerPosition: LayerPosition) {
  return layerPosition === "input" ? 0.7 : 1.8
}

export function getGridWidth(total: number, layerPosition: LayerPosition) {
  const gridSize = Math.ceil(Math.sqrt(total))
  const NEURON_SPACING = getNeuronSpacing(layerPosition)
  return gridSize * NEURON_SPACING
}

function getGroupedGridXYZ(
  _i: number,
  _total: number,
  type: LayerPosition,
  groupSize = 1,
  split = false
): [number, number, number] {
  const total = Math.ceil(_total / groupSize)
  const i = Math.floor(_i / groupSize)
  const rest = _i % groupSize
  const gridSize = Math.ceil(Math.sqrt(total))
  const NEURON_SPACING = getNeuronSpacing(type)
  const offsetY = (gridSize - 1) * NEURON_SPACING * 0.5
  const offsetZ = (gridSize - 1) * NEURON_SPACING * -0.5

  const y = -1 * Math.floor(i / gridSize) * NEURON_SPACING + offsetY // row
  const z = (i % gridSize) * NEURON_SPACING + offsetZ // column

  // shift now done in neuron group
  const shiftMatrix = split ? [0, 0, 2 * (offsetZ - NEURON_SPACING)] : [0, 0, 0]
  const [shiftX, shiftY, shiftZ] = shiftMatrix.map(
    (v) => -v * (rest - (groupSize - 1) / 2)
  )

  return [shiftX, y + shiftY, z + shiftZ] as const
}

function getLineXYZ(
  i: number,
  total: number,
  orient: OutputOrient = "vertical"
): [number, number, number] {
  const NEURON_SPACING = 3
  const offsetY = (total - 1) * NEURON_SPACING * -0.5
  const factor = orient === "vertical" ? -1 : 1 // reverse
  const y = (i * NEURON_SPACING + offsetY) * factor
  const z = 0
  return orient === "vertical" ? ([0, y, z] as const) : ([0, z, y] as const)
}
