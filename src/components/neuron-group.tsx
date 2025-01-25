import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { InstancedMesh, Object3D } from "three"
import { useAnimatedPosition } from "@/lib/animated-position"
import * as THREE from "three"
import { getGridWidth, getNeuronPosition } from "@/lib/layer-layout"
import { NeuronDef, NeuronState, NodeId } from "./neuron"
import { LayerPosition } from "@/lib/layer-props"
import { NeuronLabels } from "./neuron-label"
import { UiOptionsContext } from "@/lib/ui-options"
import { LayerProps } from "./layer"
import { ThreeEvent, useThree } from "@react-three/fiber"
import { useStatusText } from "./status-text"
import { useSelectedNodes } from "@/lib/node-select"

const temp = new Object3D()

export type InstancedMeshRef = React.RefObject<InstancedMesh | null>

type NeuronGroupProps = LayerProps & {
  groupIndex: number
  groupCount: number
  groupedNeurons: (NeuronDef & NeuronState)[]
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
  const [eventHandlers, hoveredNeuron] = useInteractions(groupedNeurons)
  useScale(meshRef, groupedNeurons, hoveredNeuron)
  const { splitColors } = useContext(UiOptionsContext)
  const materialRef = useAdditiveBlending(
    groupedNeurons[0]?.hasColorChannels && !splitColors
  )
  return (
    <group ref={groupRef}>
      <instancedMesh
        ref={meshRef}
        name={`layer_${layerIndex}_group_${groupIndex}`}
        args={[, , groupedNeurons.length]}
        {...eventHandlers}
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
  useEffect(() => {
    if (!meshRef.current) return
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

function useColors(
  meshRef: InstancedMeshRef,
  neurons: (NeuronDef & NeuronState)[]
) {
  useEffect(() => {
    if (!meshRef.current) return
    for (const n of neurons) {
      const i = neurons.indexOf(n)
      const colorStr = getNeuronColor(n)
      const color = new THREE.Color(colorStr)
      meshRef.current.setColorAt(i, color)
    }
    if (!meshRef.current.instanceColor) return
    meshRef.current.instanceColor.needsUpdate = true
  }, [meshRef, neurons])
}

function getNeuronColor(n: NeuronDef & NeuronState) {
  return n.highlightValue
    ? getHighlightColor(n.highlightValue)
    : n.hasColorChannels
    ? getColorChannelColor(n)
    : getActivationColor(n)
}

function getActivationColor(neuron: NeuronDef & NeuronState) {
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

function getColorChannelColor(n: NeuronDef & NeuronState) {
  const rest = n.index % 3
  const colorArr = [0, 0, 0]
  colorArr[rest] = Math.ceil((n.normalizedActivation ?? 0) * 255)
  return `rgb(${colorArr.join(", ")})`
}

function useScale(
  meshRef: InstancedMeshRef,
  neurons: (NeuronDef & NeuronState)[],
  hoveredNeuron: NodeId | null
) {
  const { invalidate } = useThree()
  useEffect(() => {
    if (!meshRef.current) return
    const tempMatrix = new THREE.Matrix4()
    const scale = new THREE.Matrix4()
    const baseScale = 1
    for (const n of neurons) {
      const i = neurons.indexOf(n)

      meshRef.current.getMatrixAt(i, tempMatrix)
      const elements = tempMatrix.elements
      const currentScale = Math.cbrt(elements[0] * elements[5] * elements[10])
      const targetScale =
        n.isSelected || n.nid === hoveredNeuron ? baseScale * 1.5 : baseScale
      const scaleFactor = targetScale / currentScale
      scale.makeScale(scaleFactor, scaleFactor, scaleFactor)
      tempMatrix.multiply(scale)
      meshRef.current.setMatrixAt(i, tempMatrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
    invalidate()
  }, [meshRef, neurons, hoveredNeuron, invalidate])
}

function useHoverStatus() {
  const setStatusText = useStatusText((s) => s.setStatusText)
  const showNeuronState = useCallback(
    (neuron?: (NeuronDef & NeuronState) | null, isSelected?: boolean) => {
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

function useInteractions(groupedNeurons: (NeuronDef & NeuronState)[]) {
  const [hoveredNeuron, setHoveredNeuron] = useState<NodeId | null>(null)
  const { selectedNode, toggleNode } = useSelectedNodes()
  const showNeuronState = useHoverStatus()
  const eventHandlers = useMemo(() => {
    const result = {
      onPointerOver: (e: ThreeEvent<PointerEvent>) => {
        if (e.buttons) return
        const neuron = groupedNeurons[e.instanceId as number]
        if (!neuron) return
        // TODO: debounce?
        if (!selectedNode) showNeuronState(neuron)
        setHoveredNeuron(neuron.nid)
        // toggleNode(neuron.nid)
      },
      onPointerOut: () => {
        if (!selectedNode) showNeuronState(null)
        setHoveredNeuron(null)
        // toggleNode(null)
      },
      onClick: (e: ThreeEvent<PointerEvent>) => {
        const neuron = groupedNeurons[e.instanceId as number]
        if (!neuron) return
        showNeuronState(neuron, true)
        toggleNode(neuron.nid)
      },
    }
    return result
  }, [groupedNeurons, showNeuronState, toggleNode, selectedNode])
  return [eventHandlers, hoveredNeuron] as const
}
