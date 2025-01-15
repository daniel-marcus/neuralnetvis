import { useContext } from "react"
import { Neuron } from "./neuron"
import { LayerContext, LayerType } from "./sequential"

export interface DenseProps {
  index?: number
  type: LayerType
  units: number
  activations?: number[]
  normalizedActivations?: number[]
  weights?: number[][]
  biases?: number[]
  positions?: [number, number, number][]
}

export const Dense = ({
  index = 0,
  type,
  units,
  activations,
  normalizedActivations,
  weights,
  biases,
  positions,
}: DenseProps) => {
  const layers = useContext(LayerContext)
  const prevLayer = layers.find((l) => l.props.index === index - 1)
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
          />
        )
      })}
    </group>
  )
}
