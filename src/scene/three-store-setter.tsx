import { useEffect } from "react"
import { useThree } from "@react-three/fiber"
import { useStore } from "@/store"
import type { OrbitControls } from "three-stdlib"

export const ThreeStoreSetter = () => {
  useThreeStoreSetter()
  return null
}

function useThreeStoreSetter() {
  // make three available outside of the render context
  const { camera, invalidate, gl, controls: _controls } = useThree()
  useEffect(() => {
    const controls = _controls as OrbitControls
    const three = { camera, invalidate, gl, controls }
    useStore.setState({ three })
  }, [camera, invalidate, gl, _controls])
  return null
}
