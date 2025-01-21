import { Neuron, NeuronDef, NeuronState } from "./neuron"
import type { Dataset } from "@/lib/datasets"
import type { LayerPosition, LayerProps } from "./sequential"

export interface DenseProps {
  index: number
  layerPosition: LayerPosition
  positions?: [number, number, number][] // keep separated from changing data
  allLayers?: LayerProps[]
  ds: Dataset
  neurons: (NeuronDef & NeuronState)[]
}

export const Dense = (props: DenseProps) => {
  const { index, allLayers, ds, neurons, positions } = props
  return (
    <group name={`dense_${index}`}>
      {neurons.map((neuronProps, i) => {
        const position = positions?.[i]
        if (!position) return null
        return (
          <Neuron
            key={i}
            position={position}
            layer={props}
            allLayers={allLayers}
            ds={ds}
            {...neuronProps}
          />
        )
      })}
    </group>
  )
}
