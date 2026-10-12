import type { RefObject } from "react"
import type * as THREE from "three/webgpu"
import { useSceneStore } from "@/store"
import { useSize } from "./utils"
import { LABEL_COLOR, TextLabel } from "./label"
import type { NeuronLayer } from "@/neuron-layers/types"

const LAYER_LABEL_COLOR = LABEL_COLOR.clone().multiplyScalar(0.6)
const LAYER_LABEL_SIZE = 1.5

type LayerLabelProps = Pick<NeuronLayer, "index" | "layerType"> & {
  measureRef: RefObject<THREE.Mesh | null>
}

// the type of the hovered or focussed layer as label above its top right corner
export function LayerLabel({ index, layerType, measureRef }: LayerLabelProps) {
  const isActive = useSceneStore((s) => s.hoveredLayerIdx === index || s.focussedLayerIdx === index)
  // measured when the layer is mounted: later it might be scaled down (other layer focussed)
  const [, height, width] = useSize(measureRef)
  if (!isActive || !height) return null
  return (
    <TextLabel
      text={layerType}
      position={[0, height / 2 + LAYER_LABEL_SIZE, width / 2]}
      side="left" // ends at the corner
      size={LAYER_LABEL_SIZE}
      color={LAYER_LABEL_COLOR}
      doubleSided
    />
  )
}
