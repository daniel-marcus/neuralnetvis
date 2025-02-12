import * as THREE from "three"
import { useDatasetStore } from "@/data/datasets"
import { Neuron } from "@/lib/neuron"

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

export function getNeuronColor(
  n: Neuron,
  hasColorChannels = false,
  isRegression = false
) {
  const defaultColorVal = n.normalizedActivation ?? 0
  return typeof n.highlightValue === "number"
    ? getHighlightColor(n.highlightValue)
    : isRegression
    ? getPredictionQualityColor(n)
    : hasColorChannels
    ? CHANNEL_COLORS[n.index % 3][Math.ceil(defaultColorVal * 255)]
    : ACTIVATION_COLORS[Math.ceil(defaultColorVal * 255)]
}

export function getHighlightColor(
  value: number // between -1 and 1
) {
  const absVal = Math.ceil(Math.abs(value) * 255)
  return value > 0 ? POS_HIGHLIGHT_COLORS[absVal] : NEG_HIGHLIGHT_COLORS[absVal]
}

function getPredictionQualityColor(n: Neuron) {
  const trainingY = useDatasetStore.getState().trainingY ?? 1
  const percentualError = Math.abs((n.activation ?? 1) - trainingY) / trainingY
  const quality = 1 - Math.min(percentualError, 1) // should be between 0 and 1
  return ACTIVATION_COLORS[Math.ceil(quality * 255)]
}
