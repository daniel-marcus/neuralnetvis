import * as THREE from "three"
import type { Neuron } from "@/neuron-layers/types"

export type ColorObj = {
  rgb: number[] // for meshes
  three: THREE.Color // for label
  style: string // for css
}

function toColorObj(colorStr: string): ColorObj {
  const threeColor = new THREE.Color(colorStr)
  return {
    rgb: threeColor.toArray(),
    three: threeColor,
    style: colorStr,
  }
}

const R_COLORS = Array.from({ length: 256 }, (_, i) =>
  toColorObj(`rgb(${i},0,0)`)
)
const G_COLORS = Array.from({ length: 256 }, (_, i) =>
  toColorObj(`rgb(0,${i},0)`)
)
const B_COLORS = Array.from({ length: 256 }, (_, i) =>
  toColorObj(`rgb(0,0,${i})`)
)
const CHANNEL_COLORS = [R_COLORS, G_COLORS, B_COLORS]

const ZERO_BASE = [25, 26, 29] //  --color-gray-text / 6
export const POS_BASE = [255, 20, 100]
export const NEG_BASE = POS_BASE.toReversed()

export function getColorVals(val: number, base: number[]) {
  const result = new Uint8Array(3)
  result[0] = Math.floor(ZERO_BASE[0] + val * (base[0] - ZERO_BASE[0]))
  result[1] = Math.floor(ZERO_BASE[1] + val * (base[1] - ZERO_BASE[1]))
  result[2] = Math.floor(ZERO_BASE[2] + val * (base[2] - ZERO_BASE[2]))
  return result
}

function newColorArr(base: number[]) {
  return Array.from({ length: 256 }, (_, i) => {
    const val = i / 255
    const [a, b, c] = getColorVals(val, base)
    return toColorObj(`rgb(${a}, ${b}, ${c})`)
  })
}

const POS_HIGHLIGHT_COLORS = newColorArr(POS_BASE)
const NEG_HIGHLIGHT_COLORS = newColorArr(NEG_BASE)

function normalizeTo(val?: number, max = 255) {
  return Math.ceil((val ?? 0) * max)
}

export function getNeuronColor(n: Omit<Neuron, "color">) {
  const colorVal = normalizeTo(n.normalizedActivation, 255)
  return n.layer.hasColorChannels
    ? CHANNEL_COLORS[n.index % 3][colorVal]
    : getHighlightColor(n.normalizedActivation ?? 0)
}

export function getHighlightColor(val: number) {
  // val between -1 and 1
  const absVal = normalizeTo(Math.abs(val), 255)
  return val >= 0 ? POS_HIGHLIGHT_COLORS[absVal] : NEG_HIGHLIGHT_COLORS[absVal]
}

export function getPredictionQualityColor(
  n: Omit<Neuron, "color">,
  y?: number,
  yMean?: number
) {
  if (
    typeof y === "undefined" ||
    typeof yMean === "undefined" ||
    typeof n.activation === "undefined"
  )
    return POS_HIGHLIGHT_COLORS[0]

  const squaredResidualMean = (y - yMean) ** 2
  const squaredResidual = (y - n.activation) ** 2
  const rSquared = 1 - squaredResidual / squaredResidualMean
  const colorVal = Math.min(normalizeTo(Math.abs(rSquared), 255), 255)
  // if (rSquared > 0) console.log({ rSquared, squaredResidual }, n.activation, y)
  return rSquared >= 0
    ? POS_HIGHLIGHT_COLORS[colorVal]
    : NEG_HIGHLIGHT_COLORS[colorVal]
}
