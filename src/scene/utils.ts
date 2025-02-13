import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { useFrame, useThree } from "@react-three/fiber"
import type { NeuronDef } from "@/neuron-layers/types"
import { getThree } from "./three-store"
import { Controller } from "@react-spring/web"

export function useAnimatedPosition(position: number[], speed = 0.4) {
  // TODO: could use spring here
  const ref = useRef<THREE.Mesh>(null)
  const currentPosition = useRef(new THREE.Vector3())
  const { invalidate } = useThree()
  const targetPos = useMemo(() => new THREE.Vector3(...position), [position])
  const [isAnimating, setIsAnimating] = useState(false)
  useEffect(() => {
    requestAnimationFrame(invalidate)
  }, [targetPos, invalidate])
  useFrame(() => {
    if (ref.current) {
      if (!targetPos.equals(currentPosition.current)) {
        // invalidate the canvas to trigger a re-render
        invalidate()
        setIsAnimating(true)
      } else {
        setIsAnimating(false)
      }
      currentPosition.current.lerp(targetPos, speed)
      // allow tolerance for floating point errors
      if (currentPosition.current.distanceTo(targetPos) < 0.01) {
        currentPosition.current.copy(targetPos)
      } else {
        ref.current.position.copy(currentPosition.current)
      }
    }
  })
  return [ref, isAnimating] as const
}

export function getWorldPos(neuron: NeuronDef): THREE.Vector3 | undefined {
  const { meshRef, indexInGroup } = neuron
  if (!meshRef?.current) return
  const worldPos = new THREE.Vector3()
  const tempMatrix = new THREE.Matrix4()
  const tempWorldMatrix = new THREE.Matrix4()
  meshRef.current.getMatrixAt(indexInGroup, tempMatrix)
  tempWorldMatrix.multiplyMatrices(meshRef.current.matrixWorld, tempMatrix)
  tempWorldMatrix.decompose(
    worldPos,
    new THREE.Quaternion(),
    new THREE.Vector3()
  )
  return worldPos
}

export type Position = [number, number, number]

export function moveCameraTo(targetPosition: Position, duration = 500) {
  const three = getThree()
  if (!three) return
  const initialPosition = three.camera.position.toArray() as Position
  const api = new Controller<{ position: Position }>({
    position: initialPosition,
  })
  api.start({
    config: { duration },
    position: targetPosition,
    from: { position: initialPosition },
    onChange: ({ value }) => {
      three.camera.position.set(...value.position)
      three.camera.lookAt(0, 0, 0)
      three.invalidate()
    },
  })
}

export function interpolateCamera(
  fromPos: Position,
  toPos: Position,
  percent: number
) {
  const three = getThree()
  if (!three) return
  const camera = three.camera
  const position = new THREE.Vector3()
  position
    .fromArray(fromPos)
    .lerp(new THREE.Vector3().fromArray(toPos), percent)
  camera.position.copy(position)
  camera.lookAt(0, 0, 0)
  three.invalidate()
}
