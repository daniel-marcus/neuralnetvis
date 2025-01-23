import { ReactElement, useContext } from "react"
import { Neuron, NeuronDef, NeuronState } from "./neuron"
import { numColorChannels, type Dataset } from "@/lib/datasets"
import { getVisibleLayers, type LayerPosition } from "@/lib/layer-props"
import { Instances } from "@react-three/drei"
import { AdditiveBlending } from "three"
import { Connections } from "./connections"
import { useAnimatedPosition } from "@/lib/animated-position"
import { getGridWidth, getOffsetX } from "@/lib/layer-layout"
import { UiOptionsContext } from "@/lib/ui-options"
import * as tf from "@tensorflow/tfjs"

export interface LayerDef {
  index: number
  visibleIndex: number // to find neighbours throu "invisible" layers (e.g. Flatten)
  layerPosition: LayerPosition
  tfLayer: tf.layers.Layer
  neurons: (NeuronDef & NeuronState)[]
  geometry: ReactElement
  spacing: number
}

interface LayerContext {
  allLayers: LayerDef[]
  ds?: Dataset
  model?: tf.LayersModel
}

export type LayerProps = LayerDef & LayerContext

export const Layer = (props: LayerProps) => {
  const { index, visibleIndex, allLayers, ds, layerPosition, tfLayer } = props
  const { neurons, geometry } = props
  const colorChannels = numColorChannels(ds)
  const hasColorChannels = colorChannels > 1
  const groupCount =
    hasColorChannels && layerPosition === "input"
      ? colorChannels
      : (tfLayer.outputShape?.[3] as number | undefined) ?? 1

  const { splitColors } = useContext(UiOptionsContext)
  const hasAdditiveBlending =
    layerPosition === "input" && groupCount > 1 && !splitColors

  const prevLayer = getVisibleLayers(allLayers)[visibleIndex - 1]
  const position = [getOffsetX(index, allLayers), 0, 0]
  const ref = useAnimatedPosition(position, 0.1)
  return (
    <Instances
      limit={neurons.length}
      key={`${index}_${neurons.length}`} // _${hasAdditiveBlending}
    >
      {geometry}
      <meshStandardMaterial
        blending={hasAdditiveBlending ? AdditiveBlending : undefined}
      />
      <group name={`layer_${index}`} ref={ref}>
        {Array.from({ length: groupCount }).map((_, groupIndex) => {
          return (
            <NeuronGroup
              key={groupIndex}
              groupIndex={groupIndex}
              groups={groupCount}
              {...props}
            />
          )
        })}
      </group>
      {!!prevLayer && !!prevLayer.neurons.length && (
        <Connections layer={props} prevLayer={prevLayer} />
      )}
    </Instances>
  )
}

type NeuronGroupProps = LayerProps & {
  groupIndex: number
  groups: number
}

const NeuronGroup = (props: NeuronGroupProps) => {
  const { groupIndex, groups, ...layerProps } = props
  const { spacing, allLayers, ds, neurons, layerPosition } = layerProps

  // get grouped neurons in parent class ...
  const groupedNeurons = neurons.filter((n) => n.index % groups === groupIndex)

  const GRID_SPACING = 0.6
  const gridSize = getGridWidth(groupedNeurons.length, spacing) + GRID_SPACING
  const groupsPerRow = Math.ceil(Math.sqrt(groups))
  const offsetY = (groupsPerRow - 1) * gridSize * 0.5
  const offsetZ = (groupsPerRow - 1) * gridSize * -0.5
  const y = -1 * Math.floor(groupIndex / groupsPerRow) * gridSize + offsetY // row
  const z = (groupIndex % groupsPerRow) * gridSize + offsetZ // column

  const { splitColors } = useContext(UiOptionsContext)
  const position =
    layerPosition === "input"
      ? splitColors
        ? [0, 0, groupIndex * gridSize - (groups - 1) * gridSize * 0.5] // spread on z-axis
        : [0, 0, 0]
      : [0, y, z]
  const ref = useAnimatedPosition(position)
  return (
    <group ref={ref}>
      {groupedNeurons.map((neuronProps, i) => {
        // return <Instance key={i} {...neuronProps} />
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
    </group>
  )
}
