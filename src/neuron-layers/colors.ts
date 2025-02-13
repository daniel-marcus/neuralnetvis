import * as THREE from "three"
import { useDatasetStore } from "@/data/data"
import type { Neuron } from "@/neuron-layers/types"

const ACTIVATION_COLORS = Array.from(
  { length: 256 },
  (_, i) => new THREE.Color(`rgb(${i},20,100)`)
)

const R_COLORS = Array.from(
  { length: 256 },
  (_, i) => new THREE.Color(`rgb(${i},0,0)`)
)
const G_COLORS = Array.from(
  { length: 256 },
  (_, i) => new THREE.Color(`rgb(0,${i},0)`)
)
const B_COLORS = Array.from(
  { length: 256 },
  (_, i) => new THREE.Color(`rgb(0,0,${i})`)
)
const CHANNEL_COLORS = [R_COLORS, G_COLORS, B_COLORS]

const HIGHLIGHT_BASE = [250, 20, 100]
const NEG_HIGHLIGHT_COLORS = Array.from({ length: 256 }, (_, i) => {
  const val = i / 255
  const a = Math.ceil(val * HIGHLIGHT_BASE[0])
  const b = Math.ceil(val * HIGHLIGHT_BASE[1])
  const c = Math.ceil(val * HIGHLIGHT_BASE[2])
  return new THREE.Color(`rgb(${c},${b},${a})`)
})
const POS_HIGHLIGHT_COLORS = Array.from({ length: 256 }, (_, i) => {
  const val = i / 255
  const a = Math.ceil(val * HIGHLIGHT_BASE[0])
  const b = Math.ceil(val * HIGHLIGHT_BASE[1])
  const c = Math.ceil(val * HIGHLIGHT_BASE[2])
  return new THREE.Color(`rgb(${a}, ${b}, ${c})`)
})

export function getNeuronColor(n: Omit<Neuron, "color">) {
  const isRegression = useDatasetStore.getState().isRegression
  const defaultColorVal = n.normalizedActivation ?? 0
  return isRegression && n.layer.layerPos === "output"
    ? getPredictionQualityColor(n)
    : n.layer.hasColorChannels
    ? CHANNEL_COLORS[n.index % 3][Math.ceil(defaultColorVal * 255)]
    : ACTIVATION_COLORS[Math.ceil(defaultColorVal * 255)]
}

export function getHighlightColor(val: number) {
  const absVal = Math.ceil(Math.abs(val) * 255) // val between -1 and 1
  return val > 0 ? POS_HIGHLIGHT_COLORS[absVal] : NEG_HIGHLIGHT_COLORS[absVal]
}

function getPredictionQualityColor(n: Omit<Neuron, "color">) {
  const trainingY = useDatasetStore.getState().trainingY ?? 1
  const percentualError = Math.abs((n.activation ?? 1) - trainingY) / trainingY
  const quality = 1 - Math.min(percentualError, 1) // should be between 0 and 1
  return ACTIVATION_COLORS[Math.ceil(quality * 255)]
}
