import { useEffect } from "react"
import { useThree } from "@react-three/fiber"
import { useStore } from "@/store"
import { useLayers } from "@/neuron-layers"
import { Layer } from "./layer"
import { HoverConnections } from "./connections"
import { OrbitControls } from "three/examples/jsm/Addons.js"

export const Model = () => {
  const layers = useLayers()
  useThreeStoreSetter()
  return (
    <group>
      {layers.map((l) => (
        <Layer key={`${l.tfLayer.name}`} {...l} allLayers={layers} />
      ))}
      <HoverConnections />
    </group>
  )
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
