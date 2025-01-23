import { PositionMesh } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { useRef } from "react"
import { Vector3 } from "three"

export function useAnimatedPosition(position: number[]) {
  const ref = useRef<PositionMesh>(null)
  const currentPosition = useRef(new Vector3())
  useFrame(() => {
    if (ref.current) {
      const targetPosition = new Vector3(...position)
      const speed = 0.4
      currentPosition.current.lerp(targetPosition, speed)
      ref.current.position.copy(currentPosition.current)
    }
  })
  return ref
}
