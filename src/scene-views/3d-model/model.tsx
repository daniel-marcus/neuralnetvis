import { useEffect, useLayoutEffect, useMemo } from "react"
import * as THREE from "three/webgpu"
import { useThree } from "@react-three/fiber"
import { useSceneStore } from "@/store"
import { useLayers, type NeuronLayer } from "@/neuron-layers"
import { ActivationUpdater } from "@/model/activations"
import { moveCameraTo, useAnimatedPosition, useDynamicXShift } from "./utils"
import { Layer } from "./layer"
import { HoverComponents } from "./interactions"
import type { Pos } from "./utils"
import { useIsPlayMode } from "@/components/tab-menu"

export const Model = () => {
  const layers = useLayers()
  const visibleLayers = useVisibleLayers(layers)
  useCameraShifter(visibleLayers)
  return (
    <>
      <ActivationUpdater layers={layers} />
      <ModelShifter visibleLayers={visibleLayers}>
        {layers.map((l) => (
          <Layer key={l.lid} {...l} visibleLayers={visibleLayers} />
        ))}
      </ModelShifter>
      <HoverComponents />
    </>
  )
}

// TODO: combine with useIsInvisibe / match with LayerWheel ...
function useVisibleLayers(allLayers: NeuronLayer[]) {
  const showHiddenLayers = useSceneStore((s) => s.vis.showHiddenLayers)
  const visibleLayers = useSceneStore((s) => s.visibleLayers)
  const setVisibleLayers = useSceneStore((s) => s.setVisibleLayers)
  useLayoutEffect(() => {
    const visibleLayers = showHiddenLayers
      ? allLayers
      : allLayers.filter((l) => l.layerPos !== "hidden")
    setVisibleLayers(visibleLayers)
  }, [allLayers, showHiddenLayers, setVisibleLayers])
  return visibleLayers
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
    const isLarge = layers.length > 10
    const offset = isLarge ? 0.8 : 1.2
    const modelLength = layers.length * xShift
    const fov = camera.fov! * (Math.PI / 180)
    const center = new THREE.Vector3(0, 0, 0)
    const radius = Math.abs(modelLength / 2 / Math.tan(fov / 2)) * offset
    const dirVec = isLarge ? cameraDirLarge : cameraDir
    const direction = dirVec.clone().multiplyScalar(radius)

    const newPos = center.add(direction)
    const duration = 500
    const lookAt = (isLarge ? [0, 0, 0] : [0, 0, 0]) as Pos
    moveCameraTo(newPos.toArray(), lookAt, undefined, { duration })
  }, [isActive, layers.length, camera])
}

interface ModelShifterProps {
  children: React.ReactNode
  visibleLayers: NeuronLayer[]
}

function ModelShifter({ children, visibleLayers }: ModelShifterProps) {
  const position = useModelOffset(visibleLayers)
  const ref = useAnimatedPosition(position, 0.1)
  useDynamicXShift(visibleLayers.length)
  return <group ref={ref}>{children}</group>
}

function useModelOffset(visibleLayers: NeuronLayer[]) {
  const focusIdx = useSceneStore((s) => s.focussedLayerIdx)
  const hasFocussed = typeof focusIdx === "number"
  const focusVisibleIdx = hasFocussed
    ? visibleLayers.findIndex((l) => l.index === focusIdx)
    : -1
  const center = (visibleLayers.length - 1) * 0.5
  const offset = !hasFocussed ? 0 : center - focusVisibleIdx

  const { xShift, yShift, zShift } = useSceneStore((s) => s.vis)
  const position = useMemo(
    () => [offset * xShift, offset * yShift, offset * zShift],
    [offset, xShift, yShift, zShift]
  )
  return position
}
