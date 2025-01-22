import { ReactElement } from "react"
import { Neuron, NeuronDef, NeuronState } from "./neuron"
import type { Dataset } from "@/lib/datasets"
import type { LayerPosition, LayerProps } from "./sequential"
import { Instances } from "@react-three/drei"

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
  const geometry = getGeometry(props.layerPosition, neurons.length)
  if (!neurons.length) return null
  return (
    <group name={`dense_${index}`}>
      <Instances
        limit={neurons.length}
        key={`dense_${index}_${neurons.length}`}
      >
        {geometry}
        <meshStandardMaterial />
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
      </Instances>
    </group>
  )
}

const geometryMap: Record<string, ReactElement> = {
  boxSmall: <boxGeometry args={[0.6, 0.6, 0.6]} />,
  boxBig: <boxGeometry args={[1.8, 1.8, 1.8]} />,
  sphere: <sphereGeometry args={[0.6, 32, 32]} />,
}

function getGeometry(type: LayerPosition, units: number) {
  if (["input", "output"].includes(type)) {
    if (units <= 10) return geometryMap.boxBig
    return geometryMap.boxSmall
  }
  return geometryMap.sphere
}
