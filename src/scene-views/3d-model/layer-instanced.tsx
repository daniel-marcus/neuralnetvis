import { memo, useEffect, useLayoutEffect, useMemo } from "react"
import * as THREE from "three/webgpu"
import { useSceneStore } from "@/store"
import { useLayerActivations } from "@/model/activations"
import { useAnimatedPosition } from "@/scene-views/3d-model/utils"
import { useNeuronInteractions } from "./interactions"
import { getGridSize, getNeuronPos, MeshParams } from "@/neuron-layers/layout"
import { NeuronLabels } from "./label"
import { getMaxAbs } from "@/data/utils"
import { activationColor } from "./materials-tsl"
import type { MeshRef, NeuronLayer } from "@/neuron-layers/types"
import { Normalization } from "./materials-glsl"

type InstancedLayerProps = NeuronLayer & {
  channelIdx?: number
}

interface UserData {
  activations: THREE.InstancedBufferAttribute
  maxAbs: number
  normalization: (typeof Normalization)[keyof typeof Normalization]
}

export const InstancedLayer = memo(function InstancedLayer(
  props: InstancedLayerProps
) {
  const { meshParams, hasColorChannels, hasLabels, numNeurons } = props
  const { index, channelIdx = 0, channelActivations, meshRefs } = props
  const units = hasColorChannels ? numNeurons / 3 : numNeurons
  const meshRef = meshRefs[channelIdx]

  const activations = useMemo(() => {
    const actArr = channelActivations[channelIdx]
    return new THREE.InstancedBufferAttribute(actArr, 1)
  }, [channelActivations, channelIdx])

  const isSoftmax = props.tfLayer.getConfig().activation === "softmax"
  const { PER_LAYER_MAX_ABS, NONE } = Normalization
  const userData: UserData = {
    activations,
    maxAbs: 0,
    normalization: isSoftmax ? NONE : PER_LAYER_MAX_ABS,
  }

  const groupRef = useGroupPosition(props, channelIdx)
  const positions = useNeuronPositions(props, meshRef)
  const material = useColors(props, meshRef, channelIdx)
  const eventHandlers = useNeuronInteractions(index, channelIdx)
  const renderOrder = hasColorChannels ? 0 - channelIdx : undefined // reversed render order for color blending
  return (
    <group ref={groupRef}>
      <instancedMesh
        ref={meshRef}
        name={`layer_${props.index}_channel_${channelIdx}`}
        args={[meshParams.geometry, material, units]}
        renderOrder={renderOrder}
        userData={userData}
        {...eventHandlers}
      />
      {hasLabels &&
        Array.from({ length: numNeurons }).map((_, i) => (
          <NeuronLabels
            key={i}
            layer={props}
            neuronIdx={i}
            position={positions[i]}
            size={meshParams.labelSize}
          />
        ))}
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

export function useGroupPosition(layer: NeuronLayer, channelIdx = 0) {
  // only used for color channels
  const { meshParams, hasColorChannels } = layer
  const numChannels = hasColorChannels ? 3 : 1
  const { spacedSize } = useNeuronSpacing(meshParams)
  const splitColors = useSceneStore((s) => s.vis.splitColors)
  const [, h, w = 1] = layer.tfLayer.outputShape as number[]
  const position = useMemo(() => {
    const [gHeight] = getGridSize(h, w, spacedSize, spacedSize)

    const OFFSET = 0.05 // to avoid z-fighting
    const splitY = -channelIdx * gHeight + (numChannels - 1) * gHeight * 0.5
    return hasColorChannels
      ? splitColors
        ? [-channelIdx * OFFSET, splitY, channelIdx * OFFSET] // spread on y-axis
        : [channelIdx * OFFSET, -channelIdx * OFFSET, -channelIdx * OFFSET]
      : [0, 0, 0]
  }, [channelIdx, numChannels, spacedSize, splitColors, h, w, hasColorChannels])
  const groupRef = useAnimatedPosition(position, 0.1)
  return groupRef
}

function useNeuronPositions(props: NeuronLayer, meshRef: MeshRef) {
  const { layerPos, meshParams, tfLayer, hasColorChannels } = props
  const { spacedSize } = useNeuronSpacing(meshParams)
  const [, h, w = 1, _channels = 1] = tfLayer.outputShape as number[]
  const tempObj = useMemo(() => new THREE.Object3D(), [])

  const c = hasColorChannels ? 1 : _channels // for color channels: channel separation is done on layer level

  const positions = useMemo(() => {
    const arr = Array.from({ length: h * w * c })
    return arr.map((_, i) => getNeuronPos(i, layerPos, h, w, c, spacedSize))
  }, [layerPos, spacedSize, h, w, c])

  // has to be useLayoutEffect, otherwise raycasting probably won't work
  useLayoutEffect(() => {
    if (!meshRef.current) return
    for (const [i, position] of positions.entries()) {
      tempObj.position.set(...position)
      tempObj.updateMatrix()
      meshRef.current?.setMatrixAt(i, tempObj.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [meshRef, tempObj, positions])

  return positions
}

function useColors(layer: NeuronLayer, meshRef: MeshRef, channelIdx: number) {
  const { hasColorChannels } = layer

  const material = useMemo(() => {
    // TODO resuse materials? or dispose correctly?
    const material = hasColorChannels
      ? new THREE.MeshBasicNodeMaterial({ blending: THREE.AdditiveBlending })
      : new THREE.MeshStandardNodeMaterial()
    material.colorNode = activationColor(
      hasColorChannels ? channelIdx : undefined
    )
    return material
  }, [hasColorChannels, channelIdx])

  const activationUpdTrigger = useLayerActivations(layer.index)

  useEffect(() => {
    if (!meshRef.current?.userData.activations || !activationUpdTrigger) return
    const maxAbs = getMaxAbs(activationUpdTrigger.activations)
    meshRef.current.userData.maxAbs = maxAbs
    meshRef.current.userData.activations.needsUpdate = true
    console.log(meshRef.current)
  }, [activationUpdTrigger, meshRef])

  return material
}
