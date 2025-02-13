import { useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { useFrame, useThree } from "@react-three/fiber"
import { useDatasetStore } from "@/data/data"
import type { Neuron } from "@/neuron-layers/types"

export function useAnimatedPosition(position: number[], speed = 0.4) {
  // TODO: could use spring here
  const ref = useRef<THREE.Mesh>(null)
  const currentPosition = useRef(new THREE.Vector3())
  const { invalidate } = useThree()
  const targetPos = useMemo(() => new THREE.Vector3(...position), [position])
  const [isAnimating, setIsAnimating] = useState(false)
  useFrame(() => {
    if (ref.current) {
      if (!targetPos.equals(currentPosition.current)) {
        // invalidate the canvas to trigger a re-render
        invalidate()
        setIsAnimating(true)
      } else {
        setIsAnimating(false)
      }
      currentPosition.current.lerp(targetPos, speed)
      // allow tolerance for floating point errors
      if (currentPosition.current.distanceTo(targetPos) < 0.01) {
        currentPosition.current.copy(targetPos)
      } else {
        ref.current.position.copy(currentPosition.current)
      }
    }
  })
  return [ref, isAnimating] as const
}

export function getWorldPos(neuron: Neuron): THREE.Vector3 | undefined {
  const { meshRef, indexInGroup } = neuron
  if (!meshRef?.current) return
  const worldPos = new THREE.Vector3()
  const tempMatrix = new THREE.Matrix4()
  const tempWorldMatrix = new THREE.Matrix4()
  meshRef.current.getMatrixAt(indexInGroup, tempMatrix)
  tempWorldMatrix.multiplyMatrices(meshRef.current.matrixWorld, tempMatrix)
  tempWorldMatrix.decompose(
    worldPos,
    new THREE.Quaternion(),
    new THREE.Vector3()
  )
  return worldPos
}

// Color utils

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
