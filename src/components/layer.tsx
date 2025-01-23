import { ReactElement, useContext } from "react"
import { Neuron, NeuronDef, NeuronState } from "./neuron"
import type { Dataset } from "@/lib/datasets"
import type { LayerPosition } from "@/lib/layer-props"
import { Instances } from "@react-three/drei"
import { AdditiveBlending } from "three"
import { OptionsContext } from "./model"
import { Connections } from "./connections"
import { useAnimatedPosition } from "@/lib/animated-position"
import { getGridWidth, getOffsetX } from "@/lib/neuron-positions"

export interface LayerDef {
  index: number
  layerPosition: LayerPosition
  neurons: (NeuronDef & NeuronState)[]
}

interface LayerContext {
  allLayers: LayerDef[]
  ds?: Dataset
}

export type LayerProps = LayerDef & LayerContext

export const Layer = (props: LayerProps) => {
  const { index, allLayers, ds, layerPosition } = props
  const colorChannels = ds?.data.trainX.shape[3] ?? 1
  const hasColorChannels = colorChannels > 1
  const groups =
    hasColorChannels && layerPosition === "input" ? colorChannels : 1
  const prevLayer = allLayers?.[index - 1]
  const position = [getOffsetX(index, allLayers), 0, 0]
  const ref = useAnimatedPosition(position, 0.1)
  return (
    <>
      <group name={`layer_${index}`} ref={ref}>
        {Array.from({ length: groups }).map((_, groupIndex) => {
          return (
            <NeuronGroup
              key={groupIndex}
              groupIndex={groupIndex}
              groups={groups}
              {...props}
            />
          )
        })}
      </group>
      {!!prevLayer && !!prevLayer.neurons.length && (
        <Connections layer={props} prevLayer={prevLayer} />
      )}
    </>
  )
}

type NeuronGroupProps = LayerProps & {
  groupIndex: number
  groups: number
}

const NeuronGroup = (props: NeuronGroupProps) => {
  const { groupIndex, groups, ...layerProps } = props
  const { allLayers, ds, neurons, layerPosition } = layerProps
  const geometry = getGeometry(layerPosition, neurons.length)
  const { splitColors } = useContext(OptionsContext)
  const hasAdditiveBlending =
    layerPosition === "input" && groups > 1 && !splitColors
  const groupedNeurons = neurons.filter((n) => n.index % groups === groupIndex)

  const gridWidth = getGridWidth(groupedNeurons.length, layerPosition) + 0.6
  const rest = groupIndex % groups
  const shiftZ = 1 * (rest - (groups - 1) / 2)
  const position = splitColors ? [0, 0, shiftZ * gridWidth] : [0, 0, 0]
  const ref = useAnimatedPosition(position)
  return (
    <group ref={ref}>
      <Instances
        limit={groupedNeurons.length}
        key={`${groupIndex}_${groupedNeurons.length}`} // _${hasAdditiveBlending}
      >
        {geometry}
        <meshStandardMaterial
          blending={hasAdditiveBlending ? AdditiveBlending : undefined}
        />
        {groupedNeurons.map((neuronProps, i) => {
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
