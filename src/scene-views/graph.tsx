"use client"

import dynamic from "next/dynamic"
import { setStatus, useSceneStore } from "@/store"
import { useEffect, useRef, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { GraphMethods } from "r3f-forcegraph"

const R3fForceGraph = dynamic(() => import("r3f-forcegraph"), { ssr: false })

interface Node {
  id: string // layer name
  className: string
  index: number
}

export const Graph = () => {
  const ref = useRef<GraphMethods<Node>>(null)
  const graph = useModelGraph()
  const invalidate = useThree((s) => s.invalidate)
  useFrame(() => {
    ref.current?.tickFrame()
  })
  const focussedLayerIdx = useSceneStore((s) => s.focussedLayerIdx)
  const setFocussedLayerIdx = useSceneStore((s) => s.setFocussedLayerIdx)

  return (
    <R3fForceGraph // @ts-expect-error ref type error
      ref={ref}
      graphData={graph}
      nodeRelSize={4}
      nodeOpacity={1}
      nodeColor={(node) =>
        node.index === focussedLayerIdx
          ? "rgb(220, 20, 100)"
          : "rgb(100, 20, 180)"
      }
      nodeResolution={32}
      onNodeHover={(node) => setStatus(node ? node.className : "")}
      onNodeClick={(node) => setFocussedLayerIdx(node ? node.index : undefined)}
      onEngineTick={invalidate}
      onFinishUpdate={() => {
        requestAnimationFrame(invalidate)
      }}
    />
  )
}

interface LayersGraph {
  nodes: { id: string }[]
  links: { source: string; target: string }[]
}

function useModelGraph() {
  const model = useSceneStore((s) => s.model)
  const [graph, setGraph] = useState<LayersGraph>({
    nodes: [],
    links: [],
  })
  useEffect(() => {
    if (!model) return
    const result: LayersGraph = {
      nodes: [],
      links: [],
    }

    result.nodes = model.layers.map((l, index) => ({
      id: l.name,
      index,
      className: l.getClassName(),
    }))

    model.layers.forEach((layer) => {
      layer.inboundNodes.forEach((node) => {
        node.inboundLayers.forEach((inboundLayer) => {
          if (inboundLayer) {
            result.links.push({ source: inboundLayer.name, target: layer.name })
          }
        })
      })
    })
    setGraph(result)
  }, [model])
  return graph
}
