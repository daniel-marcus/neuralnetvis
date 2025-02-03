import { useMemo } from "react"
import { Neuron, NeuronDef, NeuronRefType, Nid } from "@/lib/neuron"
import type { Dataset } from "@/lib/datasets"
import { getVisibleLayers } from "@/lib/layer-props"
import { useAnimatedPosition } from "@/lib/animated-position"
import { MeshParams, getOffsetX } from "@/lib/layer-layout"
import * as tf from "@tensorflow/tfjs"
import { GroupDef, NeuronGroup } from "../three-model/neuron-group"
import { YPointer } from "../three-model/pointer"
import { Connections } from "./connections"
import { useVisConfigStore } from "@/lib/vis-config"

export type LayerType =
  | "InputLayer"
  | "Conv2D"
  | "Dense"
  | "Flatten"
  | "MaxPooling2D"
export type LayerPosition = "input" | "hidden" | "output" | "invisible"

export interface LayerStateless {
  index: number
  visibleIndex: number // to find neighbours throu "invisible" layers (e.g. Flatten)
  layerType: LayerType
  layerPos: LayerPosition
  tfLayer: tf.layers.Layer
  numBiases: number // for Dense layers = numNeurons, for Conv2D = numFilters
  meshParams: MeshParams
  prevLayer?: LayerStateless
  prevVisibleLayer?: LayerStateless
  neurons: NeuronDef[]
  neuronsMap?: Map<Nid, NeuronDef>
}

export interface LayerStateful extends LayerStateless {
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
  const { groups } = props
  const groupCount = groups.length

  const layerSpacing = useVisConfigStore((s) => s.layerSpacing)
  const splitColors = useVisConfigStore((s) => s.splitColors)

  const hasAdditiveBlending =
    layerPos === "input" && groupCount > 1 && !splitColors

  const visibleLayers = getVisibleLayers(allLayers)
  const prevVisibleLayer = visibleLayers[visibleIndex - 1]
  const position = useMemo(
    () => [getOffsetX(visibleIndex, visibleLayers.length, layerSpacing), 0, 0],
    [visibleIndex, visibleLayers.length, layerSpacing]
  )
  const [ref] = useAnimatedPosition(position, 0.1)
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
        {layerPos === "output" && <YPointer outputLayer={props} />}
      </group>
      {!!prevVisibleLayer && !!prevVisibleLayer.neurons.length && (
        <Connections layer={props} prevLayer={prevVisibleLayer} />
      )}
    </>
  )
}
