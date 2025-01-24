import { ReactElement, useContext, useMemo } from "react"
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

  const visibleLayers = getVisibleLayers(allLayers)
  const prevLayer = visibleLayers[visibleIndex - 1]
  const position = useMemo(
    () => [getOffsetX(visibleIndex, visibleLayers.length), 0, 0],
    [visibleIndex, visibleLayers.length]
  )
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
          const groupedNeurons = neurons.filter(
            (n) => n.index % groupCount === groupIndex
          )
          return (
            <NeuronGroup
              key={groupIndex}
              groupIndex={groupIndex}
              groupCount={groupCount}
              groupedNeurons={groupedNeurons}
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
  groupCount: number
  groupedNeurons: (NeuronDef & NeuronState)[]
}

const NeuronGroup = (props: NeuronGroupProps) => {
  const { groupedNeurons, ...layerProps } = props
  const { allLayers, ds } = layerProps
  const position = useGroupPosition(props)
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

function useGroupPosition(props: NeuronGroupProps) {
  const { groupIndex, groupCount, layerPosition, spacing } = props
  const neuronCount = props.groupedNeurons.length
  const { splitColors } = useContext(UiOptionsContext)
  const position = useMemo(() => {
    const GRID_SPACING = 0.6
    const gridSize = getGridWidth(neuronCount, spacing) + GRID_SPACING
    const groupsPerRow = Math.ceil(Math.sqrt(groupCount))
    const offsetY = (groupsPerRow - 1) * gridSize * 0.5
    const offsetZ = (groupsPerRow - 1) * gridSize * -0.5
    const y = -1 * Math.floor(groupIndex / groupsPerRow) * gridSize + offsetY // row
    const z = (groupIndex % groupsPerRow) * gridSize + offsetZ // column
    return layerPosition === "input"
      ? splitColors
        ? [0, 0, groupIndex * gridSize - (groupCount - 1) * gridSize * 0.5] // spread on z-axis
        : [0, 0, 0]
      : [0, y, z]
  }, [groupIndex, groupCount, neuronCount, layerPosition, spacing, splitColors])
  return position
}
