import { Line } from "@react-three/drei"
import { LINE_WEIGHT_THRESHOLD, NeuronProps } from "./neuron"

type NeuronConnectionsProps = Pick<
  NeuronProps,
  "prevLayer" | "position" | "weights"
>

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
