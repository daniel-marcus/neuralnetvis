import { Stats } from "@react-three/drei"
import { getThree, useGlobalStore } from "@/store"
import { useKeyCommand } from "@/utils/key-command"

// use for debug purposes

export const DebugUtils = () => {
  const isDebug = useGlobalStore((s) => s.isDebug)
  useKeyCommand("c", logCameraPos)
  if (!isDebug) return null
  return <Stats />
}

function logCameraPos() {
  const three = getThree()
  if (!three) return
  const { camera } = three
  console.log("Camera position:", camera.position.toArray(), camera)
}
