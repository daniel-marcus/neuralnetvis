import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three/webgpu"
import { useThree } from "@react-three/fiber"
import { clearStatus, setStatus, useSceneStore } from "@/store"
import { useLayers, type NeuronLayer } from "@/neuron-layers"
import { ActivationUpdater } from "@/model/activations"
import { moveCameraTo, useAnimatedPosition } from "./utils"
import { Layer } from "./layer"
import { HoverComponents } from "./interactions"
import { useIsPlayMode } from "@/components/tab-menu"
import type { Pos } from "./utils"

export const Model = () => {
  const layers = useLayers()
  const mountedLayers = useMountedLayers(layers)
  const visibleLayers = useVisibleLayers(layers)
  useAutoExpand()
  useCameraShifter(visibleLayers)
  return (
    <>
      <ActivationUpdater layers={visibleLayers} />
      <ModelShifter visibleLayers={visibleLayers}>
        {mountedLayers.map((l) => (
          <Layer key={l.lid} {...l} visibleLayers={visibleLayers} />
        ))}
      </ModelShifter>
      <HoverComponents />
    </>
  )
}

function useAutoExpand() {
  // auto expand when active and not a large model
  const setVisConfig = useSceneStore((s) => s.vis.setConfig)
  const isActive = useSceneStore((s) => s.isActive)
  const isLargeModel = useSceneStore((s) => s.isLargeModel)
  useEffect(() => {
    if (!isActive || isLargeModel) return
    const to = setTimeout(() => setVisConfig({ showHiddenLayers: true }), 0)
    return () => {
      clearTimeout(to)
    }
  }, [isActive, isLargeModel, setVisConfig])
}

const HIDDEN_LAYERS_STATUS = "hidden-layers-status"

// hidden layers are only mounted if they are shown or preloaded (small models: when the scene is hovered or active)
// they are mounted in batches, so that large models don't block the main thread
function useMountedLayers(layers: NeuronLayer[]) {
  const showHiddenLayers = useSceneStore((s) => s.vis.showHiddenLayers)
  const isActive = useSceneStore((s) => s.isActive)
  const isHovered = useSceneStore((s) => s.isHovered)
  const isLargeModel = useSceneStore((s) => s.isLargeModel)
  const withHidden = showHiddenLayers || (!isLargeModel && (isActive || isHovered))

  const numHidden = useMemo(() => layers.filter((l) => l.layerPos === "hidden").length, [layers])
  const numMounted = useBatchedCount(withHidden ? numHidden : 0)

  const isLoading = showHiddenLayers && numMounted > 0 && numMounted < numHidden
  useEffect(() => {
    if (!isLoading) return
    setStatus("Loading hidden layers ...", numMounted / numHidden, { id: HIDDEN_LAYERS_STATUS })
  }, [isLoading, numMounted, numHidden])
  useEffect(() => {
    if (!isLoading) return
    return () => clearStatus(HIDDEN_LAYERS_STATUS)
  }, [isLoading])

  return useMemo(() => {
    if (numMounted >= numHidden) return layers
    let hiddenIdx = 0
    return layers.filter((l) => l.layerPos !== "hidden" || hiddenIdx++ < numMounted)
  }, [layers, numMounted, numHidden])
}

const MIN_BATCH = 1
const INITIAL_BATCH = 8 // small models are mounted in 1-2 frames
const MAX_BATCH = 32
const TARGET_FRAME_TIME = 20 // ms

// counts up to the target in batches (1 per frame), the batch size is adapted to the frame time
function useBatchedCount(target: number) {
  const [count, setCount] = useState(0)
  if (count > target) setCount(target) // counting down is not batched
  const batch = useRef({ size: INITIAL_BATCH, lastTime: 0 })
  useEffect(() => {
    if (count >= target) {
      batch.current = { size: INITIAL_BATCH, lastTime: 0 }
      return
    }
    const id = requestAnimationFrame((time) => {
      const { size, lastTime } = batch.current
      const frameTime = lastTime ? time - lastTime : 0
      const isSlow = frameTime > TARGET_FRAME_TIME * 1.25
      const isFast = frameTime < TARGET_FRAME_TIME * 0.9 // within 1 frame at 60 fps
      const newSize = isSlow ? (size * TARGET_FRAME_TIME) / frameTime : isFast ? size * 1.5 : size
      const clampedSize = lastTime ? Math.min(Math.max(newSize, MIN_BATCH), MAX_BATCH) : size
      batch.current = { size: clampedSize, lastTime: time }
      setCount((c) => Math.min(c + Math.ceil(clampedSize), target))
    })
    return () => cancelAnimationFrame(id)
  }, [count, target])
  return Math.min(count, target)
}

export function useVisibleLayers(layers: NeuronLayer[]) {
  const showHiddenLayers = useSceneStore((s) => s.vis.showHiddenLayers)
  const onlyInputAndOutputLayers = useMemo(
    () => layers.filter((l) => l.layerPos !== "hidden"),
    [layers],
  )
  return showHiddenLayers ? layers : onlyInputAndOutputLayers
}

const cameraDir = new THREE.Vector3(-23, 0, 35).normalize()
const cameraDirLarge = new THREE.Vector3(-23, 10, 18).normalize()

function useCameraShifter(layers: NeuronLayer[]) {
  // Adjust camera to model size
  const sceneActive = useSceneStore((s) => s.isActive)
  const isPlayMode = useIsPlayMode()
  const isActive = sceneActive && isPlayMode
  const { xShift } = useSceneStore((s) => s.vis)
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    if (!isActive || !(camera instanceof THREE.PerspectiveCamera)) return
    // TODO: find a linear solution?
    const numLayers = Math.max(3, layers.length)
    const isLarge = numLayers > 10
    const offset = isLarge ? 0.8 : 1.2
    const modelLength = numLayers * xShift
    const fov = camera.fov! * (Math.PI / 180)
    const center = new THREE.Vector3(0, 0, 0)
    const radius = Math.abs(modelLength / 2 / Math.tan(fov / 2)) * offset
    const dirVec = isLarge ? cameraDirLarge : cameraDir
    const direction = dirVec.clone().multiplyScalar(radius)

    const newPos = center.add(direction)
    const duration = 500
    const lookAt = (isLarge ? [0, 0, 0] : [0, 0, 0]) as Pos
    moveCameraTo(newPos.toArray(), lookAt, undefined, { duration })
  }, [isActive, layers.length, camera, xShift])
}

interface ModelShifterProps {
  children: React.ReactNode
  visibleLayers: NeuronLayer[]
}

function ModelShifter({ children, visibleLayers }: ModelShifterProps) {
  const position = useModelOffset(visibleLayers)
  const ref = useAnimatedPosition(position, 0.1)
  return <group ref={ref}>{children}</group>
}

function useModelOffset(visibleLayers: NeuronLayer[]) {
  const focusIdx = useSceneStore((s) => s.focussedLayerIdx)
  const hasFocussed = typeof focusIdx === "number"
  const focusVisibleIdx = hasFocussed ? visibleLayers.findIndex((l) => l.index === focusIdx) : -1
  const center = (visibleLayers.length - 1) * 0.5
  const offset = !hasFocussed ? 0 : center - focusVisibleIdx

  const { xShift, yShift, zShift } = useSceneStore((s) => s.vis)
  const position = useMemo(
    () => [offset * xShift, offset * yShift, offset * zShift],
    [offset, xShift, yShift, zShift],
  )
  return position
}
