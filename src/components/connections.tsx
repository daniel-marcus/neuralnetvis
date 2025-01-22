import { Line } from "@react-three/drei"
import { LayerProps } from "./sequential"
import { useContext } from "react"
import { OptionsContext } from "./model"
// import { normalizeWithSign } from "@/lib/normalization"

export const LINE_ACTIVATION_THRESHOLD = 0.6

type NeuronConnectionsProps = {
  layer: LayerProps
  prevLayer: LayerProps
}

const MAX_WIDTH = 1

export const Connections = ({ layer, prevLayer }: NeuronConnectionsProps) => {
  const { hideLines } = useContext(OptionsContext)
  if (hideLines) return null
  return (
    <group>
      {layer.neurons.map((neuron, i) => {
        if (!neuron.activation || neuron.activation < LINE_ACTIVATION_THRESHOLD)
          return null
        return neuron.normalizedWeights?.map((weight, j) => {
          if (Math.abs(weight) < LINE_ACTIVATION_THRESHOLD) return null
          const weightedInput = neuron.weightedInputs?.[j]
          const normalizedWeightedInput = neuron.normalizedWeightedInputs?.[j]
          if (
            !weightedInput ||
            !normalizedWeightedInput ||
            Math.abs(normalizedWeightedInput) < 0.2
          )
            return null
          const prevNeuron = prevLayer.neurons[j]
          if (!prevNeuron) return null
          const lineWidth = Math.min(
            Math.abs(weightedInput) * MAX_WIDTH,
            MAX_WIDTH
          )
          return (
            <Line
              key={`${i}_${j}`}
              points={[neuron.position, prevNeuron.position]}
              lineWidth={lineWidth}
            />
          )
        })
      })}
    </group>
  )
}
