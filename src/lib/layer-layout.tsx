import type { LayerPosition } from "@/three/layer"
import * as tf from "@tensorflow/tfjs"
import { ReactElement } from "react"
import * as THREE from "three"

export interface LayerLayout {
  geometry: ReactElement
  spacing: number
}

type OutputOrient = "horizontal" | "vertical"
export const OUTPUT_ORIENT: OutputOrient = "vertical"
export type SpacingType = "dense" | "normal"

export type MeshParams = {
  geometry: THREE.BoxGeometry | THREE.SphereGeometry
  spacingFactor?: number
}

// TODO: reuse geometry and add scale?
const meshMap: Record<string, MeshParams> = {
  sphere: {
    geometry: new THREE.SphereGeometry(0.6, 32, 32),
    spacingFactor: 2.7,
  },
  boxSmall: {
    geometry: new THREE.BoxGeometry(0.6, 0.6, 0.6),
  },
  boxBig: {
    geometry: new THREE.BoxGeometry(1.8, 1.8, 1.8),
    spacingFactor: 1.5,
  },
  boxTiny: {
    geometry: new THREE.BoxGeometry(0.2, 0.2, 0.2),
  },
}

export function getMeshParams(
  layer: tf.layers.Layer,
  layerPos: LayerPosition,
  units: number
): MeshParams {
  if (["input", "output"].includes(layerPos)) {
    if (units <= 10) return meshMap.boxBig
    return meshMap.boxSmall
  } else if (
    layer.getClassName() === "Conv2D" ||
    layer.getClassName() === "MaxPooling2D"
  ) {
    return meshMap.boxTiny
  }
  return meshMap.sphere
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
    ? getLineXYZ(i, total, spacing)
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
  spacing: number,
  orient: OutputOrient = "vertical"
): [number, number, number] {
  const NEURON_SPACING = spacing
  const offsetY = (total - 1) * NEURON_SPACING * -0.5
  const factor = orient === "vertical" ? -1 : 1 // reverse
  const y = (i * NEURON_SPACING + offsetY) * factor
  const z = 0
  return orient === "vertical" ? ([0, y, z] as const) : ([0, z, y] as const)
}
