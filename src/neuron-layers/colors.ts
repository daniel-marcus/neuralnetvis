import * as THREE from "three"
import type { Neuron } from "@/neuron-layers/types"
import { useStore } from "@/store"

export type ColorObj = {
  rgb: number[] // for meshes
  three: THREE.Color // for label
  style: string // for css
}

function toColorObj(color: string): ColorObj {
  const threeColor = new THREE.Color(color)
  return {
    rgb: threeColor.toArray(),
    three: threeColor,
    style: threeColor.getStyle(),
  }
}

const ACTIVATION_COLORS = Array.from({ length: 256 }, (_, i) =>
  toColorObj(`rgb(${i},20,100)`)
)

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

const HIGHLIGHT_BASE = [250, 20, 100]
const NEG_HIGHLIGHT_COLORS = Array.from({ length: 256 }, (_, i) => {
  const val = i / 255
  const a = Math.floor(val * HIGHLIGHT_BASE[0])
  const b = Math.floor(val * HIGHLIGHT_BASE[1])
  const c = Math.floor(val * HIGHLIGHT_BASE[2])
  return toColorObj(`rgb(${c},${b},${a})`)
})
const POS_HIGHLIGHT_COLORS = Array.from({ length: 256 }, (_, i) => {
  const val = i / 255
  const a = Math.floor(val * HIGHLIGHT_BASE[0])
  const b = Math.floor(val * HIGHLIGHT_BASE[1])
  const c = Math.floor(val * HIGHLIGHT_BASE[2])
  return toColorObj(`rgb(${a}, ${b}, ${c})`)
})

export function getNeuronColor(n: Omit<Neuron, "color">) {
  const defaultColorVal = n.normalizedActivation ?? 0
  const isRegression = useStore.getState().isRegression()
  return isRegression && n.layer.layerPos === "output"
    ? getPredictionQualityColor(n)
    : n.layer.hasColorChannels
    ? CHANNEL_COLORS[n.index % 3][Math.ceil(defaultColorVal * 255)]
    : ACTIVATION_COLORS[Math.ceil(defaultColorVal * 255)]
}

export function getHighlightColor(val: number) {
  const absVal = Math.floor(Math.abs(val) * 255) // val between -1 and 1
  return val > 0 ? POS_HIGHLIGHT_COLORS[absVal] : NEG_HIGHLIGHT_COLORS[absVal]
}

function getPredictionQualityColor(n: Omit<Neuron, "color">) {
  const y = useStore.getState().sample?.y ?? 1
  const percentualError = Math.abs((n.activation ?? 1) - y) / y
  const quality = 1 - Math.min(percentualError, 1) // should be between 0 and 1
  return ACTIVATION_COLORS[Math.ceil(quality * 255)]
}
