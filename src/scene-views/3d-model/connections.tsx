import { useEffect, useMemo } from "react"
import * as THREE from "three/webgpu"
import { useFrame, useThree } from "@react-three/fiber"

import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"

import { useSceneStore } from "@/store"
import { getNeuronBoundsInto, getWorldPosInto } from "./utils"
import { getActColor } from "@/utils/colors"
import { getInputRegions, getTopInputs, MAX_CONNECTIONS } from "@/neuron-layers/connections"
import type { Neuron, NeuronStateful } from "@/neuron-layers/types"

const MIN_BRIGHTNESS = 0.3 // for the weakest connections

const fromPos = new THREE.Vector3()
const toPos = new THREE.Vector3()

// the inputs of a neuron are only shown if the previous layer is visible
function useShowInputs(neuron?: Neuron) {
  const showLines = useSceneStore((s) => s.vis.showLines)
  const isFlatView = useSceneStore((s) => s.vis.flatView) // other layers are hidden in flat view
  const excludedLayers = useSceneStore((s) => s.vis.excludedLayers)
  const showHiddenLayers = useSceneStore((s) => s.vis.showHiddenLayers)
  const layer = neuron?.layer
  const prevLayer = layer?.prevLayer
  const isExcluded =
    excludedLayers.includes(layer?.tfLayer.name ?? "") ||
    excludedLayers.includes(prevLayer?.tfLayer.name ?? "")
  const isPrevVisible = showHiddenLayers || prevLayer?.layerPos !== "hidden"
  return !!prevLayer && isPrevVisible && showLines && !isFlatView && !isExcluded
}

// shows the strongest input connections of a neuron
export const HoverConnections = ({ neuron }: { neuron?: NeuronStateful }) => {
  const show = useShowInputs(neuron)
  const invalidate = useThree((s) => s.invalidate)

  const layer = neuron?.layer
  const prevLayer = layer?.prevLayer
  const prevActivations = useSceneStore((s) =>
    prevLayer ? s.activations[prevLayer.index]?.activations : undefined,
  )

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

const REGION_COLOR = "rgb(150, 156, 171)"
const REGION_PADDING = 0.05 // on the x-axis: distance to the surface of the layer, less than the layer hover box

const boxEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1))
const boxVertices = boxEdges.getAttribute("position").array

const bounds = new THREE.Box3()
const center = new THREE.Vector3()
const size = new THREE.Vector3()
const vertex = new THREE.Vector3()

// frames the inputs of a neuron in the previous layer (e.g. the receptive field in every feature map):
// the ends of the connections are hidden inside of the layer, the frames enclose it and are visible from both sides
export const InputRegions = ({ neuron }: { neuron?: Neuron }) => {
  const show = useShowInputs(neuron)
  const invalidate = useThree((s) => s.invalidate)

  const prevLayer = neuron?.layer.prevLayer
  const inputIdxs = neuron?.inputIdxs
  const prevShape = prevLayer?.outputShape
  const regions = useMemo(
    () => (show && inputIdxs && prevShape ? getInputRegions(inputIdxs, prevShape) : []),
    [show, inputIdxs, prevShape],
  )

  // the buffer only grows in powers of 2 and is updated in place
  const capacity = 2 ** Math.ceil(Math.log2(Math.max(regions.length, 1)))
  const frames = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(capacity * boxVertices.length)
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    // opaque: the frames of color channels are at the same position
    const material = new THREE.LineBasicMaterial({ color: REGION_COLOR })
    const lineSegments = new THREE.LineSegments(geometry, material)
    lineSegments.frustumCulled = false // bounding volumes are not updated
    lineSegments.raycast = () => {}
    lineSegments.visible = false
    return lineSegments
  }, [capacity])
  useEffect(() => {
    return () => {
      frames.geometry.dispose()
      frames.material.dispose()
    }
  }, [frames])

  useEffect(() => {
    frames.visible = regions.length > 0 // eslint-disable-line react-hooks/immutability
    frames.geometry.setDrawRange(0, (regions.length * boxVertices.length) / 3)
    invalidate()
  }, [frames, regions, invalidate])

  useFrame(() => {
    // per frame to follow layer transitions
    if (!regions.length || !prevLayer) return
    const positions = frames.geometry.attributes.position as THREE.BufferAttribute
    for (const [i, neuronIdxs] of regions.entries()) {
      const offset = i * boxVertices.length
      const worldMatrix = getNeuronBoundsInto(prevLayer, neuronIdxs, bounds)
      if (!worldMatrix) {
        positions.array.fill(0, offset, offset + boxVertices.length) // zero size if not found
        continue
      }
      bounds.getCenter(center)
      bounds.getSize(size)
      size.x += REGION_PADDING * 2
      for (let j = 0; j < boxVertices.length; j += 3) {
        vertex.fromArray(boxVertices, j).multiply(size).add(center).applyMatrix4(worldMatrix)
        vertex.toArray(positions.array, offset + j)
      }
    }
    positions.needsUpdate = true // eslint-disable-line react-hooks/immutability
  })

  return <primitive object={frames} />
}
