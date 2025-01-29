import type { LayerPosition } from "@/components/layer"
import * as tf from "@tensorflow/tfjs"
import { ReactElement } from "react"

export interface LayerLayout {
  geometry: ReactElement
  spacing: number
}

type OutputOrient = "horizontal" | "vertical"
export const OUTPUT_ORIENT: OutputOrient = "vertical"
export type SpacingType = "dense" | "normal"

const geometryMap: Record<string, ReactElement> = {
  sphere: <sphereGeometry args={[0.6, 32, 32]} />,
  boxSmall: <boxGeometry args={[0.6, 0.6, 0.6]} />,
  boxBig: <boxGeometry args={[1.8, 1.8, 1.8]} />,
  boxTiny: <boxGeometry args={[0.2, 0.2, 0.22]} />,
}

export function getGeometryAndSpacing(
  layer: tf.layers.Layer,
  layerPos: LayerPosition,
  units: number
): [ReactElement, number] {
  if (["input", "output"].includes(layerPos)) {
    if (units <= 10) return [geometryMap.boxBig, 1.8]
    return [geometryMap.boxSmall, 0.66]
  } else if (
    layer.getClassName() === "Conv2D" ||
    layer.getClassName() === "MaxPooling2D"
  ) {
    return [geometryMap.boxTiny, 0.22]
  }
  return [geometryMap.sphere, 1.8]
}

export function getOffsetX(
  visibleIndex: number,
  totalVisibleLayers: number,
  layerSpacing: number = 10
) {
  return (
    visibleIndex * layerSpacing + (totalVisibleLayers - 1) * layerSpacing * -0.5
  )
}

const MAX_SINGLE_COL_HEIGHT = 10

export function getGridSize(
  height: number,
  width: number,
  spacing: number = 1.8 // 0.7
) {
  const total = height * width
  if (width === 1 && total > MAX_SINGLE_COL_HEIGHT) {
    // 1D column as 2D grid when > 10 neurons
    width = Math.ceil(Math.sqrt(total))
    height = Math.ceil(total / width)
  }
  const totalHeight = height * spacing
  const totalWidth = width * spacing
  return [totalHeight, totalWidth]
}

export function getNeuronPosition(
  i: number,
  layerPos: LayerPosition,
  height: number,
  width: number = 1,
  spacing: number
) {
  const total = height * width
  return layerPos === "output" || (layerPos === "input" && total <= 10)
    ? getLineXYZ(i, total)
    : getGroupedGridXYZ(i, height, width, spacing)
}

export function getGroupedGridXYZ(
  i: number,
  height: number,
  width: number,
  spacing: number
): [number, number, number] {
  const total = height * width
  if (width === 1 && total > MAX_SINGLE_COL_HEIGHT) {
    // 1D column as 2D grid when > 10 neurons
    width = Math.ceil(Math.sqrt(total))
    height = Math.ceil(total / width)
  }
  const NEURON_SPACING = spacing
  const offsetY = (height - 1) * NEURON_SPACING * 0.5
  const offsetZ = (width - 1) * NEURON_SPACING * -0.5

  const y = -1 * Math.floor(i / width) * NEURON_SPACING + offsetY // row
  const z = (i % width) * NEURON_SPACING + offsetZ // column

  return [0, y, z] as const
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
