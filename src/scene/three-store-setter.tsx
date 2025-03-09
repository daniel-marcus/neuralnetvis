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
  const { camera, invalidate, gl, controls: _controls } = useThree()
  const setThree = useSceneStore((s) => s.setThree)
  useEffect(() => {
    const controls = _controls as OrbitControls
    const three = { camera, invalidate, gl, controls }
    setThree(three)
  }, [camera, invalidate, gl, _controls, setThree])
  return null
}
