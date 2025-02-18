import * as THREE from "three"
import type { Neuron } from "@/neuron-layers/types"
import { useStore } from "@/store"

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

const POS_BASE = [255, 20, 100]
const NEG_BASE = POS_BASE.toReversed()
const ZERO_BASE = [28, 29, 33] // color-gray / 5

const POS_HIGHLIGHT_COLORS = Array.from({ length: 256 }, (_, i) => {
  const val = i / 255
  const a = Math.floor(ZERO_BASE[0] + val * (POS_BASE[0] - ZERO_BASE[0]))
  const b = Math.floor(ZERO_BASE[1] + val * (POS_BASE[1] - ZERO_BASE[1]))
  const c = Math.floor(ZERO_BASE[2] + val * (POS_BASE[2] - ZERO_BASE[2]))
  return toColorObj(`rgb(${a}, ${b}, ${c})`)
})

const NEG_HIGHLIGHT_COLORS = Array.from({ length: 256 }, (_, i) => {
  const val = i / 255
  const a = Math.floor(ZERO_BASE[0] + val * (NEG_BASE[0] - ZERO_BASE[0]))
  const b = Math.floor(ZERO_BASE[1] + val * (NEG_BASE[1] - ZERO_BASE[1]))
  const c = Math.floor(ZERO_BASE[2] + val * (NEG_BASE[2] - ZERO_BASE[2]))
  return toColorObj(`rgb(${a},${b},${c})`)
})

function normalizeTo(val?: number, max = 255) {
  return Math.ceil((val ?? 0) * max)
}

export function getNeuronColor(n: Omit<Neuron, "color">) {
  const colorVal = normalizeTo(n.normalizedActivation, 255)
  const isRegression = useStore.getState().isRegression()
  return isRegression && n.layer.layerPos === "output"
    ? getPredictionQualityColor(n)
    : n.layer.hasColorChannels
    ? CHANNEL_COLORS[n.index % 3][colorVal]
    : getHighlightColor(n.normalizedActivation ?? 0) // ACTIVATION_COLORS[colorVal]
}

export function getHighlightColor(val: number) {
  // val between -1 and 1
  const absVal = normalizeTo(Math.abs(val), 255)
  return val >= 0 ? POS_HIGHLIGHT_COLORS[absVal] : NEG_HIGHLIGHT_COLORS[absVal]
}

function getPredictionQualityColor(n: Omit<Neuron, "color">) {
  const y = useStore.getState().sample?.y ?? 1
  const percentualError = Math.abs((n.activation ?? 1) - y) / y
  const quality = 1 - Math.min(percentualError, 1) // should be between 0 and 1
  return POS_HIGHLIGHT_COLORS[Math.ceil(quality * 255)]
}
