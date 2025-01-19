import { Dataset } from "@/lib/datasets"
import { Neuron } from "./neuron"
import { LayerProps, LayerType } from "./sequential"

export interface DenseProps {
  index?: number
  type: LayerType
  units: number
  rawInput?: number[]
  activations?: number[]
  normalizedActivations?: number[]
  weights?: number[][]
  biases?: number[]
  positions?: [number, number, number][]
  prevLayer?: LayerProps
  ds: Dataset
}

export const Dense = (props: DenseProps) => {
  const {
    units,
    type,
    rawInput,
    activations,
    normalizedActivations,
    weights,
    biases,
    positions,
    prevLayer,
    ds,
  } = props
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
            layer={props}
            prevLayer={prevLayer}
            rawInput={rawInput?.[i]}
            activation={activations?.[i]}
            normalizedActivation={normalizedActivations?.[i]}
            weights={neuronWeights}
            bias={biases?.[i]}
            label={
              type === "output"
                ? ds.output.labels?.[i]
                : type === "input"
                ? ds.input?.labels?.[i]
                : undefined
            }
          />
        )
      })}
    </group>
  )
}
