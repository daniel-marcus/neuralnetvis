import { memo, useLayoutEffect, useRef } from "react"
import { useFrame, useThree, extend } from "@react-three/fiber"
import * as THREE from "three"
import { Text } from "troika-three-text"
import { useSceneStore } from "@/store"
import { round } from "@/data/utils"
import type { ThreeElement } from "@react-three/fiber"
import type { NeuronDef, NeuronState } from "@/neuron-layers/types"

// https://r3f.docs.pmnd.rs/tutorials/typescript#extending-threeelements
// https://github.com/pmndrs/react-three-fiber/releases/tag/v9.0.0
class CustomText extends Text {}
extend({ CustomText })
declare module "@react-three/fiber" {
  interface ThreeElements {
    customText: ThreeElement<typeof CustomText>
  }
}

export const LABEL_COLOR = "rgb(150, 156, 171)"

interface NeuronLabelsProps {
  neuron: NeuronDef & NeuronState
  position?: [number, number, number]
}

export function NeuronLabels({ neuron, position }: NeuronLabelsProps) {
  const { label, rawInput, activation } = neuron
  const trainingY = useSceneStore((s) => s.sample?.y)
  const isRegression = useSceneStore((s) => s.isRegression())
  const showValueLabel =
    !!label && typeof rawInput !== "undefined" && isRegression
  const layerPos = neuron.layer.layerPos
  if (!label || !position) return null
  return (
    <group renderOrder={-1}>
      <NeuronLabel
        side={layerPos === "input" ? "left" : "right"}
        position={position}
        size={neuron.layer.meshParams.labelSize ?? 1}
        color={LABEL_COLOR}
      >
        {layerPos === "output" && isRegression
          ? `${label}\n${round(activation)} (predicted)\n${round(
              trainingY
            )} (actual)`
          : label}
      </NeuronLabel>
      {showValueLabel && (
        <NeuronLabel
          side={"right"}
          position={position}
          size={neuron.layer.meshParams.labelSize ?? 1}
          color={LABEL_COLOR}
        >
          {round(rawInput)}
        </NeuronLabel>
      )}
    </group>
  )
}

interface NeuronLabelProps {
  position?: [number, number, number]
  side?: "left" | "right"
  color?: THREE.Color | string
  children?: string | number // React.ReactNode
  size?: number
}

// reference: https://github.com/pmndrs/drei/blob/master/src/core/Text.tsx

export const NeuronLabel = memo(function NeuronLabel({
  position: [x, y, z] = [0, 0, 0],
  side = "right",
  color,
  size,
  children,
}: NeuronLabelProps) {
  const labelRef = useRef<THREE.Object3D & CustomText>(null)
  const camera = useThree((s) => s.camera)
  const invalidate = useThree((s) => s.invalidate)
  useFrame(() => labelRef.current?.lookAt(camera.position))
  const lightsOn = useSceneStore((s) => s.vis.lightsOn)
  useLayoutEffect(() => {
    labelRef.current?.sync(invalidate)
  }, [labelRef, invalidate, children, lightsOn])
  if (!lightsOn) return null
  return (
    <customText
      ref={labelRef}
      text={children}
      position={getTextPos(x, y, z, side, size)}
      fontSize={size ?? 1}
      font={"/fonts/Menlo-Regular.woff"}
      color={color}
      anchorX={side === "left" ? "right" : "left"}
      anchorY="middle"
      rotation={[0, -Math.PI / 2, 0]}
    />
  )
})

function getTextPos(
  x: number,
  y: number,
  z: number,
  side: "left" | "right" = "right",
  size = 1
): [number, number, number] {
  const factor = side === "right" ? 1 : -1
  return [x, y, z + size * 3.5 * factor]
}
