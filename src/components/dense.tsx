import { useContext } from "react"
import { Neuron } from "./neuron"
import { getLayerType, LayerContext } from "./sequential"
import { normalize } from "./model"

export interface DenseProps {
  index?: number
  units: number
  input?: number[]
  weights?: number[][]
  biases?: number[]
  positions?: [number, number, number][]
}

export const Dense = ({
  units,
  index = 0,
  input,
  weights,
  biases,
  positions,
}: DenseProps) => {
  const layers = useContext(LayerContext)
  const totalLayers = layers.length
  const prevLayer = layers.find((l) => l.props.index === index - 1)
  const type = getLayerType(totalLayers, index)
  const normalizedInput = normalize(input ?? [])
  return (
    <group>
      {Array.from({ length: units }).map((_, i) => {
        const position = positions?.[i]
        const neuronWeights = weights?.map((w) => w[i])
        return (
          <Neuron
            key={i}
            position={position}
            prevLayer={prevLayer}
            type={type}
            activation={input ? input[i] : undefined}
            normalizedActivation={input ? normalizedInput[i] : undefined}
            weights={neuronWeights}
            bias={biases?.[i]}
          />
        )
      })}
    </group>
  )
}
