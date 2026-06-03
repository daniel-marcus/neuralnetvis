import type { Layer } from "@tensorflow/tfjs-layers/dist/exports_layers"
import type { Index3D, Nid } from "./types"

export function getUnits(layer: Layer) {
  const [, ...dims] = layer.outputShape as number[]
  return dims.reduce((a, b) => a * b, 1)
}

export function getNid(layerIdx: number, neuronIdx: number) {
  return `${layerIdx}_${neuronIdx}` as Nid
}

export function getIndex3d(flatIndex: number, outputShape: number[]) {
  const [, , width = 1, depth = 1] = outputShape
  const depthIndex = flatIndex % depth
  const widthIndex = Math.floor(flatIndex / depth) % width
  const heightIndex = Math.floor(flatIndex / (depth * width))
  return [heightIndex, widthIndex, depthIndex] as Index3D
}

export function getFlatIndex(
  heightIndex: number,
  widthIndex: number,
  depthIndex: number,
  outputShape: number[],
): number {
  const [, , width = 1, depth = 1] = outputShape
  return (heightIndex * width + widthIndex) * depth + depthIndex
}
