import { useRef } from "react"
import { useGlobalStore, useSceneStore } from "@/store"
import { useKeyCommand } from "@/utils/key-command"
import { SpotLightHelper, type SpotLight } from "three/webgpu"
import { useHelper } from "@react-three/drei"

export const Lights = () => {
  const ref1 = useRef<SpotLight>(null!)
  const ref2 = useRef<SpotLight>(null!)
  const isDebug = useGlobalStore((s) => s.isDebug)
  useHelper(isDebug && ref1, SpotLightHelper)
  useHelper(isDebug && ref2, SpotLightHelper)
  const lightsOn = useSceneStore((s) => s.vis.lightsOn)
  const lightIntensity = useSceneStore((s) => s.vis.lightIntensity)
  const toggleLights = useSceneStore((s) => s.vis.toggleLights)
  useKeyCommand("L", toggleLights)
  return (
    <>
      <ambientLight
        intensity={Math.PI * 0.7} // 1
      />
      <spotLight
        ref={ref1}
        position={[-1500, 20, -20]}
        angle={Math.PI / 3}
        penumbra={1}
        decay={0}
        intensity={lightsOn ? lightIntensity * Math.PI : 0}
      />
      <spotLight
        ref={ref2}
        position={[1500, -20, 20]}
        angle={Math.PI / 3}
        penumbra={1}
        decay={0}
        intensity={Math.PI * 0.9}
        color="#ffcc99"
      />
    </>
  )
}
