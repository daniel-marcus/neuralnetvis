import { useEffect } from "react"
import { useThree } from "@react-three/fiber"
import { useStore } from "@/store"
import { useLayers } from "@/neuron-layers"
import { Layer } from "./layer"
import { HoverConnections } from "./connections"

export const Model = () => {
  const layers = useLayers()
  useThreeStoreSetter()
  return (
    <group>
      {layers.map((l, i) => (
        <Layer key={i} {...l} allLayers={layers} />
      ))}
      <HoverConnections />
    </group>
  )
}

function useThreeStoreSetter() {
  // make three available outside of the render context
  const { camera, invalidate, gl } = useThree()
  useEffect(() => {
    const three = { camera, invalidate, gl }
    useStore.setState({ three })
  }, [camera, invalidate, gl])
  return null
}
