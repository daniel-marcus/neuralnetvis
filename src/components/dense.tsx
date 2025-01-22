import { ReactElement, useContext } from "react"
import { Neuron, NeuronDef, NeuronState } from "./neuron"
import type { Dataset } from "@/lib/datasets"
import type { LayerPosition, LayerProps } from "./sequential"
import { Instances } from "@react-three/drei"
import { AdditiveBlending } from "three"
import { OptionsContext } from "./model"
import { Connections } from "./connections"

export interface DenseProps {
  index: number
  layerPosition: LayerPosition
  // positions?: [number, number, number][] // keep separated from changing data
  allLayers?: LayerProps[]
  ds?: Dataset
  neurons: (NeuronDef & NeuronState)[]
}

export const Dense = (props: DenseProps) => {
  const { index, allLayers, ds, neurons, layerPosition } = props
  const geometry = getGeometry(layerPosition, neurons.length)
  const { splitColors } = useContext(OptionsContext)
  if (!neurons.length) return null
  const hasColorChannels = !!ds?.data.trainX.shape[3]
  const hasAdditiveBlending =
    layerPosition === "input" && hasColorChannels && !splitColors
  const prevLayer = allLayers?.[index - 1]
  return (
    <group name={`dense_${index}`}>
      <Instances
        limit={neurons.length}
        key={`dense_${index}_${neurons.length}_${hasAdditiveBlending}`}
      >
        {geometry}
        <meshStandardMaterial
          blending={hasAdditiveBlending ? AdditiveBlending : undefined}
        />
        {neurons.map((neuronProps, i) => {
          return (
            <Neuron
              key={i}
              layer={props}
              allLayers={allLayers}
              ds={ds}
              {...neuronProps}
            />
          )
        })}
      </Instances>
      {!!prevLayer && <Connections layer={props} prevLayer={prevLayer} />}
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
