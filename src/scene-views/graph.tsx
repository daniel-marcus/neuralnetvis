"use client"

import dynamic from "next/dynamic"
import { setStatus, useSceneStore } from "@/store"
import { useEffect, useRef, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { GraphMethods } from "r3f-forcegraph"
import { isVisible } from "@/neuron-layers/layers-stateless"
import { moveCameraTo } from "./3d-model/utils"
import { defaultState } from "@/utils/initial-state"
import type { Layer } from "@tensorflow/tfjs-layers/dist/exports_layers"

const R3fForceGraph = dynamic(() => import("r3f-forcegraph"), { ssr: false })

interface Node {
  id: string // layer name
  className: string
  index: number
  isVisible: boolean
  layer: Layer
}

interface Link {
  source: string
  target: string
  isResidual: boolean
}

const GRAPH_CAMERA_POS = [-630, 57, 450] as [number, number, number]

export const Graph = () => {
  const ref = useRef<GraphMethods<Node, Link>>(null)
  const graph = useModelGraph()
  const invalidate = useThree((s) => s.invalidate)
  useFrame(() => ref.current?.tickFrame())
  const focussedLayerIdx = useSceneStore((s) => s.focussedLayerIdx)
  const setFocussedLayerIdx = useSceneStore((s) => s.setFocussedLayerIdx)

  useEffect(() => {
    moveCameraTo(GRAPH_CAMERA_POS)
    return () => moveCameraTo(defaultState.cameraPos)
  }, [])

  useEffect(() => {
    const fg = ref.current
    if (!fg) return
    fg.d3Force("link")!
      .strength(2)
      .distance((link: Link) => (link.isResidual ? 300 : 1))
    // return () => fg.resetCountdown()
  }, [graph])

  return (
    <R3fForceGraph // @ts-expect-error ref type error
      ref={ref}
      graphData={graph}
      nodeRelSize={6}
      nodeResolution={16}
      nodeColor={(node) => getNodeColor(node as Node, focussedLayerIdx)}
      /* nodeThreeObject={(node) => {
        const color = getNodeColor(node as Node, focussedLayerIdx)
        const obj = createThreeObject(node.layer, color)
        return obj
      }} */
      linkDirectionalParticles={2}
      linkCurvature={(link) => (link.isResidual ? 1 : 0)}
      onNodeHover={(node) => {
        if (!node) return null
        setStatus(
          `${node.className} (${node.layer.outputShape.slice(1).join("x")})`
        )
        // document.body.style.cursor = node ? "pointer" : "auto"
      }}
      onNodeClick={(node) => {
        const idx = node.index
        setFocussedLayerIdx((oldIdx) => (idx === oldIdx ? undefined : idx))
      }}
      onEngineTick={invalidate}
      onFinishUpdate={() => {
        requestAnimationFrame(invalidate)
      }}
    />
  )
}

interface LayersGraph {
  nodes: Node[]
  links: Link[]
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
      isVisible: isVisible(l),
      layer: l,
    }))

    const layerIdxMap = new Map(
      model.layers.map((layer, index) => [layer.name, index])
    )

    model.layers.forEach((layer, layerIdx) => {
      layer.inboundNodes.forEach((node) => {
        node.inboundLayers.forEach((inboundLayer) => {
          if (inboundLayer) {
            const inboundIdx = layerIdxMap.get(inboundLayer.name) ?? -Infinity
            result.links.push({
              source: inboundLayer.name,
              target: layer.name,
              isResidual:
                layer.getClassName() === "Add" && inboundIdx !== layerIdx - 1,
            })
          }
        })
      })
    })
    setGraph(result)
  }, [model])
  return graph
}

function getNodeColor(node: Node, focussedLayerIdx?: number) {
  return node.index === focussedLayerIdx
    ? "rgb(220, 20, 100)"
    : "rgb(100, 20, 180)"
}

/* 
const boxGeometry = new THREE.BoxGeometry(0.25, 1, 1)
const sphereGeometry = new THREE.SphereGeometry(1, 16, 16)

function createThreeObject(layer: Layer, color: string) {
  const [, , , depth] = layer.outputShape as Shape
  const hasDepthDim = typeof depth === "number"
  const denseUnits = 1

  const instances = hasDepthDim ? (layer.outputShape[3] as number) : denseUnits

  const spacing = 1.15
  const boxesPerRow = Math.ceil(Math.sqrt(instances))

  const material = new THREE.MeshStandardMaterial({
    color,
  })

  const instancedMesh = new THREE.InstancedMesh(
    hasDepthDim ? boxGeometry : sphereGeometry,
    material,
    instances
  )

  const matrix = new THREE.Matrix4()

  for (let i = 0; i < instances; i++) {
    const row = Math.floor(i / boxesPerRow)
    const col = i % boxesPerRow

    const y = (row - Math.floor(instances / boxesPerRow / 2)) * spacing
    const z = (col - Math.floor(boxesPerRow / 2)) * spacing

    // Set the translation (position) matrix for each instance
    matrix.setPosition(0, y, z)

    // Set the transformation matrix for the current instance
    instancedMesh.setMatrixAt(i, matrix)
  }

  return instancedMesh
} */
