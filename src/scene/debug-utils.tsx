import { useEffect, useRef } from "react"
import * as THREE from "three"
import { useThree, useFrame } from "@react-three/fiber"
import { Stats } from "@react-three/drei"
import { getThree, useStore } from "@/store"
import { useKeyCommand } from "@/utils/key-command"

// use for debug purposes

export const DebugUtils = () => {
  const isDebug = useStore((s) => s.isDebug)
  useKeyCommand("c", logCameraPos)
  if (!isDebug) return null
  return <Stats />
}

function logCameraPos() {
  const three = getThree()
  if (!three) return
  const { camera } = three
  console.log("Camera position:", camera.position.toArray())
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
