import { useLayoutEffect, useMemo } from "react"
import * as THREE from "three"
import { useSceneStore, useHasFocussedLayer } from "@/store"
import { useLayerActivations } from "@/model/activations"
import { useAnimatedPosition } from "@/scene-views/3d-model/utils"
import { useLayerInteractions, useNeuronInteractions } from "./interactions"
import { getGridSize, getNeuronPos, MeshParams } from "@/neuron-layers/layout"
import { NeuronLabels } from "./label"
import type { Neuron, MeshRef, NeuronGroupProps } from "@/neuron-layers/types"
import type { LayerActivations } from "@/model"

export const InstancedLayer = (props: NeuronGroupProps) => {
  const { meshParams, group, hasColorChannels, hasLabels } = props
  const { neurons } = group
  const material = useMaterial(hasColorChannels)
  const groupRef = useGroupPosition(props)
  const positions = useNeuronPositions(props)
  const activations = useLayerActivations(props.index)
  useColors(group.meshRef, group.neurons, hasColorChannels, activations)

  const isActive = useSceneStore((s) => s.isActive)
  const hasFocussed = useHasFocussedLayer()
  const noFocussed = isActive && !hasFocussed
  const [measureRef, hoverMesh] = useLayerInteractions(props, noFocussed)
  const eventHandlers = useNeuronInteractions(neurons, isActive && hasFocussed)

  // reversed render order for color blending
  const renderOrder = props.layerPos === "input" ? 0 - group.index : undefined
  return (
    <group ref={groupRef}>
      <group ref={measureRef}>
        <instancedMesh
          ref={group.meshRef}
          name={`layer_${props.index}_group_${group.index}`}
          args={[, , neurons.length]}
          renderOrder={renderOrder}
          {...eventHandlers}
        >
          <primitive object={meshParams.geometry} attach={"geometry"} />
          <primitive object={material} attach={"material"} />
        </instancedMesh>
      </group>
      {hoverMesh}
      {hasLabels &&
        neurons.map((n, i) => (
          <NeuronLabels key={n.nid} neuron={n} position={positions[i]} />
        ))}
    </group>
  )
}

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

export function useGroupPosition(props: NeuronGroupProps) {
  const { group, meshParams, hasColorChannels } = props
  const groupIdx = group.index
  const numGroups = props.groups.length
  const spacing = useNeuronSpacing(meshParams)
  const splitColors = useSceneStore((s) => s.vis.splitColors)
  const [, h, w = 1] = props.tfLayer.outputShape as number[]
  const position = useMemo(() => {
    const GRID_SPACING = 0.6
    const [gHeight] = getGridSize(h, w, spacing, GRID_SPACING)

    const OFFSET = 0.05 // to avoid z-fighting
    const splitY = -groupIdx * gHeight + (numGroups - 1) * gHeight * 0.5
    return hasColorChannels
      ? splitColors
        ? [-groupIdx * OFFSET, splitY, groupIdx * OFFSET] // spread on y-axis
        : [groupIdx * OFFSET, -groupIdx * OFFSET, -groupIdx * OFFSET]
      : [0, 0, 0]
  }, [groupIdx, numGroups, spacing, splitColors, h, w, hasColorChannels])
  const groupRef = useAnimatedPosition(position, 0.1)
  return groupRef
}

function useNeuronPositions(props: NeuronGroupProps) {
  const { layerPos, group, meshParams, tfLayer, hasColorChannels } = props
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
    if (!group.meshRef.current) return
    for (const [i, position] of positions.entries()) {
      tempObj.position.set(...position)
      tempObj.updateMatrix()
      group.meshRef.current?.setMatrixAt(i, tempObj.matrix)
    }
    group.meshRef.current.instanceMatrix.needsUpdate = true
  }, [group.meshRef, tempObj, positions])

  return positions
}

function useColors(
  meshRef: MeshRef,
  neurons: Neuron[],
  hasColorChannels: boolean,
  activations?: LayerActivations
) {
  useLayoutEffect(() => {
    if (!meshRef.current) return

    const allColors = activations?.colors ?? []
    if (!meshRef.current.instanceColor) {
      const newArr = new Float32Array(neurons.length * 3).fill(0)
      const newAttr = new THREE.InstancedBufferAttribute(newArr, 3)
      meshRef.current.instanceColor = newAttr
    }
    for (const [i, n] of neurons.entries()) {
      const color = allColors[n.index]
      if (color) {
        const offset = i * 3
        meshRef.current.instanceColor.array[offset] = color.rgb[0]
        meshRef.current.instanceColor.array[offset + 1] = color.rgb[1]
        meshRef.current.instanceColor.array[offset + 2] = color.rgb[2]
      }
    }
    meshRef.current.instanceColor.needsUpdate = true
  }, [meshRef, neurons, activations, hasColorChannels])
}
