import { useMemo } from "react"
import * as THREE from "three"
import { useThree } from "@react-three/fiber"
import { useSpring } from "@react-spring/web"

import { Neuron, NeuronRefType } from "@/neuron-layers/neuron"
import { getVisibleLayers } from "@/neuron-layers/layer-props"
import { useAnimatedPosition } from "@/scene/animated-position"
import { NeuronGroup } from "./neuron-group"
import { YPointer } from "./pointer"
import { Connections } from "./connections"
import { useVisConfigStore } from "@/scene/vis-config"
import { useOrientation } from "@/utils/utils"
import { LayerStateful } from "@/neuron-layers/layer"
import { Dataset } from "@/data/data"
// import { GroupWithTexture } from "./group-texture"

interface LayerContext {
  allLayers: LayerStateful[]
  ds?: Dataset
  neuronRefs: React.RefObject<NeuronRefType>[][]
}

export type LayerProps = LayerStateful & LayerContext

export const Layer = (props: LayerProps) => {
  const { layerPos, groups, allLayers } = props
  const groupCount = groups.length
  const prevVisibleLayer = getVisibleLayers(allLayers)[props.visibleIdx - 1]

  const ref = useLayerPos(props)
  const isInvisible = useIsInvisible(props)
  const prevIsInvisible = useIsInvisible(prevVisibleLayer)
  useDynamicScale(ref, isInvisible ? 0.001 : 1)

  const splitColors = useVisConfigStore((s) => s.splitColors)
  const hasAdditiveBlending =
    layerPos === "input" && groupCount > 1 && !splitColors

  if (!props.neurons.length) return null

  const neuronsByGroup = groupNeuronsByGroupIndex(props)

  const showConnections =
    !!prevVisibleLayer &&
    !!prevVisibleLayer.neurons.length &&
    !isInvisible &&
    !prevIsInvisible
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
      {showConnections && (
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

function useLayerPos(layer: LayerProps) {
  const { visibleIdx, allLayers } = layer
  const visibleLayers = getVisibleLayers(allLayers)
  const orientation = useOrientation()

  const _xShift = useVisConfigStore((s) => s.xShift)
  const yShift = useVisConfigStore((s) => s.yShift)
  const zShift = useVisConfigStore((s) => s.zShift)

  const position = useMemo(() => {
    const xShift = orientation === "landscape" ? _xShift * 1.1 : _xShift
    return [
      visibleIdx * xShift + (visibleLayers.length - 1) * xShift * -0.5,
      visibleIdx * yShift + (visibleLayers.length - 1) * yShift * -0.5,
      visibleIdx * zShift + (visibleLayers.length - 1) * zShift * -0.5,
    ]
  }, [visibleIdx, visibleLayers.length, _xShift, yShift, zShift, orientation])
  const [ref] = useAnimatedPosition(position, 0.1)
  return ref
}

function useIsInvisible(layer?: LayerStateful) {
  const invisibleLayers = useVisConfigStore((s) => s.invisibleLayers)
  if (!layer) return true
  return invisibleLayers.includes(layer.tfLayer.name)
}

function useDynamicScale(
  ref: React.RefObject<THREE.Mesh | null>,
  scale: number = 1
) {
  const { invalidate } = useThree()
  // would use @react-spring/three, but that breaks @react-spring/web:
  // https://github.com/pmndrs/react-spring/issues/1586
  useSpring({
    scale,
    config: { duration: 150 },
    onChange: ({ value }) => {
      const val = value.scale
      ref.current?.scale.set(val, val, val)
      invalidate()
    },
  })
}
