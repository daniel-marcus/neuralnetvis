import { useMemo } from "react"
import { Neuron, NeuronDef, NeuronRefType, Nid } from "@/lib/neuron"
import type { Dataset } from "@/data/datasets"
import { getVisibleLayers } from "@/lib/layer-props"
import { useAnimatedPosition } from "@/three/animated-position"
import { MeshParams, getOffsetX } from "@/lib/layer-layout"
import * as tf from "@tensorflow/tfjs"
import {
  GroupDef,
  NeuronGroup,
  NeuronGroupProps,
  useGroupPosition,
} from "./neuron-group"
import { YPointer } from "./pointer"
import { Connections } from "./connections"
import { useVisConfigStore } from "@/lib/vis-config"
import * as THREE from "three"

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
          const allProps = {
            ...props,
            groupIndex,
            groupCount,
            nids,
            nidsStr,
            groupedNeurons,
          }
          if (props.layerType === "Conv2D")
            return <GroupWithTexture key={i} {...allProps} />
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

const defaultColor = `rgb(0,20,100)`

function GroupWithTexture(props: NeuronGroupProps) {
  const { groupedNeurons } = props
  const position = useGroupPosition(props)
  const [ref] = useAnimatedPosition(position, 0.1)

  const activations = groupedNeurons.map((n) => n.normalizedActivation)
  const width = Math.ceil(Math.sqrt(activations.length))

  const texture = useMemo(
    () => generateActivationTexture(activations, width, width),
    [activations, width]
  )

  const materials = useMemo(
    () => [
      new THREE.MeshStandardMaterial({ map: texture }), // +X side
      new THREE.MeshStandardMaterial({ map: texture }), // -X side
      new THREE.MeshStandardMaterial({ color: defaultColor }), // +Y side
      new THREE.MeshStandardMaterial({ color: defaultColor }), // -Y side
      new THREE.MeshStandardMaterial({ color: defaultColor }), // +Z side
      new THREE.MeshStandardMaterial({ color: defaultColor }), // -Z side
    ],
    [texture]
  )

  return (
    <mesh ref={ref} material={materials}>
      <boxGeometry args={[0.2, width * 0.2, width * 0.2]} />
    </mesh>
  )
}

function generateActivationTexture(
  activations: (number | undefined)[],
  width: number,
  height: number
) {
  const size = width * height
  const data = new Uint8Array(size * 4)

  for (let i = 0; i < size; i++) {
    const value = Math.floor((activations[i] ?? 0) * 255)
    const index = i * 4
    data[index] = value // R
    data[index + 1] = 10 // G
    data[index + 2] = 50 // B
    data[index + 3] = 255 // A
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat)
  texture.needsUpdate = true

  return texture
}
