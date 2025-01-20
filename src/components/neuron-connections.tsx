import { Line } from "@react-three/drei"
import type { LayerProps } from "./sequential"

export const LINE_ACTIVATION_THRESHOLD = 0.5
// maybe use dynamic threshold based on max weight?
export const LINE_WEIGHT_THRESHOLD = 0.1

type NeuronConnectionsProps = {
  prevLayer?: LayerProps
  position: [number, number, number]
  weights?: number[]
}

export const NeuronConnections = ({
  prevLayer,
  position,
  weights,
}: NeuronConnectionsProps) => {
  return (
    <group>
      {prevLayer?.positions?.map((prevPos, j) => {
        const weight = weights?.[j] ?? 0
        const input = prevLayer.normalizedActivations?.[j] ?? 0
        if (Math.abs(weight) < LINE_WEIGHT_THRESHOLD) return null
        const z = Math.abs(weight * input)
        const lineWidth = Math.min(z * 2, 4)
        // TODO: scaled values?
        return (
          <Line key={j} points={[prevPos, position]} lineWidth={lineWidth} />
        )
      })}
    </group>
  )
}
