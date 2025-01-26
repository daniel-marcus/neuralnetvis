import { ReactElement, useContext, useMemo } from "react"
import { Neuron, NeuronRefType } from "./neuron"
import { numColorChannels, type Dataset } from "@/lib/datasets"
import { getVisibleLayers, type LayerPosition } from "@/lib/layer-props"
import { Connections } from "./connections"
import { useAnimatedPosition } from "@/lib/animated-position"
import { getOffsetX } from "@/lib/layer-layout"
import { UiOptionsContext } from "@/lib/ui-options"
import * as tf from "@tensorflow/tfjs"
import { NeuronGroup } from "./neuron-group"

export interface LayerDef {
  index: number
  visibleIndex: number // to find neighbours throu "invisible" layers (e.g. Flatten)
  layerPosition: LayerPosition
  tfLayer: tf.layers.Layer
  neurons: Neuron[]
  geometry: ReactElement
  spacing: number
  neuronsMap?: Map<string, Neuron>
}

interface LayerContext {
  allLayers: LayerDef[]
  ds?: Dataset
  model?: tf.LayersModel
  neuronRefs: React.RefObject<NeuronRefType>[][]
}

export type LayerProps = LayerDef & LayerContext

export const Layer = (props: LayerProps) => {
  const { visibleIndex, allLayers, ds, layerPosition, tfLayer } = props
  const { neurons } = props
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
  if (!neurons.length) return null
  return (
    // render layer w/ additive blending first (mixed colors) to avoid transparency to other objects
    <>
      <group ref={ref} renderOrder={hasAdditiveBlending ? -1 : undefined}>
        {Array.from({ length: groupCount }).map((_, i) => {
          // use reversed index for input layer to get RGB on z-axis
          const groupIndex = layerPosition === "input" ? groupCount - i - 1 : i
          const groupedNeurons = neurons.filter(
            (n) => n.index % groupCount === groupIndex
          )
          return (
            <NeuronGroup
              key={i}
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
    </>
  )
}
