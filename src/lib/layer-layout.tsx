import { LayerDef } from "@/components/layer"
import {
  getLayerPosition,
  getUnits,
  getVisibleLayers,
  LayerPosition,
} from "@/lib/layer-props"
import * as tf from "@tensorflow/tfjs"
import { ReactElement, useMemo } from "react"

export interface LayerLayout {
  geometry: ReactElement
  spacing: number
  positions: [number, number, number][]
}

export function useLayerLayout(model?: tf.LayersModel) {
  const layerLayout: LayerLayout[] = useMemo(
    () =>
      model?.layers.map((l) => {
        const layerPosition = getLayerPosition(l, model)
        const [geometry, spacing] = getGeometryAndSpacing(
          l,
          layerPosition,
          getUnits(l)
        )
        const positions = getNeuronPositions(l, model, spacing)
        return { geometry, spacing, positions }
      }) ?? [],
    [model]
  )
  return layerLayout
}

export const LAYER_SPACING = 11
type OutputOrient = "horizontal" | "vertical"
export const OUTPUT_ORIENT: OutputOrient = "vertical"
export type SpacingType = "dense" | "normal"

const geometryMap: Record<string, ReactElement> = {
  boxSmall: <boxGeometry args={[0.6, 0.6, 0.6]} />,
  boxBig: <boxGeometry args={[1.8, 1.8, 1.8]} />,
  boxTiny: <boxGeometry args={[0.3, 0.3, 0.3]} />,
  sphere: <sphereGeometry args={[0.6, 32, 32]} />,
}

function getGeometryAndSpacing(
  layer: tf.layers.Layer,
  layerPosition: LayerPosition,
  units: number
): [ReactElement, number] {
  if (["input", "output"].includes(layerPosition)) {
    if (units <= 10) return [geometryMap.boxBig, 1.8]
    return [geometryMap.boxSmall, 0.7]
  } else if (layer.getClassName() === "Flatten") {
    return [geometryMap.boxSmall, 0.7]
  } else if (
    layer.getClassName() === "Conv2D" ||
    layer.getClassName() === "MaxPooling2D"
  ) {
    return [geometryMap.boxTiny, 0.34]
  }
  return [geometryMap.sphere, 1.8]
}

export function getOffsetX(_layerIndex: number, allLayers: LayerDef[]) {
  const visibleLayers = getVisibleLayers(allLayers)
  const layerIndex = visibleLayers.indexOf(allLayers[_layerIndex])
  const totalLayers = visibleLayers.length
  return layerIndex * LAYER_SPACING + (totalLayers - 1) * LAYER_SPACING * -0.5
}

function getNeuronPositions(
  layer: tf.layers.Layer,
  model: tf.LayersModel,
  spacing: number
) {
  const units = getUnits(layer)
  const type = getLayerPosition(layer, model)
  const offsetX = 0 // control offsetX with groups in Layer component
  const colorChannels = model.layers[0].batchInputShape?.[3] ?? 1
  const outputChannels = (layer.outputShape?.[3] as number | undefined) ?? 1
  const positions = Array.from({ length: units }).map((_, i) => {
    const [x, y, z] =
      type === "output"
        ? getLineXYZ(i, units, OUTPUT_ORIENT)
        : type === "input" && units <= 10
        ? getLineXYZ(i, units, "vertical")
        : type === "input"
        ? getGroupedGridXYZ(i, units, spacing, colorChannels, false) // splitColors
        : getGroupedGridXYZ(i, units, spacing, outputChannels, false)
    return [x + offsetX, y, z] as [number, number, number]
  })
  return positions
}

export function getGridWidth(
  total: number,
  spacing: number = 1.8 // 0.7
) {
  const gridSize = Math.ceil(Math.sqrt(total))
  return gridSize * spacing
}

function getGroupedGridXYZ(
  _i: number,
  _total: number,
  spacing: number,
  groupSize = 1,
  split = false
): [number, number, number] {
  const total = Math.ceil(_total / groupSize)
  const i = Math.floor(_i / groupSize)
  const rest = _i % groupSize
  const gridSize = Math.ceil(Math.sqrt(total))
  const NEURON_SPACING = spacing
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
