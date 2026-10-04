import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three/webgpu"
import { useFrame, useThree } from "@react-three/fiber"
import { Controller, type SpringConfig, config } from "@react-spring/web"
import { getThree } from "@/store"
import type { Neuron } from "@/neuron-layers/types"
import type { Three } from "@/store/vis"

export function useAnimatedPosition(position: number[], speed = 0.4) {
  const ref = useRef<THREE.Mesh>(null)
  const currentPosition = useRef(new THREE.Vector3())
  const invalidate = useThree((t) => t.invalidate)
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
  tempWorldMatrix.decompose(worldPos, new THREE.Quaternion(), new THREE.Vector3())
  return worldPos
}

export type Pos = [number, number, number]

export function moveCameraTo(
  targetPos?: Pos,
  lookAt?: Pos,
  _three?: Three,
  customConfig?: SpringConfig,
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

export function useSize(ref: React.RefObject<THREE.Object3D | null>, padding = 0) {
  const bBox = useMemo(() => new THREE.Box3(), [])
  const sizeVec = useMemo(() => new THREE.Vector3(), [])
  const [size, setSize] = useState<[number, number, number]>([0, 0, 0])
  useEffect(() => {
    if (!ref.current) return
    bBox.setFromObject(ref.current)
    bBox.getSize(sizeVec)
    // value comes from ref, so state setting in effect is ok (https://react.dev/reference/eslint-plugin-react-hooks/lints/set-state-in-effect#valid)
    setSize([sizeVec.x + padding, sizeVec.y + padding, sizeVec.z + padding])
  }, [ref, bBox, sizeVec, padding])
  return size
}

// distances of all objects that use useIsClose with maxCount, per camera (= per scene view)
const distanceRegistries = new WeakMap<THREE.Camera, Map<number, number>>()
let nextRegistryId = 0

// maxCount: only the closest objects count as close (among all that use maxCount)
export function useIsClose(
  ref: React.RefObject<THREE.Object3D | null>,
  threshold: number,
  maxCount = Infinity,
): boolean {
  const camera = useThree((s) => s.camera)
  const [isClose, setIsClose] = useState(false)
  const isCloseRef = useRef(false)
  const bBox = useMemo(() => new THREE.Box3(), [])
  const [id] = useState(() => nextRegistryId++)
  const isLimited = Number.isFinite(maxCount)

  useEffect(() => {
    if (!isLimited) return
    let registry = distanceRegistries.get(camera)
    if (!registry) {
      registry = new Map()
      distanceRegistries.set(camera, registry)
    }
    const reg = registry
    return () => {
      reg.delete(id)
    }
  }, [camera, id, isLimited])

  useFrame(() => {
    if (!ref.current) return
    bBox.setFromObject(ref.current)
    const distance = bBox.distanceToPoint(camera.position)
    let close = distance < threshold

    const registry = isLimited ? distanceRegistries.get(camera) : undefined
    if (registry) {
      // first frame: other objects might not have reported their distance yet, wait for a complete ranking
      const isFirstFrame = !registry.has(id)
      registry.set(id, distance)
      if (isFirstFrame) close = false
      else if (close) {
        // ranking based on the distances other objects reported (possibly 1 frame old), ties by id
        let closerCount = 0
        for (const [otherId, d] of registry) {
          if (d < distance || (d === distance && otherId < id)) closerCount++
        }
        close = closerCount < maxCount
      }
    }

    if (close !== isCloseRef.current) {
      isCloseRef.current = close
      setIsClose(close)
    }
  })

  return isClose
}

// views (CanvasTargetView, ScissorView) flag whether they rendered their scene in the current frame,
// so that objects can skip per-frame work while the view is offscreen or invisible (e.g. TextLabel)
export function setIsRendered(
  state: { scene: THREE.Scene; invalidate: () => void },
  isRendered: boolean,
) {
  const { userData } = state.scene
  if (userData.isRendered === isRendered) return
  userData.isRendered = isRendered
  if (isRendered) state.invalidate() // one more frame, so that skipped updates can catch up
}

export function isSceneRendered(scene: THREE.Scene) {
  return scene.userData.isRendered !== false
}
