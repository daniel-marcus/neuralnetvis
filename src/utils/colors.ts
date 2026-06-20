import * as THREE from "three/webgpu"

// colors are now calculated in the shader, see materials.ts

type ColorObj = {
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

export const ZERO_BASE = [30, 31, 34] //  --color-gray-text / x // brighter: [30, 31, 34] // darker: [25, 26, 29]
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

export function getActColor(val: number) {
  // val between -1 and 1
  const absVal = normalizeTo(Math.abs(val), 255)
  return val >= 0 ? POS_HIGHLIGHT_COLORS[absVal] : NEG_HIGHLIGHT_COLORS[absVal]
}
