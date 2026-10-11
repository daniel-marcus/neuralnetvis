import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three/webgpu"
import { useFrame, useThree } from "@react-three/fiber"
import { Controller, type SpringConfig, config } from "@react-spring/web"
import { getThree, getVisConfig } from "@/store"
import { getNeuronIdxAt, getNeuronPos, getNeuronSize } from "@/neuron-layers/layout"
import type { Neuron, NeuronLayer } from "@/neuron-layers/types"
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
      }
      ref.current.position.copy(currentPosition.current)
    }
  })
  return ref
}

export function getWorldPos(neuron: Neuron): THREE.Vector3 | undefined {
  return getWorldTransform(neuron)?.position
}

// instance scale: e.g. token tiles with the width of the token (see TokenLayer)
export function getWorldTransform(neuron: Neuron) {
  if (!getNeuronWorldMatrix(neuron.layer, neuron.index, _matrix)) return
  const position = new THREE.Vector3()
  const scale = new THREE.Vector3()
  _matrix.decompose(position, new THREE.Quaternion(), scale)
  return { position, scale }
}

const _matrix = new THREE.Matrix4()
const _inverseMatrix = new THREE.Matrix4()
const _ray = new THREE.Ray()

// world position of a neuron by layer & index, written into target (no allocations, for per-frame use)
export function getWorldPosInto(layer: NeuronLayer, neuronIdx: number, target: THREE.Vector3) {
  if (!getNeuronWorldMatrix(layer, neuronIdx, _matrix)) return false
  target.setFromMatrixPosition(_matrix)
  return true
}

// textured layers have no instances: the position is calculated from the layout instead
function getNeuronWorldMatrix(layer: NeuronLayer, neuronIdx: number, target: THREE.Matrix4) {
  const numChannels = layer.hasColorChannels ? (layer.outputShape[3] ?? 1) : 1
  const channelIdx = neuronIdx % numChannels
  const idx = Math.floor(neuronIdx / numChannels)
  const mesh = layer.meshRefs[channelIdx]?.current
  if (mesh) {
    mesh.getMatrixAt(idx, target)
    target.premultiply(mesh.matrixWorld)
    return true
  }
  const group = layer.groupRefs[channelIdx]?.current
  if (!group) return false
  const { height, width, channels, spacedSize } = getLayerGrid(layer)
  const [x, y, z] = getNeuronPos(idx, layer.layerPos, height, width, channels, spacedSize)
  target.makeTranslation(x, y, z).premultiply(group.matrixWorld)
  return true
}

const _position = new THREE.Vector3()
const _halfSize = new THREE.Vector3()
const _corner = new THREE.Vector3()

// bounding box of neurons within their mesh / group, incl. half of the spacing to the next neurons
// returns the world matrix of that mesh / group (color layers: the neurons have to be in the same channel)
export function getNeuronBoundsInto(
  layer: NeuronLayer,
  neuronIdxs: ArrayLike<number>,
  target: THREE.Box3,
) {
  if (!neuronIdxs.length) return undefined
  const numChannels = layer.hasColorChannels ? (layer.outputShape[3] ?? 1) : 1
  const channelIdx = neuronIdxs[0] % numChannels
  const mesh = layer.meshRefs[channelIdx]?.current
  const parent = mesh ?? layer.groupRefs[channelIdx]?.current
  if (!parent) return undefined
  const { height, width, channels, size, spacedSize } = getLayerGrid(layer)
  target.makeEmpty()
  for (let i = 0; i < neuronIdxs.length; i++) {
    const idx = Math.floor(neuronIdxs[i] / numChannels)
    if (mesh) {
      mesh.getMatrixAt(idx, _matrix)
      _position.setFromMatrixPosition(_matrix)
      _halfSize.setFromMatrixScale(_matrix).multiplyScalar(size * 0.5) // see getWorldTransform
    } else {
      // textured layers, as in getNeuronWorldMatrix
      const pos = getNeuronPos(idx, layer.layerPos, height, width, channels, spacedSize)
      _position.fromArray(pos)
      _halfSize.setScalar(size * 0.5)
    }
    target.expandByPoint(_corner.copy(_position).sub(_halfSize))
    target.expandByPoint(_corner.copy(_position).add(_halfSize))
  }
  const halfGap = Math.max(spacedSize - size, 0) * 0.5
  target.min.y -= halfGap
  target.min.z -= halfGap
  target.max.y += halfGap
  target.max.z += halfGap
  return parent.matrixWorld
}

function getLayerGrid(layer: NeuronLayer) {
  const [, height, width = 1, _channels = 1] = layer.outputShape
  const channels = layer.hasColorChannels ? 1 : _channels // color channels have separate groups
  const { size, spacedSize } = getNeuronSize(layer.meshParams, getVisConfig("neuronSpacing"))
  return { height, width, channels, size, spacedSize }
}

// index of the neuron that is hit by the ray, calculated from the layout (no raycasting, e.g. for textured layers)
export function getNeuronIdxAtRay(layer: NeuronLayer, ray: THREE.Ray) {
  const { height, width, channels, size, spacedSize } = getLayerGrid(layer)
  for (const [channelIdx, groupRef] of layer.groupRefs.entries()) {
    const group = groupRef.current
    if (!group) continue
    _ray.copy(ray).applyMatrix4(_inverseMatrix.copy(group.matrixWorld).invert())
    const { origin, direction } = _ray
    if (!direction.x) continue
    // layers are flat on the x axis: intersect with the face on the side of the ray origin
    const faceX = Math.sign(origin.x) * size * 0.5
    const t = (faceX - origin.x) / direction.x
    if (t < 0) continue
    const y = origin.y + t * direction.y
    const z = origin.z + t * direction.z
    const idx = getNeuronIdxAt(y, z, layer.layerPos, height, width, channels, spacedSize)
    if (typeof idx === "number") return idx + channelIdx // as in useNeuronInteractions
  }
  return undefined
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
