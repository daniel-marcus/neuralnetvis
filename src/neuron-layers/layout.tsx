import * as tf from "@tensorflow/tfjs"
import * as THREE from "three"
import type { ReactElement } from "react"
import type { LayerPos } from "./types"

export interface LayerLayout {
  geometry: ReactElement
  spacing: number
}

type OutputOrient = "horizontal" | "vertical"
export const OUTPUT_ORIENT: OutputOrient = "vertical"

export type MeshParams = {
  geometry: THREE.BoxGeometry | THREE.SphereGeometry
  spacingFactor?: number
}

const meshMap: Record<string, MeshParams> = {
  sphere: {
    geometry: new THREE.SphereGeometry(0.6, 32, 32),
    spacingFactor: 2.7,
  },
  sphereSmall: {
    geometry: new THREE.SphereGeometry(0.35, 32, 32),
    spacingFactor: 2.3,
  },
  boxSmall: {
    geometry: new THREE.BoxGeometry(0.6, 0.6, 0.6),
  },
  boxBig: {
    geometry: new THREE.BoxGeometry(2, 2, 2),
    spacingFactor: 1.4,
  },
  boxTiny: {
    geometry: new THREE.BoxGeometry(0.18, 0.18, 0.18),
  },
}

export function getMeshParams(
  layer: tf.layers.Layer,
  layerPos: LayerPos,
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
  } else {
    if (units <= 128) return meshMap.sphere
    else return meshMap.sphereSmall
  }
}

const MAX_SINGLE_COL_HEIGHT = 10

export function getGridSize(
  height: number,
  width: number,
  neuronSpacing: number = 1.8,
  additionalSpacing = 0
) {
  const total = height * width
  if (width === 1 && total > MAX_SINGLE_COL_HEIGHT) {
    // 1D column as 2D grid when > 10 neurons
    width = Math.ceil(Math.sqrt(total))
    height = Math.ceil(total / width)
  }
  const totalHeight = height * neuronSpacing + additionalSpacing
  const totalWidth = width * neuronSpacing + additionalSpacing
  return [totalHeight, totalWidth]
}

export function getNeuronPos(
  i: number,
  layerPos: LayerPos,
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
