import { ReactElement, useContext, useMemo } from "react"
import { Neuron, NeuronDef, NeuronRefType, Nid } from "./neuron"
import type { Dataset } from "@/lib/datasets"
import { getVisibleLayers } from "@/lib/layer-props"
import { Connections } from "./connections"
import { useAnimatedPosition } from "@/lib/animated-position"
import { getOffsetX } from "@/lib/layer-layout"
import { UiOptionsContext } from "@/lib/ui-options"
import * as tf from "@tensorflow/tfjs"
import { GroupDef, NeuronGroup } from "./neuron-group"

export type LayerType =
  | "InputLayer"
  | "Conv2D"
  | "Dense"
  | "Flatten"
  | "MaxPooling2D"
export type LayerPosition = "input" | "hidden" | "output" | "invisible"

export interface LayerStatic {
  index: number
  visibleIndex: number // to find neighbours throu "invisible" layers (e.g. Flatten)
  layerType: LayerType
  layerPos: LayerPosition
  tfLayer: tf.layers.Layer
  geometry: ReactElement
  spacing: number
  prevLayer?: LayerStatic
  prevVisibleLayer?: LayerStatic
  neurons: NeuronDef[]
  neuronsMap?: Map<Nid, NeuronDef>
}

export interface LayerStateful extends LayerStatic {
  neurons: Neuron[]
  neuronsMap?: Map<Nid, Neuron>
  maxAbsWeight?: number
  groups: GroupDef[]
}

interface LayerContext {
  allLayers: LayerStateful[]
  ds?: Dataset
  neuronRefs: React.RefObject<NeuronRefType>[][]
}

export type LayerProps = LayerStateful & LayerContext

export const Layer = (props: LayerProps) => {
  const { visibleIndex, allLayers, layerPos } = props
  const { groups, prevVisibleLayer } = props
  const groupCount = groups.length

  const { splitColors } = useContext(UiOptionsContext)
  const hasAdditiveBlending =
    layerPos === "input" && groupCount > 1 && !splitColors

  const visibleLayers = getVisibleLayers(allLayers)
  const position = useMemo(
    () => [getOffsetX(visibleIndex, visibleLayers.length), 0, 0],
    [visibleIndex, visibleLayers.length]
  )
  const ref = useAnimatedPosition(position, 0.1)
  if (!props.neurons.length) return null
  return (
    // render layer w/ additive blending first (mixed colors) to avoid transparency to other objects
    <>
      <group ref={ref} renderOrder={hasAdditiveBlending ? -1 : undefined}>
        {groups.map(({ nids, nidsStr }, i) => {
          // use reversed index for input layer to get RGB on z-axis
          const groupIndex = layerPos === "input" ? groupCount - i - 1 : i
          const groupedNeurons = Array.from(nids)
            .map((nid) => props.neuronsMap?.get(nid))
            .filter(Boolean) as Neuron[]
          return (
            <NeuronGroup
              key={i}
              groupIndex={groupIndex}
              groupCount={groupCount}
              nids={nids}
              nidsStr={nidsStr}
              groupedNeurons={groupedNeurons}
              {...props}
            />
          )
        })}
      </group>
      {!!prevVisibleLayer && !!prevVisibleLayer.neurons.length && (
        <Connections layer={props} prevLayer={prevVisibleLayer} />
      )}
    </>
  )
}
