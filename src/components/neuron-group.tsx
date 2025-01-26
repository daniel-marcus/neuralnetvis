import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react"
import { InstancedMesh, Object3D } from "three"
import { useAnimatedPosition } from "@/lib/animated-position"
import * as THREE from "three"
import { getGridWidth, getNeuronPosition } from "@/lib/layer-layout"
import { LayerPosition } from "@/lib/layer-props"
import { NeuronLabels } from "./neuron-label"
import { UiOptionsContext } from "@/lib/ui-options"
import { LayerProps } from "./layer"
import { ThreeEvent, useThree } from "@react-three/fiber"
import { useStatusText } from "./status-text"
import { useLocalSelected, useSelected } from "@/lib/neuron-select"
import { Neuron } from "./neuron"
import { DEBUG } from "@/lib/_debug"

const temp = new Object3D()

export type InstancedMeshRef = React.RefObject<InstancedMesh | null>

type NeuronGroupProps = LayerProps & {
  groupIndex: number
  groupCount: number
  groupedNeurons: Neuron[]
}

export const NeuronGroup = (props: NeuronGroupProps) => {
  const { groupedNeurons, layerPosition, spacing } = props
  const { groupIndex, index: layerIndex } = props
  const meshRef = useRef<InstancedMesh | null>(null!)
  useNeuronRefs(props, meshRef)
  const position = useGroupPosition(props)
  const groupRef = useAnimatedPosition(position, 0.1)
  const instances = groupedNeurons.length
  useNeuronPositions(meshRef, instances, layerPosition, spacing)
  useColors(meshRef, groupedNeurons)
  const eventHandlers = useInteractions(groupedNeurons)
  const scaleOnHover = props.tfLayer.getClassName() === "Dense"
  useScale(scaleOnHover, meshRef, groupedNeurons, layerIndex, groupIndex)
  const { splitColors } = useContext(UiOptionsContext)
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
        {props.geometry}
        <meshStandardMaterial ref={materialRef} />
      </instancedMesh>
      {layerPosition === "output" &&
        groupedNeurons.map((n, i) => {
          const pos = getNeuronPosition(i, instances, layerPosition, spacing)
          return (
            <NeuronLabels
              key={n.nid}
              neuron={n}
              color={getNeuronColor(n)}
              position={pos}
            />
          )
        })}
    </group>
  )
}

