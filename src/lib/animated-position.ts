import { useFrame, useThree } from "@react-three/fiber"
import { useMemo, useRef } from "react"
import { Object3D, Vector3 } from "three"

export function useAnimatedPosition(position: number[], speed = 0.4) {
  const ref = useRef<Object3D>(null)
  const currentPosition = useRef(new Vector3())
  const { invalidate } = useThree()
  const targetPosition = useMemo(() => new Vector3(...position), [position])
  useFrame(() => {
    if (ref.current) {
      if (!targetPosition.equals(currentPosition.current)) {
        // invalidate the canvas to trigger a re-render
        invalidate()
      }
      currentPosition.current.lerp(targetPosition, speed)
      // allow tolerance for floating point errors
      if (currentPosition.current.distanceTo(targetPosition) < 0.01) {
        currentPosition.current.copy(targetPosition)
      } else {
        ref.current.position.copy(currentPosition.current)
      }
    }
  })
  return ref
}
