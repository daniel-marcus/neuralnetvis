import * as tf from "@tensorflow/tfjs"
import * as THREE from "three"
import type { ReactElement } from "react"
import type { LayerPos } from "./types"

export interface LayerLayout {
  geometry: ReactElement
  spacing: number
}

export type MeshParams = {
  geometry: THREE.BoxGeometry | THREE.SphereGeometry
  spacingFactor?: number
  labelSize?: number
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
  boxBig: {
    geometry: new THREE.BoxGeometry(2, 2, 2),
    spacingFactor: 1.4,
    labelSize: 1,
  },
  boxSmall: {
    geometry: new THREE.BoxGeometry(0.6, 0.6, 0.6),
    labelSize: 0.4,
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
  const className = layer.getClassName()
  // const layerDef = getLayerDef(className)
  if (["input", "output"].includes(layerPos)) {
    if (units <= 12) return meshMap.boxBig
    else if (units > 3072) return meshMap.boxTiny
    else return meshMap.boxSmall
  } else if (className === "Dense") {
    if (units <= 128) return meshMap.sphere
    else return meshMap.sphereSmall
  } else {
    return meshMap.boxTiny
  }
}

const MAX_SINGLE_COL_HEIGHT = 25

export function getGridSize(
  height: number,
  width: number,
  neuronSpacing: number = 1.8,
  additionalSpacing = 0
) {
  const totalHeight = height * neuronSpacing + additionalSpacing
  const totalWidth = width * neuronSpacing + additionalSpacing
  return [totalHeight, totalWidth]
}

export function getNeuronPos(
  i: number,
  layerPos: LayerPos,
  height: number,
  width: number = 1,
  channels: number = 1,
  spacing: number
) {
  const mustBeColumn =
    (layerPos === "output" || layerPos === "input") && width === 1
  if (channels === 1) return getGridXYZ(i, height, width, spacing, mustBeColumn)
  else {
    const idx = Math.floor(i / channels)
    const [x, _y, _z] = getGridXYZ(idx, height, width, spacing, mustBeColumn)

    const groupIndex = i % channels

    const GRID_SPACING = 0.3
    const [gHeight, gWidth] = getGridSize(height, width, spacing, GRID_SPACING)
    const groupsPerRow = Math.ceil(Math.sqrt(channels))
    const groupsPerColumn = Math.ceil(channels / groupsPerRow)
    const offsetY = (groupsPerColumn - 1) * gHeight * 0.5
    const offsetZ = (groupsPerRow - 1) * gWidth * -0.5
    const y =
      _y + -1 * Math.floor(groupIndex / groupsPerRow) * gHeight + offsetY // row
    const z = _z + (groupIndex % groupsPerRow) * gWidth + offsetZ // column

    return [x, y, z] as [number, number, number]
  }
}

function getGridXYZ(
  i: number,
  height: number,
  width: number,
  spacing: number,
  forceColumns = false
): [number, number, number] {
  const total = height * width
  let zSpacing = spacing
  if (width === 1) {
    if (forceColumns) {
      height = Math.min(MAX_SINGLE_COL_HEIGHT, height)
      width = Math.ceil(total / height)
      zSpacing = 5
    } else {
      // convert 1D column to 2D grid
      width = Math.ceil(Math.sqrt(total))
      height = Math.ceil(total / width)
    }
  }
  const offsetY = (height - 1) * spacing * 0.5
  const offsetZ = (width - 1) * zSpacing * -0.5

  const y = -1 * Math.floor(i / width) * spacing + offsetY // row
  const z = (i % width) * zSpacing + offsetZ // column

  return [0, y, z] as [number, number, number]
}