function useNeuronRefs(props: NeuronGroupProps, meshRef: InstancedMeshRef) {
  const { groupCount, groupIndex, index: layerIndex, neuronRefs } = props
  const instances = props.groupedNeurons.length
  useEffect(() => {
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
  const { groupIndex, groupCount, layerPosition, spacing } = props
  const neuronCount = props.groupedNeurons.length
  const { splitColors } = useContext(UiOptionsContext)
  const position = useMemo(() => {
    const GRID_SPACING = 0.6
    const gridSize = getGridWidth(neuronCount, spacing) + GRID_SPACING
    const groupsPerRow = Math.ceil(Math.sqrt(groupCount))
    const groupsPerColumn = Math.ceil(groupCount / groupsPerRow)
    const offsetY = (groupsPerColumn - 1) * gridSize * 0.5
    const offsetZ = (groupsPerRow - 1) * gridSize * -0.5
    const y = -1 * Math.floor(groupIndex / groupsPerRow) * gridSize + offsetY // row
    const z = (groupIndex % groupsPerRow) * gridSize + offsetZ // column
    const SPLIT_COLORS_X_OFFSET = 0.6 // to avoid z-fighting
    return layerPosition === "input"
      ? splitColors
        ? [0, 0, groupIndex * gridSize - (groupCount - 1) * gridSize * 0.5] // spread on z-axis
        : [groupIndex * SPLIT_COLORS_X_OFFSET, 0, 0]
      : [0, y, z]
  }, [groupIndex, groupCount, neuronCount, layerPosition, spacing, splitColors])
  return position
}

function useNeuronPositions(
  meshRef: InstancedMeshRef,
  instances: number,
  layerPosition: LayerPosition,
  spacing: number
) {
  // has to be useLayoutEffect, otherwise raycasting probably won't work
  useLayoutEffect(() => {
    if (!meshRef.current) return
    if (DEBUG) console.log("upd pos", layerPosition, instances)
    const positions = [] as [number, number, number][]
    for (let i = 0; i < instances; i++) {
      const position = getNeuronPosition(i, instances, layerPosition, spacing)
      positions.push(position)
      temp.position.set(...position)
      temp.updateMatrix()
      meshRef.current?.setMatrixAt(i, temp.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [meshRef, instances, layerPosition, spacing])
}

function useColors(meshRef: InstancedMeshRef, neurons: Neuron[]) {
  const tmpColor = useMemo(() => new THREE.Color(), [])
  useEffect(() => {
    if (!meshRef.current) return
    if (DEBUG) console.log("upd colors")
    for (const n of neurons) {
      const i = neurons.indexOf(n)
      const colorStr = getNeuronColor(n)
      const color = tmpColor.set(colorStr)
      meshRef.current.setColorAt(i, color)
    }
    if (!meshRef.current.instanceColor) return
    meshRef.current.instanceColor.needsUpdate = true
  }, [meshRef, neurons, tmpColor])
}

function getNeuronColor(n: Neuron) {
  return n.highlightValue
    ? getHighlightColor(n.highlightValue)
    : n.hasColorChannels
    ? getColorChannelColor(n)
    : getActivationColor(n)
}

function getActivationColor(neuron: Neuron) {
  const colorValue = neuron.normalizedActivation ?? 0
  return `rgb(${Math.ceil(colorValue * 255)},20,100)`
}

function getHighlightColor(
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
  active: boolean,
  meshRef: InstancedMeshRef,
  neurons: Neuron[],
  layerIndex: number,
  groupIndex: number
) {
  // use string to avoid unnecessary updates
  const nidsStr = neurons.map((n) => `${n.nid}`).join(",")
  const { selectedNid, hoveredNid } = useLocalSelected(layerIndex, groupIndex)
  const { invalidate } = useThree()
  const tempMatrix = useMemo(() => new THREE.Matrix4(), [])
  const tempScale = useMemo(() => new THREE.Matrix4(), [])
  useEffect(() => {
    if (!active) return
    if (!meshRef.current) return
    const nids = nidsStr.split(",")
    if (nids.length > 256) return
    if (DEBUG) console.log("upd scale", counter++, { nids })
    const baseScale = 1
    const highlightScale = 1.5
    for (const nid of nids) {
      const i = nids.indexOf(nid)

      meshRef.current.getMatrixAt(i, tempMatrix)
      const elements = tempMatrix.elements
      const currentScale = Math.cbrt(elements[0] * elements[5] * elements[10])
      const targetScale =
        nid === selectedNid || nid === hoveredNid
          ? baseScale * highlightScale
          : baseScale
      const scaleFactor = targetScale / currentScale
      tempScale.makeScale(scaleFactor, scaleFactor, scaleFactor)
      tempMatrix.multiply(tempScale)
      meshRef.current.setMatrixAt(i, tempMatrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
    invalidate()
  }, [
    active,
    meshRef,
    selectedNid,
    hoveredNid,
    invalidate,
    nidsStr,
    tempMatrix,
    tempScale,
  ]) // neurons
}

function useHoverStatus() {
  const setStatusText = useStatusText((s) => s.setStatusText)
  const showNeuronState = useCallback(
    (neuron?: Neuron | null, isSelected?: boolean) => {
      if (neuron === null) setStatusText("")
      if (!neuron) return
      const { nid, rawInput, activation: _activation, bias } = neuron
      // TODO: handle multiple activations?
      const activation = Array.isArray(_activation)
        ? undefined // _activation[0]
        : _activation
      const hint = !isSelected ? "Click to see influences" : "Click to unselect"
      setStatusText(
        `<strong>Neuron ${nid} (${neuron.index})</strong><br/><br/>
${rawInput !== undefined ? `Raw Input: ${rawInput}<br/>` : ""}
Activation: ${activation?.toFixed(4)}<br/>
${bias !== undefined ? `Bias: ${bias?.toFixed(4)}<br/><br/>${hint}` : ""}`
      )
    },
    [setStatusText]
  )
  return showNeuronState
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
  const { selectedNid, toggleSelected, toggleHovered } = useSelected()
  const showNeuronState = useHoverStatus()
  const eventHandlers = useMemo(() => {
    const result = {
      onPointerOver: (e: ThreeEvent<PointerEvent>) => {
        if (e.buttons) return
        const neuron = groupedNeurons[e.instanceId as number]
        if (!neuron) return
        // TODO: debounce?
        if (selectedNid && neuron.nid === selectedNid)
          showNeuronState(neuron, true)
        else showNeuronState(neuron)
        toggleHovered(neuron)
        // toggleSelected(neuron.nid)
      },
      onPointerOut: () => {
        showNeuronState(null)
        toggleHovered(null)
        // toggleSelected(null)
      },
      onClick: (e: ThreeEvent<PointerEvent>) => {
        const neuron = groupedNeurons[e.instanceId as number]
        if (!neuron) return
        showNeuronState(neuron, true)
        toggleSelected(neuron.nid)
      },
    }
    return result
  }, [
    groupedNeurons,
    showNeuronState,
    toggleHovered,
    toggleSelected,
    selectedNid,
  ])
  return eventHandlers
}
