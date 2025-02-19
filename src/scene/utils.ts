import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { useFrame, useThree } from "@react-three/fiber"
import { Controller, config } from "@react-spring/web"
import { getThree } from "@/store"
import type { NeuronDef } from "@/neuron-layers/types"

export function useAnimatedPosition(position: number[], speed = 0.4) {
  // TODO: could use spring here
  const ref = useRef<THREE.Mesh>(null)
  const currentPosition = useRef(new THREE.Vector3())
  const invalidate = useThree(({ invalidate }) => invalidate)
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

export type Pos = [number, number, number]

export function moveCameraTo(targetPos?: Pos, lookAt?: Pos) {
  const three = getThree()
  if (!three) return
  const initialPos = three.camera.position.toArray() as Pos
  const initialLookAt = (three.controls?.target.toArray() as Pos) || [0, 0, 0]
  const api = new Controller<{ position: Pos; lookAt: Pos }>({
    position: initialPos,
    lookAt: initialLookAt,
  })
  api.start({
    config: config.default,
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
