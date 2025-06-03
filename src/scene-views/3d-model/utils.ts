import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three/webgpu"
import { useFrame, useThree } from "@react-three/fiber"
import { Controller, SpringConfig, config } from "@react-spring/web"
import { getThree, useSceneStore } from "@/store"
import { defaultVisConfig, type Three } from "@/store/vis"
import { clamp } from "@/utils/helpers"
import type { Neuron } from "@/neuron-layers/types"

export function useAnimatedPosition(position: number[], speed = 0.4) {
  const ref = useRef<THREE.Mesh>(null)
  const currentPosition = useRef(new THREE.Vector3())
  const invalidate = useThree(({ invalidate }) => invalidate)
  const targetPos = useMemo(() => new THREE.Vector3(...position), [position])
  useEffect(() => {
    requestAnimationFrame(invalidate)
  }, [targetPos, invalidate])
  useFrame(() => {
    if (ref.current && !targetPos.equals(currentPosition.current)) {
      invalidate()
      currentPosition.current.lerp(targetPos, speed)
      if (currentPosition.current.distanceTo(targetPos) < 0.01) {
        currentPosition.current.copy(targetPos) // allow tolerance for floating point errors
      } else {
        ref.current.position.copy(currentPosition.current)
      }
    }
  })
  return ref
}

export function getWorldPos(neuron: Neuron): THREE.Vector3 | undefined {
  const { meshRef, index, indexInChannel } = neuron
  const idx = neuron.layer.hasColorChannels ? indexInChannel : index
  if (!meshRef?.current) return
  const worldPos = new THREE.Vector3()
  const tempMatrix = new THREE.Matrix4()
  const tempWorldMatrix = new THREE.Matrix4()
  meshRef.current.getMatrixAt(idx, tempMatrix)
  tempWorldMatrix.multiplyMatrices(meshRef.current.matrixWorld, tempMatrix)
  tempWorldMatrix.decompose(
    worldPos,
    new THREE.Quaternion(),
    new THREE.Vector3()
  )
  return worldPos
}

export type Pos = [number, number, number]

export function getCameraPos() {
  const three = getThree()
  if (!three) return
  return three.camera.position.toArray() as Pos
}

export function moveCameraTo(
  targetPos?: Pos,
  lookAt?: Pos,
  _three?: Three,
  customConfig?: SpringConfig
) {
  const currSceneThree = getThree()
  const three = _three || currSceneThree
  if (!three) return
  const initialPos = three.camera.position.toArray() as Pos
  const initialLookAt = (three.controls?.target.toArray() as Pos) || [0, 0, 0]
  const api = new Controller<{ position: Pos; lookAt: Pos }>({
    position: initialPos,
    lookAt: initialLookAt,
  })
  api.start({
    config: customConfig ?? config.default,
    position: targetPos ?? initialPos,
    lookAt: lookAt ?? initialLookAt,
    from: { position: initialPos, lookAt: initialLookAt },
    onChange: ({ value }) => {
      three.camera.position.set(...value.position)
      three.controls?.target.set(...value.lookAt)
      three.invalidate()
    },
  })
}

export function interpolateCamera(from: Pos, to: Pos, percent: number) {
  const three = getThree()
  if (!three) return
  const camera = three.camera
  const position = new THREE.Vector3()
  position.fromArray(from).lerp(new THREE.Vector3().fromArray(to), percent)
  camera.position.copy(position)
  camera.lookAt(0, 0, 0)
  three.invalidate()
}

export function interpolate(from: number, to: number, percent: number): number {
  percent = Math.max(0, Math.min(1, percent))
  return from + (to - from) * percent
}

const MAX_X_WIDTH = 500 // in three.js units
const MIN_X_SHIFT = 2

// use smaller xShift for models with many layers
export function useDynamicXShift(numVisibleLayers: number) {
  const setVisConfig = useSceneStore((s) => s.vis.setConfig)
  useEffect(() => {
    const dynamicXShift = Math.round(MAX_X_WIDTH / numVisibleLayers)
    const defaultXShift = defaultVisConfig.xShift
    const clampedXShift = clamp(dynamicXShift, MIN_X_SHIFT, defaultXShift)
    setVisConfig({ xShift: clampedXShift })
    return () => setVisConfig({ xShift: defaultXShift })
  }, [numVisibleLayers, setVisConfig])
}

export function useSize(
  ref: React.RefObject<THREE.Object3D | null>,
  padding = 0
): [[number, number, number], THREE.Box3] {
  const bBox = useMemo(() => new THREE.Box3(), [])
  const sizeVec = useMemo(() => new THREE.Vector3(), [])
  const [size, setSize] = useState<[number, number, number]>([0, 0, 0])
  useEffect(() => {
    if (!ref.current) return //  || !updTrigger
    bBox.setFromObject(ref.current)
    bBox.getSize(sizeVec)
    setSize([sizeVec.x + padding, sizeVec.y + padding, sizeVec.z + padding])
  }, [ref, bBox, sizeVec, padding])
  return [size, bBox] as const
}

export function useIsClose(
  ref: React.RefObject<THREE.Object3D | null>,
  threshold: number
): boolean {
  const camera = useThree((s) => s.camera)
  const [isClose, setIsClose] = useState(false)
  const isCloseRef = useRef(false)
  const bBox = useMemo(() => new THREE.Box3(), [])

  useFrame(() => {
    if (!ref.current) return
    bBox.setFromObject(ref.current)
    const distance = bBox.distanceToPoint(camera.position)

    if (distance < threshold !== isCloseRef.current) {
      isCloseRef.current = distance < threshold
      setIsClose(isCloseRef.current)
    }
  })

  return isClose
}
