import { useLayoutEffect, useMemo } from "react"
import * as THREE from "three"
import { ThreeEvent } from "@react-three/fiber"
import { useStore, isDebug } from "@/store"
import { useAnimatedPosition } from "@/scene/utils"
import { getGridSize, getNeuronPos, MeshParams } from "@/neuron-layers/layout"
import { NeuronLabels } from "./label"
import type { Neuron, MeshRef, NeuronGroupProps } from "@/neuron-layers/types"

export const NeuronGroup = (props: NeuronGroupProps) => {
  const { meshParams, group, material } = props
  const groupRef = useGroupPosition(props)
  const positions = useNeuronPositions(props)
  useColors(group.meshRef, group.neurons)
  // useScale(group.meshRef, group.nidsStr, props.index, group.index)
  const { onPointerOut, ...otherEvHandlers } = useInteractions(group.neurons)
  const renderOrder = 0 - group.index // reversed order for color blending
  // useHelper(groupRef, THREE.BoxHelper, "cyan")
  return (
    <group ref={groupRef} onPointerOut={onPointerOut} renderOrder={renderOrder}>
      <instancedMesh
        ref={group.meshRef}
        name={`layer_${props.index}_group_${group.index}`}
        args={[, , group.neurons.length]}
        {...otherEvHandlers}
      >
        <primitive object={meshParams.geometry} attach={"geometry"} />
        <primitive object={material} attach={"material"} />
      </instancedMesh>
      {props.hasLabels &&
        group.neurons.map((n, i) => (
          <NeuronLabels key={n.nid} neuron={n} position={positions[i]} />
        ))}
    </group>
  )
}

export function useNeuronSpacing({ geometry, spacingFactor }: MeshParams) {
  const neuronSpacing = useStore((s) => s.vis.neuronSpacing)
  const p = geometry.parameters as { width?: number; radius?: number }
  const size = p.width ?? p.radius ?? 1
  const factor = spacingFactor ?? 1
  const spacing = size * neuronSpacing * factor
  return spacing
}

export function useGroupPosition(props: NeuronGroupProps) {
  const { group, layerPos, meshParams, hasColorChannels } = props
  const groupIndex = group.index
  const groupCount = props.groups.length
  const spacing = useNeuronSpacing(meshParams)
  const splitColors = useStore((s) => s.vis.splitColors)
  const [, height, width = 1] = props.tfLayer.outputShape as number[]
  const position = useMemo(() => {
    const GRID_SPACING = 0.6
    const [gHeight, gWidth] = getGridSize(height, width, spacing, GRID_SPACING)
    const groupsPerRow = Math.ceil(Math.sqrt(groupCount))
    const groupsPerColumn = Math.ceil(groupCount / groupsPerRow)
    const offsetY = (groupsPerColumn - 1) * gHeight * 0.5
    const offsetZ = (groupsPerRow - 1) * gWidth * -0.5
    const y = -1 * Math.floor(groupIndex / groupsPerRow) * gHeight + offsetY // row
    const z = (groupIndex % groupsPerRow) * gWidth + offsetZ // column
    const SPLIT_COLORS_OFFSET = 0.05 // to avoid z-fighting
    return layerPos === "input" && hasColorChannels
      ? splitColors
        ? [
            -groupIndex * SPLIT_COLORS_OFFSET,
            -groupIndex * gHeight + (groupCount - 1) * gHeight * 0.5,
            groupIndex * SPLIT_COLORS_OFFSET,
          ] // spread on y-axis
        : [
            groupIndex * SPLIT_COLORS_OFFSET,
            groupIndex * SPLIT_COLORS_OFFSET,
            groupIndex * SPLIT_COLORS_OFFSET,
          ]
      : [0, y, z]
  }, [
    groupIndex,
    groupCount,
    layerPos,
    spacing,
    splitColors,
    height,
    width,
    hasColorChannels,
  ])
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
    if (isDebug()) console.log("upd pos")
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
    // if (isDebug()) console.log("upd colors")
    if (!meshRef.current.instanceColor) {
      const newArr = new Float32Array(neurons.length * 3)
      const newAttr = new THREE.InstancedBufferAttribute(newArr, 3)
      meshRef.current.instanceColor = newAttr
    }
    for (const [i, n] of neurons.entries()) {
      // if (n.color) meshRef.current.setColorAt(i, n.color)
      if (n.color) {
        meshRef.current.instanceColor.array[i * 3] = n.color.rgb[0]
        meshRef.current.instanceColor.array[i * 3 + 1] = n.color.rgb[1]
        meshRef.current.instanceColor.array[i * 3 + 2] = n.color.rgb[2]
      }
    }
    meshRef.current.instanceColor.needsUpdate = true
  }, [meshRef, neurons])
}

/* 
function useScale(meshRef: MeshRef, nids: string, lIdx: number, gIdx: number) {
  // use string to avoid unnecessary updates
  const { selectedNid } = useLocalSelected(lIdx, gIdx)
  const invalidate = useThree(({ invalidate }) => invalidate)
  const tempMatrix = useMemo(() => new THREE.Matrix4(), [])
  const tempScale = useMemo(() => new THREE.Matrix4(), [])
  useEffect(() => {
    if (!meshRef.current) return
    if (isDebug()) console.log("upd scale")
    const base = 1
    const highlight = 1.5
    for (const [i, nid] of nids.split(",").entries()) {
      meshRef.current.getMatrixAt(i, tempMatrix)
      const elements = tempMatrix.elements
      const currentScale = Math.cbrt(elements[0] * elements[5] * elements[10])
      const targetScale = nid === selectedNid ? base * highlight : base
      const scaleFactor = targetScale / currentScale
      tempScale.makeScale(scaleFactor, scaleFactor, scaleFactor)
      tempMatrix.multiply(tempScale)
      meshRef.current.setMatrixAt(i, tempMatrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
    invalidate()
  }, [meshRef, selectedNid, invalidate, nids, tempMatrix, tempScale])
} */

function useInteractions(groupedNeurons: Neuron[]) {
  const toggleSelected = useStore((s) => s.toggleSelected)
  const toggleHovered = useStore((s) => s.toggleHovered)
  const eventHandlers = useMemo(() => {
    const result = {
      onPointerOver: (e: ThreeEvent<PointerEvent>) => {
        if (e.buttons) return
        document.body.style.cursor = "pointer"
        toggleHovered(groupedNeurons[e.instanceId as number])
      },
      onPointerOut: () => {
        document.body.style.cursor = "default"
        toggleHovered(null)
      },
      onClick: (e: ThreeEvent<PointerEvent>) => {
        const neuron = groupedNeurons[e.instanceId as number]
        if (useStore.getState().isDebug) console.log(neuron)
        toggleSelected(neuron)
      },
    }
    return result
  }, [groupedNeurons, toggleHovered, toggleSelected])
  return eventHandlers
}
