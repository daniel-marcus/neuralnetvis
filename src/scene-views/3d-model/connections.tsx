import { useEffect, useMemo } from "react"
import * as THREE from "three/webgpu"

import { Line2 } from "three/addons/lines/webgpu/Line2.js"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"

import { useSceneStore } from "@/store"
import { getWorldPos, type Pos } from "./utils"
import type { NeuronStateful } from "@/neuron-layers/types"

const MAX_LINES_PER_LAYER = 1000

export const HoverConnections = ({ hovered }: { hovered?: NeuronStateful }) => {
  const showLines = useSceneStore((s) => s.vis.showLines)

  const line = useMemo(() => new Line2(), [])
  const material = useMemo(() => new THREE.Line2NodeMaterial(), [])
  const geometry = useMemo(() => new LineSegmentsGeometry(), [])
  const resolution = useMemo(() => new THREE.Vector2(512, 512), [])

  const excludedLayers = useSceneStore((s) => s.vis.excludedLayers)
  const prevLayerName = hovered?.layer.prevLayer?.tfLayer.name
  const prevLayerIsVisible = !!prevLayerName && !excludedLayers.includes(prevLayerName)

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
    line.geometry.attributes.position.needsUpdate = true // eslint-disable-line react-hooks/immutability
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
