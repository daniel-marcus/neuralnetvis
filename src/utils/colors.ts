import * as THREE from "three"

export type ColorObj = {
  rgb: number[] // as THREE.Color.toArray (float) for instanced meshes
  three: THREE.Color // for label
  style: string // for css
  rgba: number // packed Uint32 for textures
}

function toColorObj(r: number, g: number, b: number, a = 255): ColorObj {
  const colorStr = `rgb(${r}, ${g}, ${b})`
  const threeColor = new THREE.Color(colorStr)
  return {
    rgb: threeColor.toArray(),
    three: threeColor,
    style: colorStr,
    rgba: (a << 24) | (b << 16) | (g << 8) | r,
  }
}

const R_COLORS = Array.from({ length: 256 }, (_, i) => toColorObj(i, 0, 0))
const G_COLORS = Array.from({ length: 256 }, (_, i) => toColorObj(0, i, 0))
const B_COLORS = Array.from({ length: 256 }, (_, i) => toColorObj(0, 0, i))
const CHANNEL_COLORS = [R_COLORS, G_COLORS, B_COLORS]

const ZERO_BASE = [25, 26, 29] //  --color-gray-text / 6
export const POS_BASE = [255, 20, 100] // --color-primary
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
    const [r, g, b] = getColorVals(val, base)
    return toColorObj(r, g, b)
  })
}

const POS_HIGHLIGHT_COLORS = newColorArr(POS_BASE)
const NEG_HIGHLIGHT_COLORS = newColorArr(NEG_BASE)

function normalizeTo(val?: number, max = 255) {
  return Math.ceil((val ?? 0) * max)
}

export function getChannelColor(rgbIdx: number, val: number) {
  return CHANNEL_COLORS[rgbIdx][normalizeTo(val, 255)]
}

export function getHighlightColor(val: number) {
  // val between -1 and 1
  const absVal = normalizeTo(Math.abs(val), 255)
  return val >= 0 ? POS_HIGHLIGHT_COLORS[absVal] : NEG_HIGHLIGHT_COLORS[absVal]
}

export function getPredictionQualityColor(
  yPred?: number, // activation
  yTrue?: number,
  yMean?: number
) {
  if (
    typeof yPred === "undefined" ||
    typeof yTrue === "undefined" ||
    typeof yMean === "undefined"
  )
    return POS_HIGHLIGHT_COLORS[0]

  const squaredResidual = (yTrue - yPred) ** 2
  const squaredResidualMean = (yTrue - yMean) ** 2
  const rSquared = 1 - squaredResidual / squaredResidualMean
  const colorVal = Math.min(normalizeTo(Math.abs(rSquared), 255), 255)
  // if (rSquared > 0) console.log({ rSquared, squaredResidual }, yPred, y)
  return rSquared >= 0
    ? POS_HIGHLIGHT_COLORS[colorVal]
    : NEG_HIGHLIGHT_COLORS[colorVal]
}
