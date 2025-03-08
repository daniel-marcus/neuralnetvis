import { useRef } from "react"
import { useSceneStore } from "@/store"
import { useKeyCommand } from "@/utils/key-command"
import type { SpotLight } from "three"

export const Lights = () => {
  const ref1 = useRef<SpotLight>(null!)
  // useHelper(ref1, SpotLightHelper)
  const lightsOn = useSceneStore((s) => s.vis.lightsOn)
  const lightIntensity = useSceneStore((s) => s.vis.lightIntensity)
  const toggleLights = useSceneStore((s) => s.vis.toggleLights)
  useKeyCommand("L", toggleLights)
  return (
    <>
      <ambientLight intensity={Math.PI * 0.7} />
      <spotLight
        ref={ref1}
        position={[-100, 20, -20]}
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
