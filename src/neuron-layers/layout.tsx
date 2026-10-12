import type * as tf from "@tensorflow/tfjs"
import * as THREE from "three/webgpu"
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
  units: number,
): MeshParams {
  const is1D = layer.outputShape.length === 2
  if (layerPos === "input") {
    if (units <= 12) return meshMap.boxBig
    else if (units > 3072) return meshMap.boxTiny
    else return meshMap.boxSmall
  } else if (layerPos === "output") {
    return meshMap.boxBig
  } else if (is1D) {
    // e.g. Dense, GlobalAveragePooling1D, ...
    if (units <= 128) return meshMap.sphere
    else return meshMap.sphereSmall
  } else {
    return meshMap.boxTiny
  }
}

export function getNeuronSize({ geometry, spacingFactor }: MeshParams, neuronSpacing: number) {
  const size =
    geometry instanceof THREE.BoxGeometry
      ? geometry.parameters.width
      : geometry instanceof THREE.SphereGeometry
        ? geometry.parameters.radius * 2
        : 1
  const spacedSize = size * neuronSpacing * (spacingFactor ?? 1)
  return { size, spacedSize }
}

const MAX_SINGLE_COL_HEIGHT = 25

export function getGridSize(
  height: number,
  width: number,
  cellSize: number,
  additionalSpacing = 0,
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
  spacedSize: number,
) {
  const forceColumns = (layerPos === "output" || layerPos === "input") && width === 1
  if (channels === 1) return getGridXYZ(i, height, width, spacedSize, forceColumns)
  else {
    const idx = Math.floor(i / channels)
    const [x, _y, _z] = getGridXYZ(idx, height, width, spacedSize, forceColumns)

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

// inverse of getNeuronPos: neuron index at the given position within the layer plane (undefined: no neuron)
export function getNeuronIdxAt(
  y: number,
  z: number,
  layerPos: LayerPos,
  height: number,
  width: number = 1,
  channels: number = 1,
  spacedSize: number,
) {
  const forceColumns = (layerPos === "output" || layerPos === "input") && width === 1
  if (channels === 1) return getGridIdx(y, z, height, width, spacedSize, forceColumns)

  const [gHeight, gWidth] = getGridSize(height, width, spacedSize, spacedSize)
  const cellsPerRow = Math.ceil(Math.sqrt(channels))
  const cellsPerColumn = Math.ceil(channels / cellsPerRow)
  const offsetY = (cellsPerColumn - 1) * gHeight * 0.5
  const offsetZ = (cellsPerRow - 1) * gWidth * -0.5
  const cellRow = Math.round((offsetY - y) / gHeight)
  const cellCol = Math.round((z - offsetZ) / gWidth)
  if (cellRow < 0 || cellCol < 0 || cellCol >= cellsPerRow) return undefined
  const channelIdx = cellRow * cellsPerRow + cellCol
  if (channelIdx >= channels) return undefined

  const cellY = y - (offsetY - cellRow * gHeight)
  const cellZ = z - (offsetZ + cellCol * gWidth)
  const idx = getGridIdx(cellY, cellZ, height, width, spacedSize, forceColumns)
  return typeof idx === "number" ? idx * channels + channelIdx : undefined
}

function getGridDims(height: number, width: number, spacing: number, forceColumns = false) {
  const total = height * width
  let zSpacing = spacing
  if (width === 1) {
    if (forceColumns) {
      height = Math.min(MAX_SINGLE_COL_HEIGHT, height)
      width = Math.ceil(total / height)
      zSpacing = 4 // space between columns
    } else {
      // convert 1D column to 2D grid
      width = Math.ceil(Math.sqrt(total))
      height = Math.ceil(total / width)
    }
  }
  return { total, height, width, zSpacing }
}

// inverse of getGridXYZ
function getGridIdx(
  y: number,
  z: number,
  _height: number,
  _width: number,
  spacing: number,
  forceColumns = false,
) {
  const { total, height, width, zSpacing } = getGridDims(_height, _width, spacing, forceColumns)
  const row = Math.round(((height - 1) * spacing * 0.5 - y) / spacing)
  const col = Math.round((z + (width - 1) * zSpacing * 0.5) / zSpacing)
  if (row < 0 || row >= height || col < 0 || col >= width) return undefined
  const colZ = col * zSpacing + (width - 1) * zSpacing * -0.5
  if (Math.abs(z - colZ) > spacing * 0.5) return undefined // between spaced columns
  const i = row * width + col + 0 // no negative zero
  return i < total ? i : undefined
}

function getGridXYZ(
  i: number,
  _height: number,
  _width: number,
  spacing: number,
  forceColumns = false,
): [number, number, number] {
  const { height, width, zSpacing } = getGridDims(_height, _width, spacing, forceColumns)
  const offsetY = (height - 1) * spacing * 0.5
  const offsetZ = (width - 1) * zSpacing * -0.5

  const y = -1 * Math.floor(i / width) * spacing + offsetY // row
  const z = (i % width) * zSpacing + offsetZ // column

  return [0, y, z] as [number, number, number]
}
