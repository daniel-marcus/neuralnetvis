import { useEffect, useMemo } from "react"
import * as THREE from "three/webgpu"
import { useFrame, useThree } from "@react-three/fiber"

import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"

import { useSceneStore } from "@/store"
import { getWorldPosInto } from "./utils"
import { getActColor } from "@/utils/colors"
import { getTopInputs, MAX_CONNECTIONS } from "@/neuron-layers/connections"
import type { NeuronStateful } from "@/neuron-layers/types"

const MIN_BRIGHTNESS = 0.3 // for the weakest connections

const fromPos = new THREE.Vector3()
const toPos = new THREE.Vector3()

// shows the strongest input connections of a neuron
export const HoverConnections = ({ neuron }: { neuron?: NeuronStateful }) => {
  const showLines = useSceneStore((s) => s.vis.showLines)
  const isFlatView = useSceneStore((s) => s.vis.flatView) // other layers are hidden in flat view
  const excludedLayers = useSceneStore((s) => s.vis.excludedLayers)
  const invalidate = useThree((s) => s.invalidate)

  const layer = neuron?.layer
  const prevLayer = layer?.prevLayer
  const prevActivations = useSceneStore((s) =>
    prevLayer ? s.activations[prevLayer.index]?.activations : undefined,
  )
  const isExcluded =
    excludedLayers.includes(layer?.tfLayer.name ?? "") ||
    excludedLayers.includes(prevLayer?.tfLayer.name ?? "")
  const show = !!prevLayer && showLines && !isFlatView && !isExcluded

  const inputs = useMemo(
    () => (show && neuron ? getTopInputs(neuron, prevActivations) : []),
    [show, neuron, prevActivations],
  )

  // buffers are allocated once and updated in place
  const line = useMemo(() => {
    const geometry = new LineSegmentsGeometry()
    geometry.setPositions(new Float32Array(MAX_CONNECTIONS * 6))
    geometry.setColors(new Float32Array(MAX_CONNECTIONS * 6))
    const material = new THREE.Line2NodeMaterial({
      vertexColors: true,
      linewidth: 1,
      transparent: true,
      depthWrite: false,
    })
    const lineSegments = new LineSegments2(geometry, material)
    lineSegments.frustumCulled = false // bounding volumes are not updated
    lineSegments.renderOrder = 1 // after the (transparent) textured layers, which would cover the lines otherwise
    lineSegments.raycast = () => {}
    lineSegments.visible = false
    return lineSegments
  }, [])
  useEffect(() => {
    return () => {
      line.geometry.dispose()
      line.material.dispose()
    }
  }, [line])

  useEffect(() => {
    line.visible = inputs.length > 0 // eslint-disable-line react-hooks/immutability
    line.geometry.instanceCount = inputs.length // eslint-disable-line react-hooks/immutability
    const colors = line.geometry.attributes.instanceColorStart as THREE.InterleavedBufferAttribute
    for (const [i, { strength }] of inputs.entries()) {
      const brightness = MIN_BRIGHTNESS + (1 - MIN_BRIGHTNESS) * Math.abs(strength)
      const color = getActColor(strength < 0 ? -brightness : brightness).rgb
      const offset = (inputs.length - 1 - i) * 6 // strongest connections are drawn last (on top)
      colors.data.array.set(color, offset)
      colors.data.array.set(color, offset + 3)
    }
    colors.data.needsUpdate = true
    invalidate()
  }, [line, inputs, invalidate])

  useFrame(() => {
    // per frame to follow layer transitions
    if (!inputs.length || !layer || !prevLayer) return
    if (!getWorldPosInto(layer, neuron.index, toPos)) return
    const positions = line.geometry.attributes.instanceStart as THREE.InterleavedBufferAttribute
    for (const [i, { index }] of inputs.entries()) {
      const offset = (inputs.length - 1 - i) * 6
      const hasPos = getWorldPosInto(prevLayer, index, fromPos)
      ;(hasPos ? fromPos : toPos).toArray(positions.data.array, offset) // zero length if not found
      toPos.toArray(positions.data.array, offset + 3)
    }
    positions.data.needsUpdate = true // eslint-disable-line react-hooks/immutability
  })

  return <primitive object={line} />
}
