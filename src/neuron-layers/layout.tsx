import * as tf from "@tensorflow/tfjs"
import * as THREE from "three"
import type { LayerPos } from "./types"

export interface MeshParams {
  geometry: THREE.BufferGeometry
  spacingFactor?: number
  labelSize?: number
}

const meshMap: Record<string, MeshParams> = {
  sphere: {
    geometry: new THREE.SphereGeometry(0.6, 32, 32),
    spacingFactor: 1.4,
  },
  sphereSmall: {
    geometry: new THREE.SphereGeometry(0.35, 32, 32),
    spacingFactor: 1.2,
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
  cellSize: number,
  additionalSpacing = 0
) {
  const totalHeight = height * cellSize + additionalSpacing
  const totalWidth = width * cellSize + additionalSpacing
  return [totalHeight, totalWidth]
}

export function getNeuronPos(
  i: number,
  layerPos: LayerPos,
  height: number,
  width: number = 1,
  channels: number = 1,
  spacedSize: number
) {
  const mustBeColumn =
    (layerPos === "output" || layerPos === "input") && width === 1
  if (channels === 1)
    return getGridXYZ(i, height, width, spacedSize, mustBeColumn)
  else {
    const idx = Math.floor(i / channels)
    const [x, _y, _z] = getGridXYZ(idx, height, width, spacedSize, mustBeColumn)

    const channelIdx = i % channels

    const [gHeight, gWidth] = getGridSize(height, width, spacedSize, spacedSize)
    const cellsPerRow = Math.ceil(Math.sqrt(channels))
    const cellsPerColumn = Math.ceil(channels / cellsPerRow)
    const offsetY = (cellsPerColumn - 1) * gHeight * 0.5
    const offsetZ = (cellsPerRow - 1) * gWidth * -0.5
    const y = _y + -1 * Math.floor(channelIdx / cellsPerRow) * gHeight + offsetY // row
    const z = _z + (channelIdx % cellsPerRow) * gWidth + offsetZ // column

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
      zSpacing = 5 // space between columns
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
