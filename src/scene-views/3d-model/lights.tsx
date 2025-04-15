import { useRef } from "react"
import { useGlobalStore, useSceneStore } from "@/store"
import { useKeyCommand } from "@/utils/key-command"
import { SpotLightHelper, type SpotLight } from "three"
import { useHelper } from "@react-three/drei"

export const Lights = () => {
  const ref1 = useRef<SpotLight>(null!)
  const isDebug = useGlobalStore((s) => s.isDebug)
  useHelper(isDebug && ref1, SpotLightHelper)
  const lightsOn = useSceneStore((s) => s.vis.lightsOn)
  const lightIntensity = useSceneStore((s) => s.vis.lightIntensity)
  const toggleLights = useSceneStore((s) => s.vis.toggleLights)
  useKeyCommand("L", toggleLights)
  return (
    <>
      <ambientLight intensity={Math.PI * 0.7} />
      <spotLight
        ref={ref1}
        position={[-500, 20, -20]}
        angle={Math.PI / 3}
        penumbra={1}
        decay={0}
        intensity={lightsOn ? lightIntensity * Math.PI : 0}
      />
      <spotLight
        position={[100, -20, 20]}
        angle={Math.PI / 3}
        penumbra={1}
        decay={0}
        intensity={(Math.PI / 3) * 2}
        // color="rgb(100,20,255)"
        color="#ff0000"
      />
    </>
  )
}
