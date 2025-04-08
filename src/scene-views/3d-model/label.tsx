import { useLayoutEffect, useRef } from "react"
import { useFrame, useThree, extend } from "@react-three/fiber"
import * as THREE from "three"
import { Text } from "troika-three-text"
import { useSceneStore } from "@/store"
import { OUTPUT_ORIENT } from "@/neuron-layers/layout"
import type { ThreeElement } from "@react-three/fiber"
import type { NeuronDef, NeuronState } from "@/neuron-layers/types"
import { round } from "@/data/utils"

// https://r3f.docs.pmnd.rs/tutorials/typescript#extending-threeelements
// https://github.com/pmndrs/react-three-fiber/releases/tag/v9.0.0
class CustomText extends Text {}
extend({ CustomText })
declare module "@react-three/fiber" {
  interface ThreeElements {
    customText: ThreeElement<typeof CustomText>
  }
}

const FONT_SIZE = 2
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
    <group>
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

export const NeuronLabel = ({
  position: [x, y, z] = [0, 0, 0],
  side = "right",
  color,
  size,
  children,
}: NeuronLabelProps) => {
  const labelRef = useRef<THREE.Object3D & CustomText>(null)
  const camera = useThree((s) => s.camera)
  useFrame(() => {
    if (labelRef.current) {
      labelRef.current.lookAt(camera.position)
    }
  })
  const invalidate = useThree(({ invalidate }) => invalidate)
  const lightsOn = useSceneStore((s) => s.vis.lightsOn)
  useLayoutEffect(() => {
    if (!labelRef.current) return
    labelRef.current.sync(() => {
      invalidate()
    })
  }, [labelRef, invalidate, children, lightsOn])
  if (!lightsOn) return null
  return (
    <customText
      ref={labelRef}
      text={children}
      position={getTextPos(x, y, z, side, size)}
      fontSize={size ?? FONT_SIZE}
      font={"/fonts/Menlo-Regular.woff"}
      color={color}
      anchorX={
        OUTPUT_ORIENT === "vertical"
          ? side === "left"
            ? "right"
            : "left"
          : "center"
      }
      anchorY="middle"
      rotation={[0, -Math.PI / 2, 0]}
    />
  )
}

function getTextPos(
  x: number,
  y: number,
  z: number,
  side: "left" | "right" = "right",
  size = 1
): [number, number, number] {
  const factor = side === "right" ? 1 : -1
  return OUTPUT_ORIENT === "vertical"
    ? [x, y, z + size * 3.5 * factor]
    : [x, y + 3, z]
}
