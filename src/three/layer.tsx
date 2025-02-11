import { useMemo } from "react"
import { Neuron, NeuronDef, NeuronRefType, Nid } from "@/lib/neuron"
import type { Dataset } from "@/data/datasets"
import { getVisibleLayers } from "@/lib/layer-props"
import { useAnimatedPosition } from "@/three/animated-position"
import { MeshParams, getOffsetX } from "@/lib/layer-layout"
import * as tf from "@tensorflow/tfjs"
import { GroupDef, NeuronGroup } from "./neuron-group"
import { YPointer } from "./pointer"
import { Connections } from "./connections"
import { useVisConfigStore } from "@/lib/vis-config"
// import { GroupWithTexture } from "./group-texture"

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
  hasLabels?: boolean
  groups: GroupDef[]
}

export interface LayerStateful extends LayerStateless {
  neurons: Neuron[]
  maxAbsWeight?: number
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
  const neuronsByGroup = groupNeuronsByGroupIndex(props)
  return (
    // render layer w/ additive blending first (mixed colors) to avoid transparency to other objects
    <>
      <group ref={ref} renderOrder={hasAdditiveBlending ? -1 : undefined}>
        {groups.map(({ nids, nidsStr }, i) => {
          // use reversed index for input layer to get RGB on z-axis
          const groupIndex = layerPos === "input" ? groupCount - i - 1 : i

          const groupedNeurons = neuronsByGroup[groupIndex]

          const allProps = {
            ...props,
            groupIndex,
            groupCount,
            nids,
            nidsStr,
            groupedNeurons,
          }
          // if (props.layerType === "Conv2D") return <GroupWithTexture key={i} {...allProps} />
          return <NeuronGroup key={i} {...allProps} />
        })}
        {layerPos === "output" && <YPointer outputLayer={props} />}
      </group>
      {!!prevVisibleLayer && !!prevVisibleLayer.neurons.length && (
        <Connections layer={props} prevLayer={prevVisibleLayer} />
      )}
    </>
  )
}

function groupNeuronsByGroupIndex(layer: LayerProps) {
  const neuronsByGroup = {} as { [key: number]: Neuron[] }
  for (let i = 0; i < layer.groups.length; i++) {
    neuronsByGroup[i] = []
  }
  for (const neuron of layer.neurons) {
    neuronsByGroup[neuron.groupIndex].push(neuron)
  }
  return neuronsByGroup
}
