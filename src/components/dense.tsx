import { Neuron } from "./neuron"
import { LayerProps, LayerType } from "./sequential"

export interface DenseProps {
  index?: number
  type: LayerType
  units: number
  activations?: number[]
  normalizedActivations?: number[]
  weights?: number[][]
  biases?: number[]
  positions?: [number, number, number][]
  prevLayer?: LayerProps
  labelNames?: string[]
}

export const Dense = ({
  type,
  units,
  activations,
  normalizedActivations,
  weights,
  biases,
  positions,
  labelNames,
  prevLayer,
}: DenseProps) => {
  return (
    <group>
      {Array.from({ length: units }).map((_, i) => {
        const position = positions?.[i]
        const neuronWeights = weights?.map((w) => w[i])
        if (!position) return null
        return (
          <Neuron
            key={i}
            index={i}
            position={position}
            prevLayer={prevLayer}
            type={type}
            activation={activations?.[i]}
            normalizedActivation={normalizedActivations?.[i]}
            weights={neuronWeights}
            bias={biases?.[i]}
            label={labelNames?.[i]}
          />
        )
      })}
    </group>
  )
}
