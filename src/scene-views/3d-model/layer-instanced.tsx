import { memo, useLayoutEffect, useMemo, useRef } from "react"
import * as THREE from "three/webgpu"
import { useSceneStore } from "@/store"
import { useNeuronInteractions } from "./interactions"
import { getNeuronPos, getNeuronSize, type MeshParams } from "@/neuron-layers/layout"
import { NeuronLabels } from "./label"
import { getMaterial } from "./materials"
import { useLayerActivations } from "@/model/activations"
import { YPointer } from "./pointer"
import type { MeshRef, NeuronLayer } from "@/neuron-layers/types"
import type { Pos } from "@/scene-views/3d-model/utils"

type InstancedLayerProps = NeuronLayer & {
  channelIdx: number
  visible: boolean
  measureRef: React.RefObject<THREE.Mesh | null>
}

export interface UserData {
  bufferOffset: number // start index in the shared activations storage buffer (WebGPU)
  instancedActivations: THREE.InstancedBufferAttribute // WebGL fallback
}

export const InstancedLayer = memo(function InstancedLayer(props: InstancedLayerProps) {
  const { meshParams, hasColorChannels, hasLabels, numNeurons } = props
  const { channelIdx, meshRefs, measureRef } = props
  const units = hasColorChannels ? numNeurons / 3 : numNeurons
  const meshRef = meshRefs[channelIdx]
  const positions = useNeuronPositions(props, meshRef)
  const [material, userData] = useColors(props, channelIdx)
  const eventHandlers = useNeuronInteractions(props.index, channelIdx)
  const renderOrder = hasColorChannels ? 0 - channelIdx : undefined // reversed render order for color blending
  return (
    <>
      <group ref={measureRef}>
        <instancedMesh
          ref={meshRef}
          name={`${props.lid}_channel_${channelIdx}`}
          args={[meshParams.geometry, material, units]}
          renderOrder={renderOrder}
          userData={userData}
          visible={props.visible}
          {...eventHandlers}
        />
      </group>
      {hasLabels && (
        <group visible={props.visible}>
          {Array.from({ length: numNeurons }).map((_, i) => {
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
        </group>
      )}
      {props.layerPos === "output" && <YPointer outputLayer={props} positions={positions} />}
    </>
  )
})

export function useNeuronSpacing(meshParams: MeshParams) {
  const neuronSpacing = useSceneStore((s) => s.vis.neuronSpacing)
  return useMemo(() => getNeuronSize(meshParams, neuronSpacing), [meshParams, neuronSpacing])
}

export interface PosObj {
  pos: Pos
  isHidden?: boolean
  hiddenIdx?: number
}

// when output layer has more than 10 neurons, only the first 5 are shown
const OUTPUT_TRUNC_THRESHOLD = 10
const MAX_OUTPUT_NEURONS = 5
const MAX_PARTIAL_UPDATES = 100 // instance matrices uploaded one by one, otherwise the whole buffer

function useNeuronPositions(props: NeuronLayer, meshRef: MeshRef) {
  const { layerPos, meshParams, outputShape, hasColorChannels } = props
  const { spacedSize } = useNeuronSpacing(meshParams)
  const [, h, w = 1, _channels = 1] = outputShape
  const tempObj = useMemo(() => new THREE.Object3D(), [])

  const c = hasColorChannels ? 1 : _channels // for color channels: channel separation is done on layer level

  // TODO: layer activations don't get updated with WebGPU ...
  const layerActivations = useLayerActivations(props.index)
  // sort neurons by activation for output layers w/ many neurons
  const shouldSort = layerPos === "output" && h > OUTPUT_TRUNC_THRESHOLD
  // ranks of the shown neurons only, the others are hidden (single pass instead of sorting, GPT-2: 50257)
  const idxMap = useMemo(() => {
    const acts = layerActivations?.activations
    if (!shouldSort || !acts) return
    const top: number[] = [] // neuron indices, sorted by activation
    for (let i = 0; i < acts.length; i++) {
      if (top.length === MAX_OUTPUT_NEURONS && acts[i] <= acts[top.at(-1)!]) continue
      const rank = top.findIndex((j) => acts[i] > acts[j])
      top.splice(rank === -1 ? top.length : rank, 0, i)
      if (top.length > MAX_OUTPUT_NEURONS) top.pop()
    }
    return new Map(top.map((neuronIdx, rank) => [neuronIdx, rank]))
  }, [layerActivations, shouldSort])

  // sorted: the positions of the shown neurons + one for all hidden ones. Shared by the positions below, so that
  // the layout effect can skip the neurons that didn't move
  const slots = useMemo(() => {
    if (!shouldSort) return
    const numSlots = MAX_OUTPUT_NEURONS + 1
    return Array.from({ length: numSlots }, (_, i) =>
      getNeuronPos(i, layerPos, numSlots, w, c, spacedSize),
    )
  }, [shouldSort, layerPos, w, c, spacedSize])

  const positions: PosObj[] = useMemo(() => {
    const _h = shouldSort ? MAX_OUTPUT_NEURONS + 1 : h
    const arr = Array.from({ length: h * w * c })
    let hiddenIdx = -1
    return arr.map((_, i) => {
      let sortedIdx = idxMap ? (idxMap.get(i) ?? MAX_OUTPUT_NEURONS) : i
      const isHidden = shouldSort && sortedIdx >= MAX_OUTPUT_NEURONS
      if (isHidden) {
        sortedIdx = MAX_OUTPUT_NEURONS
        hiddenIdx++
      }
      const pos = slots?.[sortedIdx] ?? getNeuronPos(sortedIdx, layerPos, _h, w, c, spacedSize)
      return { pos, isHidden, hiddenIdx }
    })
  }, [layerPos, spacedSize, h, w, c, idxMap, shouldSort, slots])

  // has to be useLayoutEffect, otherwise raycasting probably won't work
  // only the neurons that moved (new pos), e.g. output layer: the old and new top neurons (GPT-2: 10 of 50257)
  const written = useRef<{ mesh?: THREE.InstancedMesh | null; positions: PosObj[] }>({
    positions: [],
  })
  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const prev = written.current.mesh === mesh ? written.current.positions : []
    const moved: number[] = []
    for (const [i, position] of positions.entries()) {
      if (position.pos === prev[i]?.pos) continue
      moved.push(i)
      tempObj.position.set(...position.pos)
      // if (position.isHidden) tempObj.scale.set(0, 0, 0)
      // else tempObj.scale.set(1, 1, 1)
      tempObj.updateMatrix()
      mesh.setMatrixAt(i, tempObj.matrix)
    }
    written.current = { mesh, positions }
    if (!moved.length) return
    // upload only the moved matrices (16 floats each), the whole buffer if many moved
    if (moved.length <= MAX_PARTIAL_UPDATES) {
      for (const i of moved) mesh.instanceMatrix.addUpdateRange(i * 16, 16)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [meshRef, tempObj, positions])

  // for measuring (useSize) & raycasting with the new layout. Not when only the ranking changes (output layer):
  // the shown neurons swap places, the bounds stay the same
  const isRanked = !!idxMap
  useLayoutEffect(() => {
    meshRef.current?.computeBoundingBox()
    meshRef.current?.computeBoundingSphere()
  }, [meshRef, layerPos, spacedSize, h, w, c, isRanked])

  return positions
}

export function useColors(props: NeuronLayer, channelIdx: number) {
  const { bufferOffset, hasColorChannels, channelActivations, numNeurons } = props
  const material = useMemo(
    () => getMaterial(hasColorChannels, channelIdx, props.storageNode),
    [hasColorChannels, channelIdx, props.storageNode],
  )
  const colorArray = channelActivations[channelIdx]
  const channelOffset = hasColorChannels ? channelIdx * (numNeurons / 3) : 0
  const userData: UserData = useMemo(
    () => ({
      bufferOffset: bufferOffset + channelOffset,
      instancedActivations: new THREE.InstancedBufferAttribute(colorArray, 1),
    }),
    [bufferOffset, channelOffset, colorArray],
  )
  return [material, userData] as const
}
