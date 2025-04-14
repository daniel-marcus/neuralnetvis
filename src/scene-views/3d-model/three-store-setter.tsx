import { useEffect } from "react"
import { useThree } from "@react-three/fiber"
import { useSceneStore } from "@/store"
import type { OrbitControls } from "three-stdlib"

export const ThreeStoreSetter = () => {
  useThreeStoreSetter()
  return null
}

function useThreeStoreSetter() {
  // make three available outside of the render context
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  const controls = useThree((s) => s.controls) as OrbitControls
  const setThree = useSceneStore((s) => s.setThree)
  useEffect(() => {
    const three = { camera, invalidate, gl, controls }
    setThree(three)
  }, [camera, invalidate, gl, controls, setThree])
  return null
}
