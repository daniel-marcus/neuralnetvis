import { useEffect, useLayoutEffect, useMemo, useRef } from "react"
import { InstancedMesh } from "three"
import { ThreeEvent, useThree } from "@react-three/fiber"

import { useAnimatedPosition } from "@/scene/animated-position"
import * as THREE from "three"
import {
  MeshParams,
  getGridSize,
  getNeuronPosition,
} from "@/neuron-layers/layer-layout"
import { LayerPos, GroupDef } from "@/neuron-layers/layer"
import { Neuron } from "@/neuron-layers/neuron"
import { NeuronLabels } from "./label"
import { useLocalSelected, useSelected } from "@/neuron-layers/neuron-select"
import { debug } from "@/utils/debug"
import { useVisConfigStore } from "@/scene/vis-config"
import { useDatasetStore } from "@/data/data"
import { getNeuronColor } from "./colors"
import { LayerProps } from "./layer"

export type InstancedMeshRef = React.RefObject<InstancedMesh | null>

export type NeuronGroupProps = LayerProps &
  GroupDef & {
    groupIndex: number
    groupCount: number
    groupedNeurons: Neuron[]
  }

export const NeuronGroup = (props: NeuronGroupProps) => {
  const { groupedNeurons, groupIndex, nidsStr } = props
  const { index: layerIndex, layerPos, meshParams } = props
  const { hasLabels, hasColorChannels } = props
  const spacing = useNeuronSpacing(meshParams)
  const meshRef = useRef<InstancedMesh | null>(null!)
  useNeuronRefs(props, meshRef)
  const groupRef = useGroupPosition(props)
  const outputShape = props.tfLayer.outputShape as number[]
  const [, height, width = 1] = outputShape
  useNeuronPositions(meshRef, layerPos, spacing, outputShape)
  const isRegression =
    useDatasetStore((s) => s.isRegression) && layerPos === "output"
  useColors(meshRef, groupedNeurons, hasColorChannels, isRegression)
  const { onPointerOut, ...otherEvHandlers } = useInteractions(groupedNeurons)
  useScale(meshRef, nidsStr, layerIndex, groupIndex)
  const materialRef = useAdditiveBlending(hasColorChannels)

  return (
    <group ref={groupRef} onPointerOut={onPointerOut}>
      <instancedMesh
        ref={meshRef}
        name={`layer_${layerIndex}_group_${groupIndex}`}
        args={[, , groupedNeurons.length]}
        {...otherEvHandlers}
      >
        <primitive object={meshParams.geometry} attach={"geometry"} />
        <meshStandardMaterial ref={materialRef} />
      </instancedMesh>
      {hasLabels &&
        groupedNeurons.map((n, i) => (
          <NeuronLabels
            key={n.nid}
            neuron={n}
            color={getNeuronColor(n, hasColorChannels, isRegression)}
            position={getNeuronPosition(i, layerPos, height, width, spacing)}
          />
        ))}
    </group>
  )
}

export function useNeuronSpacing(meshParams: MeshParams) {
  const { geometry, spacingFactor } = meshParams
  const neuronSpacing = useVisConfigStore((s) => s.neuronSpacing)
  const size =
    "width" in geometry.parameters
      ? geometry.parameters.width
      : "radius" in geometry.parameters
      ? geometry.parameters.radius
      : 1
  const factor = spacingFactor ?? 1
  const spacing = size * neuronSpacing * factor
  return spacing
}

function useNeuronRefs(props: NeuronGroupProps, meshRef: InstancedMeshRef) {
  const { groupCount, groupIndex, index: layerIndex, neuronRefs } = props
  const instances = props.groupedNeurons.length
  useEffect(() => {
    if (debug()) console.log("upd refs")
    for (let indexInGroup = 0; indexInGroup < instances; indexInGroup++) {
      const neuronFlatIdx = indexInGroup * groupCount + groupIndex
      if (!neuronRefs[layerIndex][neuronFlatIdx]) continue
      neuronRefs[layerIndex][neuronFlatIdx].current = { meshRef, indexInGroup }
    }
  }, [meshRef, neuronRefs, layerIndex, groupCount, groupIndex, instances])
}

export function useGroupPosition(props: NeuronGroupProps) {
  const { groupIndex, groupCount, layerPos, meshParams } = props
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

function useNeuronPositions(
  meshRef: InstancedMeshRef,
  layerPos: LayerPos,
  spacing: number,
  outputShape: number[]
) {
  const [, height, width = 1] = outputShape
  const tempObj = useMemo(() => new THREE.Object3D(), [])
  // has to be useLayoutEffect, otherwise raycasting probably won't work
  useLayoutEffect(() => {
    if (!meshRef.current) return
    if (debug()) console.log("upd pos", layerPos, height, width)
    for (let i = 0; i < height * width; i++) {
      const position = getNeuronPosition(i, layerPos, height, width, spacing)
      tempObj.position.set(...position)
      tempObj.updateMatrix()
      meshRef.current?.setMatrixAt(i, tempObj.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [meshRef, tempObj, layerPos, spacing, height, width])
}

function useColors(
  meshRef: InstancedMeshRef,
  neurons: Neuron[],
  hasColorChannels: boolean,
  isRegression: boolean
) {
  useLayoutEffect(() => {
    if (!meshRef.current) return
    if (debug()) console.log("upd colors")
    for (const [i, n] of neurons.entries()) {
      const color = getNeuronColor(n, hasColorChannels, isRegression)
      if (color) meshRef.current.setColorAt(i, color)
      else console.warn("no color", n, color)
    }
    if (!meshRef.current.instanceColor) return
    meshRef.current.instanceColor.needsUpdate = true
  }, [meshRef, neurons, hasColorChannels, isRegression])
}

function useScale(
  meshRef: InstancedMeshRef,
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
