import { Line } from "@react-three/drei"
import { Point } from "./sequential"
import { normalize } from "@/lib/datasets"

export const LINE_ACTIVATION_THRESHOLD = 0.5

type NeuronConnectionsProps = {
  linePoints?: [Point, Point][]
  weights?: number[]
  inputs?: number[]
}

const MAX_WIDTH = 1

export const NeuronConnections = ({
  linePoints,
  weights,
  inputs,
}: NeuronConnectionsProps) => {
  const normalizedWeights = normalize(weights?.map((w) => Math.abs(w)))
  return (
    <group>
      {linePoints?.map((points, i) => {
        if (!inputs?.[i]) return null
        const wNorm = normalizedWeights?.[i] ?? 0
        if (wNorm < LINE_ACTIVATION_THRESHOLD) return null
        const z = Math.abs((weights?.[i] ?? 0) * (inputs?.[i] ?? 0))
        const lineWidth = Math.min(z * MAX_WIDTH, MAX_WIDTH)
        return <Line key={i} points={points} lineWidth={lineWidth} />
      })}
    </group>
  )
}
