import { memo, useEffect, useLayoutEffect, useMemo } from "react"
import * as THREE from "three"
import { useSceneStore, useHasFocussedLayer } from "@/store"
import { useLayerActivations } from "@/model/activations"
import { useAnimatedPosition } from "@/scene-views/3d-model/utils"
import { useLayerInteractions, useNeuronInteractions } from "./interactions"
import { getGridSize, getNeuronPos, MeshParams } from "@/neuron-layers/layout"
import { NeuronLabels } from "./label"
import type { MeshRef, NeuronLayer } from "@/neuron-layers/types"
import type { LayerActivations } from "@/model"

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
  const material = useMaterial(hasColorChannels)
  const groupRef = useGroupPosition(props, channelIdx)
  const positions = useNeuronPositions(props, meshRef)
  const activations = useLayerActivations(props.index)
  const colorArray = useColorArray(props)
  useColors(meshRef, activations)

  const isActive = useSceneStore((s) => s.isActive)
  const hasFocussed = useHasFocussedLayer()
  const noFocussed = isActive && !hasFocussed
  const [measureRef, hoverMesh] = useLayerInteractions(props, noFocussed)
  const interactive = isActive && hasFocussed
  const eventHandlers = useNeuronInteractions(index, interactive, channelIdx)

  // reversed render order for color blending
  const renderOrder = hasColorChannels ? 0 - channelIdx : undefined
  return (
    <group ref={groupRef}>
      <group ref={measureRef}>
        <instancedMesh
          ref={meshRef}
          name={`layer_${props.index}_group_${channelIdx}`}
          args={[, , units]}
          renderOrder={renderOrder}
          {...eventHandlers}
        >
          <primitive object={meshParams.geometry} attach={"geometry"} />
          <primitive object={material} attach={"material"} />
          <instancedBufferAttribute
            args={[colorArray, 3]}
            attach="instanceColor"
          />
        </instancedMesh>
      </group>
      {hoverMesh}
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

const standardMaterial = new THREE.MeshStandardMaterial()
const blendingMaterial = new THREE.MeshBasicMaterial({
  blending: THREE.AdditiveBlending,
})

function useMaterial(hasColorChannels: boolean) {
  const splitColors = useSceneStore((s) => s.vis.splitColors)
  return hasColorChannels && !splitColors ? blendingMaterial : standardMaterial
}

export function useNeuronSpacing({ geometry, spacingFactor }: MeshParams) {
  const neuronSpacing = useSceneStore((s) => s.vis.neuronSpacing)
  const p = geometry.parameters as { width?: number; radius?: number }
  const size = p.width ?? p.radius ?? 1
  const factor = spacingFactor ?? 1
  const spacing = size * neuronSpacing * factor
  return spacing
}

export function useGroupPosition(layer: NeuronLayer, channelIdx = 0) {
  // only used for color channels
  const { meshParams, hasColorChannels } = layer
  const numChannels = hasColorChannels ? 3 : 1
  const spacing = useNeuronSpacing(meshParams)
  const splitColors = useSceneStore((s) => s.vis.splitColors)
  const [, h, w = 1] = layer.tfLayer.outputShape as number[]
  const position = useMemo(() => {
    const GRID_SPACING = 0.6
    const [gHeight] = getGridSize(h, w, spacing, GRID_SPACING)

    const OFFSET = 0.05 // to avoid z-fighting
    const splitY = -channelIdx * gHeight + (numChannels - 1) * gHeight * 0.5
    return hasColorChannels
      ? splitColors
        ? [-channelIdx * OFFSET, splitY, channelIdx * OFFSET] // spread on y-axis
        : [channelIdx * OFFSET, -channelIdx * OFFSET, -channelIdx * OFFSET]
      : [0, 0, 0]
  }, [channelIdx, numChannels, spacing, splitColors, h, w, hasColorChannels])
  const groupRef = useAnimatedPosition(position, 0.1)
  return groupRef
}

function useNeuronPositions(props: NeuronLayer, meshRef: MeshRef) {
  const { layerPos, meshParams, tfLayer, hasColorChannels } = props
  const spacing = useNeuronSpacing(meshParams)
  const [, h, w = 1, _channels = 1] = tfLayer.outputShape as number[]
  const tempObj = useMemo(() => new THREE.Object3D(), [])

  const c = hasColorChannels ? 1 : _channels // for color channels: channel separation is done on layer level

  const positions = useMemo(() => {
    const arr = Array.from({ length: h * w * c })
    return arr.map((_, i) => getNeuronPos(i, layerPos, h, w, c, spacing))
  }, [layerPos, spacing, h, w, c])

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
  useEffect(() => {
    if (!meshRef.current || !meshRef.current.instanceColor) return
    // activations is only used as reactive trigger here
    // color buffer is directly changed in useActivations
    meshRef.current.instanceColor.needsUpdate = true
  }, [meshRef, activations])
}

function useColorArray(props: InstancedLayerProps): Float32Array {
  // for color layers: create a new view on the layer color buffer that includes only the values for the given channelIdx
  // layer color buffer has to be like: [...allRed, ...allGreen, ...allBlue], see activations.ts
  const { hasColorChannels, channelIdx = 0, numNeurons, rgbColors } = props
  return useMemo(() => {
    if (!hasColorChannels) return rgbColors
    const offset = channelIdx * numNeurons * 4 // 4 bytes per float32 value
    const length = numNeurons
    return new Float32Array(rgbColors.buffer, offset, length)
  }, [hasColorChannels, rgbColors, channelIdx, numNeurons])
}
