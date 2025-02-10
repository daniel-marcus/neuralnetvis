import { useDebugStore } from "@/lib/debug"
import { Stats } from "@react-three/drei"
import { useThree, useFrame } from "@react-three/fiber"
import { useEffect, useRef } from "react"
import * as THREE from "three"

// use for debug purposes

export const DebugUtils = () => {
  const debug = useDebugStore((s) => s.debug)
  if (!debug) return null
  return <Stats />
}

export function CameraLogger() {
  const { camera } = useThree()
  const prevPosition = useRef(camera.position.clone())

  useFrame(() => {
    if (!camera.position.equals(prevPosition.current)) {
      console.log("Camera position:", camera.position.toArray())
      prevPosition.current.copy(camera.position)
    }
  })

  return null
}

export const Raycaster = () => {
  const three = useThree()
  const { camera, scene, gl } = three
  const raycaster = useRef<THREE.Raycaster>(new THREE.Raycaster())
  const pointer = useRef<THREE.Vector2>(new THREE.Vector2())

  useFrame(() => {
    raycaster.current.setFromCamera(pointer.current, camera)
    const intersects = raycaster.current.intersectObjects(scene.children, true)

    if (intersects.length > 0) {
      console.log(intersects[0].object?.name)
    }
  })

  const handlePointerMove = (event: THREE.Event) => {
    if ("clientX" in event && "clientY" in event) {
      pointer.current.x =
        ((event.clientX as number) / window.innerWidth) * 2 - 1
      pointer.current.y =
        -((event.clientY as number) / window.innerHeight) * 2 + 1
    }
  }

  useEffect(() => {
    gl.domElement.addEventListener("pointermove", handlePointerMove)
    return () => {
      gl.domElement.removeEventListener("pointermove", handlePointerMove)
    }
  }, [gl.domElement])

  return null
}
