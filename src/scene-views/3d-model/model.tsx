import { useEffect, useMemo } from "react"
import * as THREE from "three/webgpu"
import { useThree } from "@react-three/fiber"
import { useSceneStore } from "@/store"
import { useLayers, type NeuronLayer } from "@/neuron-layers"
import { ActivationUpdater } from "@/model/activations"
import { moveCameraTo, useAnimatedPosition, useDynamicXShift } from "./utils"
import { Layer } from "./layer"
import { HoverComponents } from "./interactions"
import type { Pos } from "./utils"

export const Model = () => {
  const layers = useLayers()
  useCameraShifter(layers)
  return (
    <>
      <ActivationUpdater layers={layers} />
      <ModelShifter layers={layers}>
        {layers.map((l) => (
          <Layer key={l.lid} {...l} allLayers={layers} />
        ))}
      </ModelShifter>
      <HoverComponents />
    </>
  )
}

const cameraDir = new THREE.Vector3(-23, 0, 35).normalize()
const cameraDirLarge = new THREE.Vector3(-25, 10, 15).normalize()

function useCameraShifter(layers: NeuronLayer[]) {
  // Adjust camera to model size
  const isActive = useSceneStore((s) => s.isActive)
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
    const lookAt = (isLarge ? [0, -15, 0] : [0, 0, 0]) as Pos
    moveCameraTo(newPos.toArray(), lookAt, undefined, { duration })
  }, [isActive, layers.length, camera])
}

interface ModelShifterProps {
  children: React.ReactNode
  layers: NeuronLayer[]
}

function ModelShifter({ children, layers }: ModelShifterProps) {
  const position = useModelOffset(layers)
  const ref = useAnimatedPosition(position, 0.1)
  useDynamicXShift(layers.length)
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
