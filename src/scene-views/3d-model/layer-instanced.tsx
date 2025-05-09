import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react"
import * as THREE from "three/webgpu"

import {
  mix,
  storage,
  instanceIndex,
  uniform,
  vec3,
  max,
  float,
  abs,
  pow,
} from "three/tsl"

import { useSceneStore } from "@/store"
import { useLayerActivations } from "@/model/activations"
import { useAnimatedPosition } from "@/scene-views/3d-model/utils"
import { useNeuronInteractions } from "./interactions"
import { getGridSize, getNeuronPos, MeshParams } from "@/neuron-layers/layout"
import { NeuronLabels } from "./label"
import { createShaderMaterial, normalizeColor } from "./materials"
import { getMaxAbs } from "@/data/utils"
import type { MeshRef, NeuronLayer } from "@/neuron-layers/types"
import { NEG_BASE, POS_BASE, ZERO_BASE } from "@/utils/colors"

type InstancedLayerProps = NeuronLayer & {
  channelIdx?: number
}

export const InstancedLayer = memo(function InstancedLayer(
  props: InstancedLayerProps
) {
  const { meshParams, hasColorChannels, hasLabels, numNeurons } = props
  const { index, channelIdx = 0, meshRefs } = props
  const units = hasColorChannels ? numNeurons / 3 : numNeurons

  const meshRef = meshRefs[channelIdx]

  const groupRef = useGroupPosition(props, channelIdx)
  const positions = useNeuronPositions(props, meshRef)

  const material = useColors(props, meshRef, channelIdx)

  const eventHandlers = useNeuronInteractions(index, channelIdx)
  const renderOrder = hasColorChannels ? 0 - channelIdx : undefined // reversed render order for color blending
  return (
    <group ref={groupRef}>
      <instancedMesh
        ref={meshRef}
        name={`layer_${props.index}_group_${channelIdx}`}
        args={[meshParams.geometry, material, units]}
        renderOrder={renderOrder}
        {...eventHandlers}
      ></instancedMesh>
    </group>
  )
})

/*
      {hasLabels &&
        false &&
        Array.from({ length: numNeurons }).map((_, i) => (
          <NeuronLabels
            key={i}
            layer={props}
            neuronIdx={i}
            position={positions[i]}
            size={meshParams.labelSize}
          />
        ))}*/

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

const baseZero = uniform(vec3(...normalizeColor(ZERO_BASE)))
const basePos = uniform(vec3(...normalizeColor(POS_BASE)))
const baseNeg = uniform(vec3(...normalizeColor(NEG_BASE)))

const newStandardMaterial = () => new THREE.MeshStandardNodeMaterial()
const newBasicMaterial = () => new THREE.MeshBasicNodeMaterial()

function useColors(layer: NeuronLayer, meshRef: MeshRef, channelIdx: number) {
  const { channelActivations, hasColorChannels } = layer
  const activationsArr = channelActivations[channelIdx]

  const splitColors = useSceneStore((s) => s.vis.splitColors)
  const material = useMemo(() => {
    if (hasColorChannels && !splitColors) return newBasicMaterial()
    return newStandardMaterial()
    // TODO resuse materials? or dispose correctly?
  }, [hasColorChannels, splitColors, channelIdx])

  const maxAbsRef = useRef(uniform(1.0))

  const attr = useMemo(
    () => new THREE.StorageBufferAttribute(activationsArr, 1),
    [activationsArr]
  )

  const isSoftmax = layer.tfLayer.getConfig().activation === "softmax"

  useEffect(() => {
    if (!meshRef.current) return
    meshRef.current.geometry.setAttribute("activations", attr)

    const maxAbs = maxAbsRef.current
    const activation = storage(attr).element(instanceIndex)

    const normalized = isSoftmax
      ? activation
      : activation.div(max(maxAbs, float(1e-6)))

    const baseNode = normalized
      .greaterThanEqual(float(0))
      .select(basePos, baseNeg)

    const srgbColorNode = mix(baseZero, baseNode, abs(normalized))
    const gammaCorrectedNode = pow(srgbColorNode, float(2.2))

    material.colorNode = gammaCorrectedNode
  }, [meshRef, material, isSoftmax])

  const activationUpdTrigger = useLayerActivations(layer.index)

  useLayoutEffect(() => {
    // activations is only used as reactive trigger here
    // color buffer is directly changed in useActivations
    if (!meshRef.current || !activationUpdTrigger) return
    maxAbsRef.current.value = getMaxAbs(activationUpdTrigger.activations)
    attr.needsUpdate = true
  }, [meshRef, activationUpdTrigger, attr])

  return material
}
