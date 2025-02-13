import { useEffect, useLayoutEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { ThreeEvent, useThree } from "@react-three/fiber"

import { useAnimatedPosition } from "@/scene/utils"
import { useLocalSelected, useSelected } from "@/neuron-layers/neuron-select"
import { debug } from "@/utils/debug"
import { useVisConfigStore } from "@/scene/vis-config"
import { getGridSize, getNeuronPos, MeshParams } from "@/neuron-layers/layout"
import { NeuronLabels } from "./label"

import type { Neuron, MeshRef, NeuronGroupProps } from "@/neuron-layers/types"

export const NeuronGroup = (props: NeuronGroupProps) => {
  const { meshParams, group, groupedNeurons } = props
  const groupRef = useGroupPosition(props)
  const positions = useNeuronPositions(props)
  useColors(group.meshRef, groupedNeurons)
  useScale(group.meshRef, group.nidsStr, props.index, group.index)
  const materialRef = useAdditiveBlending(props.hasColorChannels)
  const { onPointerOut, ...otherEvHandlers } = useInteractions(groupedNeurons)
  return (
    <group ref={groupRef} onPointerOut={onPointerOut}>
      <instancedMesh
        ref={group.meshRef}
        name={`layer_${props.index}_group_${group.index}`}
        args={[, , groupedNeurons.length]}
        {...otherEvHandlers}
      >
        <primitive object={meshParams.geometry} attach={"geometry"} />
        <meshStandardMaterial ref={materialRef} />
      </instancedMesh>
      {props.hasLabels &&
        groupedNeurons.map((n, i) => (
          <NeuronLabels key={n.nid} neuron={n} position={positions[i]} />
        ))}
    </group>
  )
}

export function useNeuronSpacing({ geometry, spacingFactor }: MeshParams) {
  const neuronSpacing = useVisConfigStore((s) => s.neuronSpacing)
  const p = geometry.parameters as { width?: number; radius?: number }
  const size = p.width ?? p.radius ?? 1
  const factor = spacingFactor ?? 1
  const spacing = size * neuronSpacing * factor
  return spacing
}

export function useGroupPosition(props: NeuronGroupProps) {
  const { group, layerPos, meshParams } = props
  const groupIndex = group.index
  const groupCount = props.groups.length
  const spacing = useNeuronSpacing(meshParams)
  const splitColors = useVisConfigStore((s) => s.splitColors)
  const [, height, width = 1] = props.tfLayer.outputShape as number[]
  const position = useMemo(() => {
    const GRID_SPACING = 0.6
    const [gridHeight, gridWidth] = getGridSize(height, width, spacing).map(
      (v) => v + GRID_SPACING
    )
    const groupsPerRow = Math.ceil(Math.sqrt(groupCount))
    const groupsPerColumn = Math.ceil(groupCount / groupsPerRow)
    const offsetY = (groupsPerColumn - 1) * gridWidth * 0.5
    const offsetZ = (groupsPerRow - 1) * gridHeight * -0.5
    const y = -1 * Math.floor(groupIndex / groupsPerRow) * gridHeight + offsetY // row
    const z = (groupIndex % groupsPerRow) * gridWidth + offsetZ // column
    const SPLIT_COLORS_OFFSET = 0.05 // to avoid z-fighting
    return layerPos === "input"
      ? splitColors
        ? [
            groupIndex * SPLIT_COLORS_OFFSET,
            -groupIndex * SPLIT_COLORS_OFFSET,
            -groupIndex * gridWidth + (groupCount - 1) * gridWidth * 0.5,
          ] // spread on z-axis
        : [
            groupIndex * SPLIT_COLORS_OFFSET,
            -groupIndex * SPLIT_COLORS_OFFSET,
            -groupIndex * SPLIT_COLORS_OFFSET,
          ]
      : [0, y, z]
  }, [groupIndex, groupCount, layerPos, spacing, splitColors, height, width])
  const [groupRef] = useAnimatedPosition(position, 0.1)
  return groupRef
}

function useNeuronPositions(props: NeuronGroupProps) {
  const { layerPos, group, meshParams, tfLayer } = props
  const spacing = useNeuronSpacing(meshParams)
  const [, height, width = 1] = tfLayer.outputShape as number[]
  const tempObj = useMemo(() => new THREE.Object3D(), [])

  const positions = useMemo(() => {
    return Array.from({ length: height * width }, (_, i) =>
      getNeuronPos(i, layerPos, height, width, spacing)
    )
  }, [layerPos, spacing, height, width])

  // has to be useLayoutEffect, otherwise raycasting probably won't work
  useLayoutEffect(() => {
    if (!group.meshRef.current) return
    if (debug()) console.log("upd pos")
    for (const [i, position] of positions.entries()) {
      tempObj.position.set(...position)
      tempObj.updateMatrix()
      group.meshRef.current?.setMatrixAt(i, tempObj.matrix)
    }
    group.meshRef.current.instanceMatrix.needsUpdate = true
  }, [group.meshRef, tempObj, positions])

  return positions
}

function useColors(meshRef: MeshRef, neurons: Neuron[]) {
  useLayoutEffect(() => {
    if (!meshRef.current) return
    if (debug()) console.log("upd colors")
    for (const [i, n] of neurons.entries()) {
      if (n.color) meshRef.current.setColorAt(i, n.color)
      else console.warn("no color", n)
    }
    if (!meshRef.current.instanceColor) return
    meshRef.current.instanceColor.needsUpdate = true
  }, [meshRef, neurons])
}

function useScale(
  meshRef: MeshRef,
  nidsStr: string,
  layerIndex: number,
  groupIndex: number
) {
  // use string to avoid unnecessary updates
  const { selectedNid } = useLocalSelected(layerIndex, groupIndex)
  const { invalidate } = useThree()
  const tempMatrix = useMemo(() => new THREE.Matrix4(), [])
  const tempScale = useMemo(() => new THREE.Matrix4(), [])
  useEffect(() => {
    if (!meshRef.current) return
    const nids = nidsStr.split(",")
    if (debug()) console.log("upd scale")
    const baseScale = 1
    const highlightScale = 1.5
    for (const [i, nid] of nids.entries()) {
      meshRef.current.getMatrixAt(i, tempMatrix)
      const elements = tempMatrix.elements
      const currentScale = Math.cbrt(elements[0] * elements[5] * elements[10])
      const targetScale =
        nid === selectedNid ? baseScale * highlightScale : baseScale
      const scaleFactor = targetScale / currentScale
      tempScale.makeScale(scaleFactor, scaleFactor, scaleFactor)
      tempMatrix.multiply(tempScale)
      meshRef.current.setMatrixAt(i, tempMatrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
    invalidate()
  }, [meshRef, selectedNid, invalidate, nidsStr, tempMatrix, tempScale]) // neurons
}

function useAdditiveBlending(hasColorChannels: boolean) {
  const splitColors = useVisConfigStore((s) => s.splitColors)
  const active = hasColorChannels && !splitColors
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null)
  useEffect(() => {
    if (!materialRef.current) return
    const blending = active ? THREE.AdditiveBlending : THREE.NormalBlending
    materialRef.current.blending = blending
    materialRef.current.needsUpdate = true
  }, [active])
  return materialRef
}

function useInteractions(groupedNeurons: Neuron[]) {
  const { toggleSelected, toggleHovered } = useSelected()
  const eventHandlers = useMemo(() => {
    const result = {
      onPointerOver: (e: ThreeEvent<PointerEvent>) => {
        if (e.buttons) return
        const neuron = groupedNeurons[e.instanceId as number]
        if (!neuron) return
        document.body.style.cursor = "pointer"
        toggleHovered(neuron)
      },
      onPointerOut: () => {
        document.body.style.cursor = "default"
        toggleHovered(null)
      },
      onClick: (e: ThreeEvent<PointerEvent>) => {
        const neuron = groupedNeurons[e.instanceId as number]
        if (!neuron) return
        toggleSelected(neuron)
      },
    }
    return result
  }, [groupedNeurons, toggleHovered, toggleSelected])
  return eventHandlers
}
