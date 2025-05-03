import { useEffect, useMemo, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { Color, Line, Vector2, Vector3 } from "three"
import {
  Line2,
  LineGeometry,
  LineMaterial,
  LineSegments2,
  LineSegmentsGeometry,
} from "three-stdlib"
import { useSceneStore } from "@/store"
import { getWorldPos, type Pos } from "./utils"
import type {
  LayerStateless,
  Neuron,
  NeuronStateful,
} from "@/neuron-layers/types"

const MAX_LINES_PER_LAYER = 1000
// const MIN_LINE_WIDTH = 0.1
// const MAX_LINE_WIDTH = 3

// TODO: deal with LayerStateless ...

type NeuronConnectionsProps = {
  layer: LayerStateless
  prevLayer: LayerStateless
}

export const HoverConnections = ({ hovered }: { hovered?: NeuronStateful }) => {
  if (hovered) console.log(hovered)
  const showLines = useSceneStore((s) => s.vis.showLines)
  // const hoverOrigin = useGlobalStore((s) => s.hoverOrigin)

  const line = useMemo(() => new Line2(), [])
  const material = useMemo(() => new LineMaterial(), [])
  const geometry = useMemo(() => new LineSegmentsGeometry(), [])
  const resolution = useMemo(() => new Vector2(512, 512), [])

  const invisibleLayers = useSceneStore((s) => s.vis.invisibleLayers)
  const prevLayerName = hovered?.layer.prevLayer?.tfLayer.name
  const prevLayerIsVisible =
    !!prevLayerName && !invisibleLayers.includes(prevLayerName)

  const isFlatView = useSceneStore((s) => s.vis.flatView)
  const length = hovered?.inputNeurons?.length ?? 0
  const show =
    length > 0 &&
    length < MAX_LINES_PER_LAYER &&
    showLines &&
    prevLayerIsVisible &&
    !isFlatView

  useEffect(() => {
    // reference: https://github.com/pmndrs/drei/blob/master/src/core/Segments.tsx
    if (!show) return
    const inputNeurons = hovered?.inputNeurons
    if (!hovered || !inputNeurons?.length) return
    const toPosition = getWorldPos(hovered)?.toArray() as Pos
    const color = new Color(0xffffff).toArray()
    if (!toPosition) return
    const positions = new Float32Array(MAX_LINES_PER_LAYER * 6).fill(0)
    const colors = new Float32Array(MAX_LINES_PER_LAYER * 6).fill(0)
    for (const [i, inputN] of inputNeurons.entries()) {
      if (i >= MAX_LINES_PER_LAYER) break
      const fromPosition = getWorldPos(inputN)?.toArray() as Pos
      if (!fromPosition) continue
      positions[i * 6] = fromPosition[0]
      positions[i * 6 + 1] = fromPosition[1]
      positions[i * 6 + 2] = fromPosition[2]
      positions[i * 6 + 3] = toPosition[0]
      positions[i * 6 + 4] = toPosition[1]
      positions[i * 6 + 5] = toPosition[2]
      colors[i * 6] = color[0]
      colors[i * 6 + 1] = color[1]
      colors[i * 6 + 2] = color[2]
      colors[i * 6 + 3] = color[0]
      colors[i * 6 + 4] = color[1]
      colors[i * 6 + 5] = color[2]
    }
    line.geometry.setColors(colors)
    line.geometry.setPositions(positions)
    line.geometry.attributes.position.needsUpdate = true
    line.computeLineDistances()
  }, [hovered, geometry, line, show])

  if (!show) return null
  return (
    <group name={`hovered_node_connections_${hovered?.nid}`}>
      <primitive object={line}>
        <primitive object={geometry} attach="geometry" />
        <primitive
          object={material}
          attach="material"
          vertexColors={true}
          linewidth={length >= 100 ? 0.1 : 0.5}
          resolution={resolution}
        />
      </primitive>
    </group>
  )
}

export const Connections = ({ layer, prevLayer }: NeuronConnectionsProps) => {
  const showLines = useSceneStore((s) => s.vis.showLines)
  const isConvOrMaxPool =
    ["Conv2D", "MaxPooling2D"].includes(layer.layerType) ||
    ["Conv2D"].includes(prevLayer.layerType)
  const isRegression = useSceneStore((s) => s.isRegression())
  const invalidate = useThree(({ invalidate }) => invalidate)
  useEffect(invalidate, [showLines, invalidate])
  if (isRegression || isConvOrMaxPool || !showLines) return null

  const connections: DynamicLineProps[] = [] /*  getConnections(
    layer,
    prevLayer.neurons,
    lineActivationThreshold
  ) */
  return (
    <group name={`layer_${layer.index}_connections`}>
      {connections.map((connectionProps, i) => {
        return <DynamicLine2 key={i} {...connectionProps} />
      })}
    </group>
  )
}

// TODO!
/* 
function getConnections(
  layer: LayerStateless,
  prevNeurons: Neuron[],
  lineActivationThreshold: number
) {
  const layerMaxWeight = 1 // layer.maxAbsWeight ?? 1 // TODO!

  const connections: DynamicLineProps[] = []
  for (const neuron of layer.neurons) {
    const { weights, normalizedActivation: activation = 0 } = neuron
    if (!weights || !neuron.inputNeurons?.length) continue
    if (Math.abs(activation) < lineActivationThreshold) continue

    for (const [index, weight] of weights.entries()) {
      const prevNeuron = prevNeurons[index]
      if (!prevNeuron) continue
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
} */

interface DynamicLineProps {
  from: Neuron
  to: Neuron
  toPoint?: Vector3 // alternatvie to meshRef
  width?: number
}

const DynamicLine2 = ({ from, to, toPoint, width = 1 }: DynamicLineProps) => {
  const lineRef = useRef<Line | null>(null)
  const size = useThree((s) => s.size)

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
