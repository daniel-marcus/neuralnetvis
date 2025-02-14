import { useEffect, useMemo, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { Line, Vector2, Vector3 } from "three"
import {
  LineGeometry,
  LineMaterial,
  LineSegments2,
} from "three/examples/jsm/Addons.js"
import { useSelected } from "@/neuron-layers/neuron-select"
import { useVisConfigStore } from "@/scene/vis-config"
import { useDatasetStore } from "@/data/dataset"
import type { LayerStateful, Neuron, NeuronDef } from "@/neuron-layers/types"
import { getWorldPos } from "./utils"

const MAX_LINES_PER_LAYER = 1000
const MIN_LINE_WIDTH = 0.1
const MAX_LINE_WIDTH = 3

type NeuronConnectionsProps = {
  layer: LayerStateful
  prevLayer: LayerStateful
}

export const HoverConnections = () => {
  const hovered = useSelected((s) => s.hovered)
  const hoverOrigin = useSelected((s) => s.hoverOrigin)
  // too many lines for fully connected layers
  const allowDenseHoverLines = useVisConfigStore((s) => s.allowDenseHoverLines)
  if (!hovered) return null
  if (hovered.layer.layerType === "Dense" && !allowDenseHoverLines) return null
  return (
    <group name={`hovered_node_connections`}>
      {hovered.inputNeurons?.map((inputN, i, arr) => {
        const width = arr.length > 100 ? 0.1 : 0.5
        return (
          <DynamicLine2
            key={`${hovered.nid}_${inputN.nid}`}
            from={inputN}
            to={hovered}
            toPoint={hoverOrigin}
            width={width}
          />
        )
      })}
    </group>
  )
}

export const Connections = ({ layer, prevLayer }: NeuronConnectionsProps) => {
  const showLines = useVisConfigStore((s) => s.showLines)
  const isConvOrMaxPool =
    ["Conv2D", "MaxPooling2D"].includes(layer.layerType) ||
    ["Conv2D"].includes(prevLayer.layerType)
  const isRegression = useDatasetStore((s) => s.isRegression)
  const { invalidate } = useThree()
  useEffect(() => {
    invalidate()
  }, [showLines, invalidate])
  if (isRegression) return null
  if (isConvOrMaxPool) return null
  if (!showLines) return null

  const connections = getConnections(layer, prevLayer.neurons)
  return (
    <group name={`layer_${layer.index}_connections`}>
      {connections.map((connectionProps, i) => {
        return <DynamicLine2 key={i} {...connectionProps} />
      })}
    </group>
  )
}

function getConnections(layer: LayerStateful, prevNeurons: Neuron[]) {
  const lineActivationThreshold =
    useVisConfigStore.getState().lineActivationThreshold
  const layerMaxWeight = layer.maxAbsWeight ?? 1

  const connections: DynamicLineProps[] = []
  for (const neuron of layer.neurons) {
    const { weights, normalizedActivation: activation = 0 } = neuron
    if (!weights || !neuron.inputNeurons?.length) continue
    if (activation < lineActivationThreshold) continue

    for (const [index, weight] of weights.entries()) {
      const prevNeuron = prevNeurons[index]
      const absWeight = Math.abs(weight)
      if (absWeight < layerMaxWeight * 0.5) continue
      const weightedInput = absWeight * (prevNeuron.activation ?? 0)
      if (weightedInput < MIN_LINE_WIDTH) continue
      const width = Math.min(
        Math.round(weightedInput * 10) / 10,
        MAX_LINE_WIDTH
      )
      const connection = { from: prevNeuron, to: neuron, width }
      connections.push(connection)
    }
  }
  return connections.length > MAX_LINES_PER_LAYER
    ? connections
        .sort((a, b) => b.width! - a.width!)
        .slice(0, MAX_LINES_PER_LAYER)
    : connections
}

interface DynamicLineProps {
  from: NeuronDef
  to: NeuronDef
  toPoint?: Vector3 // alternatvie to toRef
  width?: number
}

const DynamicLine2 = ({ from, to, toPoint, width = 1 }: DynamicLineProps) => {
  const lineRef = useRef<Line | null>(null)
  const { size } = useThree()

  const geometry = useMemo(() => new LineGeometry(), [])

  const material = useMemo(
    () =>
      new LineMaterial({
        linewidth: width,
        resolution: new Vector2(size.width, size.height),
      }),
    [width, size]
  )
  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  useFrame(() => {
    if (lineRef.current && from && (to || toPoint)) {
      const fromPosition = getWorldPos(from)
      const toPosition = toPoint ? new Vector3(...toPoint) : getWorldPos(to)
      if (!fromPosition || !toPosition) return
      geometry.setPositions([...fromPosition, ...toPosition])
      lineRef.current.computeLineDistances()
    }
  })

  const obj = useMemo(
    () => new LineSegments2(geometry, material),
    [geometry, material]
  )

  return <primitive object={obj} ref={lineRef} />
}
