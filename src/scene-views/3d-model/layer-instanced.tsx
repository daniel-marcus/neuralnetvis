import { memo, useLayoutEffect, useMemo, useState } from "react"
import * as THREE from "three/webgpu"
import { useSceneStore } from "@/store"
import { useNeuronInteractions } from "./interactions"
import { getNeuronPos, type MeshParams } from "@/neuron-layers/layout"
import { NeuronLabels } from "./label"
import { getMaterial } from "./materials"
import { useLayerActivations } from "@/model/activations"
import { YPointer } from "./pointer"
import type { MeshRef, NeuronLayer } from "@/neuron-layers/types"
import type { Pos } from "@/scene-views/3d-model/utils"

type InstancedLayerProps = NeuronLayer & {
  channelIdx: number
  visible: boolean
}

export interface UserData {
  activations: THREE.StorageBufferAttribute // StorageInstancedBufferAttribute
  instancedActivations: THREE.InstancedBufferAttribute
}

export const InstancedLayer = memo(function InstancedLayer(
  props: InstancedLayerProps
) {
  const { meshParams, hasColorChannels, hasLabels, numNeurons } = props
  const { channelIdx, meshRefs } = props
  const units = hasColorChannels ? numNeurons / 3 : numNeurons
  const meshRef = meshRefs[channelIdx]
  const positions = useNeuronPositions(props, meshRef)
  const [material, userData] = useColors(props, channelIdx)
  const eventHandlers = useNeuronInteractions(props.index, channelIdx)
  const renderOrder = hasColorChannels ? 0 - channelIdx : undefined // reversed render order for color blending
  return (
    <group visible={props.visible}>
      <instancedMesh
        ref={meshRef}
        name={`${props.lid}_channel_${channelIdx}`}
        args={[meshParams.geometry, material, units]}
        renderOrder={renderOrder}
        userData={userData}
        {...eventHandlers}
      />
      {hasLabels &&
        Array.from({ length: numNeurons }).map((_, i) => {
          const position = positions[i]
          const overrideText =
            position.isHidden && position.hiddenIdx === 0
              ? `(+${numNeurons - MAX_OUTPUT_NEURONS} more ...)`
              : undefined
          if (position.isHidden && position.hiddenIdx !== 0) return null
          return (
            <NeuronLabels
              key={i}
              layer={props}
              neuronIdx={i}
              position={position.pos}
              size={meshParams.labelSize}
              overrideText={overrideText}
            />
          )
        })}
      {props.layerPos === "output" && (
        <YPointer outputLayer={props} positions={positions} />
      )}
    </group>
  )
})

export function useNeuronSpacing({ geometry, spacingFactor }: MeshParams) {
  const neuronSpacing = useSceneStore((s) => s.vis.neuronSpacing)
  return useMemo(() => {
    const size =
      geometry instanceof THREE.BoxGeometry
        ? geometry.parameters.width
        : geometry instanceof THREE.SphereGeometry
        ? geometry.parameters.radius * 2
        : 1
    const factor = spacingFactor ?? 1
    const spacedSize = size * neuronSpacing * factor
    return { size, spacedSize }
  }, [geometry, spacingFactor, neuronSpacing])
}

export interface PosObj {
  pos: Pos
  isHidden?: boolean
  hiddenIdx?: number
}

// when output layer has more than 10 neurons, only the first 5 are shown
const OUTPUT_TRUNC_THRESHOLD = 10
export const MAX_OUTPUT_NEURONS = 5

function useNeuronPositions(props: NeuronLayer, meshRef: MeshRef) {
  const { layerPos, meshParams, tfLayer, hasColorChannels } = props
  const { spacedSize } = useNeuronSpacing(meshParams)
  const [, h, w = 1, _channels = 1] = tfLayer.outputShape as number[]
  const tempObj = useMemo(() => new THREE.Object3D(), [])

  const c = hasColorChannels ? 1 : _channels // for color channels: channel separation is done on layer level

  // TODO: layer activations don't get updated with WebGPU ...
  const layerActivations = useLayerActivations(props.index)
  const [idxMap, setIdxMap] = useState(new Map<number, number>())
  const shouldSort = layerPos === "output" && h > OUTPUT_TRUNC_THRESHOLD
  useLayoutEffect(() => {
    if (!shouldSort || !layerActivations?.activations) return
    const indexed = [...layerActivations.activations].map((v, i) => ({ v, i }))
    const sorted = indexed.toSorted((a, b) => b.v - a.v)
    const newIdxMap = new Map<number, number>()
    sorted.forEach((item, sortedIndex) => {
      newIdxMap.set(item.i, sortedIndex)
    })
    setIdxMap(newIdxMap)
  }, [layerActivations, shouldSort])

  const positions: PosObj[] = useMemo(() => {
    const _h = shouldSort ? MAX_OUTPUT_NEURONS + 1 : h
    const arr = Array.from({ length: h * w * c })
    let hiddenIdx = -1
    return arr.map((_, i) => {
      let sortedIdx = idxMap.get(i) ?? i
      const isHidden = shouldSort && sortedIdx >= MAX_OUTPUT_NEURONS
      if (isHidden) {
        sortedIdx = MAX_OUTPUT_NEURONS
        hiddenIdx++
      }
      const pos = getNeuronPos(sortedIdx, layerPos, _h, w, c, spacedSize)
      return { pos, isHidden, hiddenIdx }
    })
  }, [layerPos, spacedSize, h, w, c, idxMap, shouldSort])

  // has to be useLayoutEffect, otherwise raycasting probably won't work
  useLayoutEffect(() => {
    if (!meshRef.current) return
    for (const [i, position] of positions.entries()) {
      tempObj.position.set(...position.pos)
      // if (position.isHidden) tempObj.scale.set(0, 0, 0)
      // else tempObj.scale.set(1, 1, 1)
      tempObj.updateMatrix()
      meshRef.current?.setMatrixAt(i, tempObj.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [meshRef, tempObj, positions])

  return positions
}

function useColors(props: NeuronLayer, channelIdx: number) {
  const { activationsBuffer, hasColorChannels, channelActivations } = props
  const material = useMemo(
    () => getMaterial(hasColorChannels, channelIdx),
    [hasColorChannels, channelIdx]
  )
  const colorArray = channelActivations[channelIdx]
  const userData: UserData = useMemo(
    () => ({
      activations: activationsBuffer,
      instancedActivations: new THREE.InstancedBufferAttribute(colorArray, 1),
    }),
    [activationsBuffer, colorArray]
  )
  return [material, userData] as const
}
