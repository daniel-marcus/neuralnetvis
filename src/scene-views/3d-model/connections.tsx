import { useEffect, useMemo, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three/webgpu"

import { LineGeometry } from "three/addons/lines/LineGeometry.js"
import { Line2 } from "three/addons/lines/webgpu/Line2.js"
import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"

import { useSceneStore } from "@/store"
import { getWorldPos, type Pos } from "./utils"
import type { NeuronLayer, Neuron, NeuronStateful } from "@/neuron-layers/types"

const MAX_LINES_PER_LAYER = 1000
// const MIN_LINE_WIDTH = 0.1
// const MAX_LINE_WIDTH = 3

export const HoverConnections = ({ hovered }: { hovered?: NeuronStateful }) => {
  const showLines = useSceneStore((s) => s.vis.showLines)
  // const hoverOrigin = useGlobalStore((s) => s.hoverOrigin)

  const line = useMemo(() => new Line2(), [])
  const material = useMemo(() => new THREE.Line2NodeMaterial(), [])
  const geometry = useMemo(() => new LineSegmentsGeometry(), [])
  const resolution = useMemo(() => new THREE.Vector2(512, 512), [])

  const excludedLayers = useSceneStore((s) => s.vis.excludedLayers)
  const prevLayerName = hovered?.layer.prevLayer?.tfLayer.name
  const prevLayerIsVisible =
    !!prevLayerName && !excludedLayers.includes(prevLayerName)

  const isFlatView = useSceneStore((s) => s.vis.flatView)
  const length = hovered?.inputNeurons?.length ?? 0
  const show = length > 0 && showLines && prevLayerIsVisible && !isFlatView

  useEffect(() => {
    // reference: https://github.com/pmndrs/drei/blob/master/src/core/Segments.tsx
    if (!show) return
    const inputNeurons = hovered?.inputNeurons
    if (!hovered || !inputNeurons?.length) return
    const toPosition = getWorldPos(hovered)?.toArray() as Pos
    if (!toPosition) return

    // console.log("UPD", hovered, toPosition)
    const positions = new Float32Array(MAX_LINES_PER_LAYER * 6).fill(0)
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
    }
    line.geometry.setPositions(positions)
    line.geometry.attributes.position.needsUpdate = true
    line.material.needsUpdate = true
    line.computeLineDistances()
  }, [hovered, geometry, line, show])

  if (!show) return null
  return (
    <group name={`hovered_node_connections_${hovered?.nid}`}>
      <primitive object={line}>
        <primitive object={geometry} attach="geometry" />
        <primitive
          object={material}
          color={0xffffff}
          attach="material"
          vertexColors={true}
          linewidth={length >= 100 ? 0.1 : 0.5}
          resolution={resolution}
          worldUnits={false}
        />
      </primitive>
    </group>
  )
}

type NeuronConnectionsProps = {
  layer: NeuronLayer
  prevLayer: NeuronLayer
}

// TODO: deal with statelesss NeuronLayer ...
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
  layer: NeuronLayer,
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
  toPoint?: THREE.Vector3 // alternatvie to meshRef
  width?: number
}

const DynamicLine2 = ({ from, to, toPoint, width = 1 }: DynamicLineProps) => {
  const lineRef = useRef<THREE.Line | null>(null)
  const size = useThree((s) => s.size)

  const geometry = useMemo(() => new LineGeometry(), [])

  const material = useMemo(
    () =>
      new THREE.Line2NodeMaterial({
        linewidth: width,
        // resolution: new Vector2(size.width, size.height),
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
      const toPosition = toPoint
        ? new THREE.Vector3(...toPoint)
        : getWorldPos(to)
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
