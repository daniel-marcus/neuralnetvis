import { useEffect, useLayoutEffect, useMemo, useRef } from "react"
import { InstancedMesh } from "three"
import { useAnimatedPosition } from "@/three/animated-position"
import * as THREE from "three"
import { MeshParams, getGridSize, getNeuronPosition } from "@/lib/layer-layout"
import { LayerPosition, LayerProps } from "./layer"
import { NeuronLabels } from "./neuron-label"
import { ThreeEvent, useThree } from "@react-three/fiber"
import { useLocalSelected, useSelected } from "@/lib/neuron-select"
import { Neuron, Nid } from "../lib/neuron"
import { debug } from "@/lib/debug"
import { useVisConfigStore } from "@/lib/vis-config"
import { useDatasetStore } from "@/data/datasets"

export type InstancedMeshRef = React.RefObject<InstancedMesh | null>

export interface GroupDef {
  nids: Nid[]
  nidsStr: string // for deps optimization
}

type NeuronGroupProps = LayerProps &
  GroupDef & {
    groupIndex: number
    groupCount: number
    groupedNeurons: Neuron[]
  }

export const NeuronGroup = (props: NeuronGroupProps) => {
  const { groupedNeurons, groupIndex, nidsStr } = props
  const { index: layerIndex, layerPos, meshParams, hasLabels } = props
  const { geometry } = meshParams
  const spacing = useNeuronSpacing(meshParams)
  const meshRef = useRef<InstancedMesh | null>(null!)
  useNeuronRefs(props, meshRef)
  const position = useGroupPosition(props)
  const [groupRef] = useAnimatedPosition(position, 0.1)
  const outputShape = props.tfLayer.outputShape as number[]
  const [, height, width = 1] = outputShape
  useNeuronPositions(meshRef, layerPos, spacing, outputShape)
  const isRegression =
    useDatasetStore((s) => s.isRegression) && layerPos === "output"
  useColors(meshRef, groupedNeurons, isRegression)
  const eventHandlers = useInteractions(groupedNeurons)
  useScale(meshRef, nidsStr, layerIndex, groupIndex)
  const splitColors = useVisConfigStore((s) => s.splitColors)
  const materialRef = useAdditiveBlending(
    groupedNeurons[0]?.hasColorChannels && !splitColors
  )
  const { onPointerOut, ...otherEventHandlers } = eventHandlers

  return (
    <group ref={groupRef} onPointerOut={onPointerOut}>
      <instancedMesh
        ref={meshRef}
        name={`layer_${layerIndex}_group_${groupIndex}`}
        args={[, , groupedNeurons.length]}
        {...otherEventHandlers}
      >
        <primitive object={geometry} attach={"geometry"} />
        <meshStandardMaterial ref={materialRef} />
      </instancedMesh>
      {hasLabels &&
        groupedNeurons.map((n, i) => {
          const pos = getNeuronPosition(i, layerPos, height, width, spacing)
          return (
            <NeuronLabels
              key={n.nid}
              neuron={n}
              color={getNeuronColor(n, isRegression)}
              position={pos}
            />
          )
        })}
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
      if (!neuronRefs[layerIndex][neuronFlatIdx]) {
        console.log("No ref found", { layerIndex, neuronFlatIdx })
        continue
      }
      neuronRefs[layerIndex][neuronFlatIdx].current = { meshRef, indexInGroup }
    }
  }, [meshRef, neuronRefs, layerIndex, groupCount, groupIndex, instances])
}

function useGroupPosition(props: NeuronGroupProps) {
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
  return position
}

function useNeuronPositions(
  meshRef: InstancedMeshRef,
  // instances: number,
  layerPos: LayerPosition,
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
  isRegression: boolean
) {
  const tmpColor = useMemo(() => new THREE.Color(), [])
  useLayoutEffect(() => {
    if (!meshRef.current) return
    if (debug()) console.log("upd colors")
    for (const n of neurons) {
      const i = neurons.indexOf(n)
      const colorStr = getNeuronColor(n, isRegression)
      const color = tmpColor.set(colorStr)
      meshRef.current.setColorAt(i, color)
    }
    if (!meshRef.current.instanceColor) return
    meshRef.current.instanceColor.needsUpdate = true
  }, [meshRef, neurons, tmpColor, isRegression])
}

function getPredictionQualityColor(n: Neuron) {
  const trainingY = useDatasetStore.getState().trainingY ?? 1
  const percentualError = Math.abs((n.activation ?? 1) - trainingY) / trainingY
  const quality = 1 - Math.min(percentualError, 1)
  return `rgb(${Math.ceil(quality * 255)},20,100)`
}

function getNeuronColor(n: Neuron, isRegression = false) {
  return typeof n.highlightValue !== "undefined"
    ? getHighlightColor(n.highlightValue)
    : isRegression
    ? getPredictionQualityColor(n)
    : n.hasColorChannels
    ? getColorChannelColor(n)
    : getActivationColor(n)
  // getPredictionQualityColor(n)
}

function getActivationColor(neuron: Neuron) {
  const colorValue = neuron.normalizedActivation ?? 0
  return `rgb(${Math.ceil(colorValue * 255)},20,100)`
}

export function getHighlightColor(
  value: number, // between -1 and 1
  base: [number, number, number] = [250, 20, 100]
) {
  const absVal = Math.abs(value)
  const a = Math.ceil(absVal * base[0])
  const b = Math.ceil(absVal * base[1])
  const c = Math.ceil(absVal * base[2])
  return value > 0 ? `rgb(${a}, ${b}, ${c})` : `rgb(${c}, ${b}, ${a})` // `rgb(${b}, ${a}, ${c})` //
}

function getColorChannelColor(n: Neuron) {
  const rest = n.index % 3
  const colorArr = [0, 0, 0]
  colorArr[rest] = Math.ceil((n.normalizedActivation ?? 0) * 255)
  return `rgb(${colorArr.join(", ")})`
}

let counter = 0

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
    // if (nids.length > 256) return
    if (debug()) console.log("upd scale", counter++, { nids })
    const baseScale = 1
    const highlightScale = 1.5
    for (const nid of nids) {
      const i = nids.indexOf(nid)

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

function useAdditiveBlending(active?: boolean) {
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null)
  useEffect(() => {
    if (!materialRef.current) return
    materialRef.current.blending = active
      ? THREE.AdditiveBlending
      : THREE.NormalBlending
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
