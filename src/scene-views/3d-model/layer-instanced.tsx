import { memo, useEffect, useLayoutEffect, useMemo } from "react"
import * as THREE from "three"
import { useSceneStore } from "@/store"
import { useLayerActivations } from "@/model/activations"
import { useAnimatedPosition } from "@/scene-views/3d-model/utils"
import { useNeuronInteractions } from "./interactions"
import { getGridSize, getNeuronPos, MeshParams } from "@/neuron-layers/layout"
import { NeuronLabels } from "./label"
import { createShaderMaterial } from "./materials"
import type { MeshRef, NeuronLayer } from "@/neuron-layers/types"
import type { LayerActivations } from "@/model"
import { getMaxAbs } from "@/data/utils"

type InstancedLayerProps = NeuronLayer & {
  channelIdx?: number
}

export const InstancedLayer = memo(function InstancedLayer(
  props: InstancedLayerProps
) {
  const { meshParams, hasColorChannels, hasLabels, numNeurons } = props
  const { index, channelIdx = 0, meshRefs } = props
  const units = hasColorChannels ? numNeurons / 3 : numNeurons
  const meshRef = hasColorChannels ? meshRefs[channelIdx] : meshRefs[0]
  const material = useMaterial(hasColorChannels, channelIdx)
  const groupRef = useGroupPosition(props, channelIdx)
  const positions = useNeuronPositions(props, meshRef)
  const activations = useLayerActivations(props.index)
  const colorArr = useColorData(props)
  useColors(meshRef, activations)
  const eventHandlers = useNeuronInteractions(index, channelIdx)
  const renderOrder = hasColorChannels ? 0 - channelIdx : undefined // reversed render order for color blending
  return (
    <group ref={groupRef}>
      <instancedMesh
        ref={meshRef}
        name={`layer_${props.index}_group_${channelIdx}`}
        args={[, , units]}
        renderOrder={renderOrder}
        {...eventHandlers}
      >
        <primitive object={meshParams.geometry} attach={"geometry"} />
        <primitive object={material} attach={"material"} />
        <instancedBufferAttribute args={[colorArr, 1]} attach="instanceColor" />
      </instancedMesh>
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

const rMaterial = createShaderMaterial({ addBlend: true, basePos: [255, 0, 0] })
const gMaterial = createShaderMaterial({ addBlend: true, basePos: [0, 255, 0] })
const bMaterial = createShaderMaterial({ addBlend: true, basePos: [0, 0, 255] })
const blendingMaterials = [rMaterial, gMaterial, bMaterial]
// const activationMaterial = createShaderMaterial()

function useMaterial(hasColorChannels: boolean, channelIdx = 0) {
  const splitColors = useSceneStore((s) => s.vis.splitColors)
  const material = useMemo(() => {
    return hasColorChannels
      ? blendingMaterials[channelIdx]
      : createShaderMaterial() // activationMaterial recreated for every layer to save custom uniforms (maxAbsActivation)
  }, [hasColorChannels, channelIdx])

  useEffect(() => {
    if (hasColorChannels) return
    return () => {
      material.dispose()
    }
  }, [material, hasColorChannels])

  useEffect(() => {
    if (!hasColorChannels) return
    material.blending = splitColors
      ? THREE.NormalBlending
      : THREE.AdditiveBlending
  }, [material, splitColors, hasColorChannels])

  return material
}

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

function useColors(meshRef: MeshRef, activations?: LayerActivations) {
  useLayoutEffect(() => {
    if (!meshRef.current || !meshRef.current.instanceColor) return
    if (!activations) return
    // activations is only used as reactive trigger here
    // color buffer is directly changed in useActivations

    const maxAbs = getMaxAbs(activations.activations)
    const material = meshRef.current.material as THREE.Material
    material.userData.uniforms.maxAbsActivation.value = maxAbs
    meshRef.current.instanceColor.needsUpdate = true
  }, [meshRef, activations])
}

function useColorData(props: InstancedLayerProps): Float32Array {
  // for color layers: create a new view on the layer color buffer that includes only the values for the given channelIdx
  // layer color buffer has to be like: [...allRed, ...allGreen, ...allBlue], see activations.ts
  const { hasColorChannels, channelIdx = 0, numNeurons } = props
  const { activations } = props
  return useMemo(() => {
    if (!hasColorChannels) return activations
    const units = numNeurons / 3
    const offset = channelIdx * units * 4 // 4 bytes per float32 value
    const length = units
    return new Float32Array(activations.buffer, offset, length)
  }, [hasColorChannels, activations, channelIdx, numNeurons])
}
