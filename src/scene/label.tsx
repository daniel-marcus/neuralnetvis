import { useRef } from "react"
import { useFrame, useThree, extend } from "@react-three/fiber"
import { Color, Mesh } from "three"
import { Text } from "troika-three-text"
import { OUTPUT_ORIENT } from "@/neuron-layers/layout"
import type { NeuronDef, NeuronState } from "@/neuron-layers/types"
import { useStore } from "@/store"

// https://r3f.docs.pmnd.rs/tutorials/typescript#extending-threeelements
class CustomText extends Text {}
extend({ CustomText })
declare module "@react-three/fiber" {
  interface ThreeElements {
    customText: unknown // Object3DNode<CustomText, typeof CustomText>
  }
}

const FONT_SIZE = 2

interface NeuronLabelsProps {
  neuron: NeuronDef & NeuronState
  position?: [number, number, number]
}

export function NeuronLabels({ neuron, position }: NeuronLabelsProps) {
  const { label, rawInput, activation } = neuron
  const trainingY = useStore((s) => s.sample?.y)
  const isRegression = useStore((s) => s.isRegression())
  const showValueLabel = !!label && isRegression
  if (!position) return null
  return (
    <group>
      {!!label && (
        <NeuronLabel
          side={isRegression ? "left" : "right"}
          position={position}
          color={neuron.color}
        >
          {label}
        </NeuronLabel>
      )}
      {showValueLabel && (
        <NeuronLabel side={"right"} position={position} color={neuron.color}>
          {rawInput
            ? String(Math.round(rawInput * 100) / 100)
            : activation
            ? `${activation?.toFixed(0)} (predicted)\n${trainingY} (actual)`
            : ""}
        </NeuronLabel>
      )}
    </group>
  )
}

interface NeuronLabelProps {
  position?: [number, number, number]
  side?: "left" | "right"
  color?: Color
  children?: string | number // React.ReactNode
}

export const NeuronLabel = ({
  position: [x, y, z] = [0, 0, 0],
  side = "right",
  color,
  children,
}: NeuronLabelProps) => {
  const labelRef = useRef<Mesh>(null)
  const camera = useThree((state) => state.camera)
  useFrame(() => {
    if (labelRef.current) {
      labelRef.current.lookAt(camera.position)
    }
  })

  return (
    <customText
      ref={labelRef}
      text={children}
      position={getTextPos(x, y, z, side)}
      fontSize={FONT_SIZE}
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
  side: "left" | "right" = "right"
) {
  const factor = side === "right" ? 1 : -1
  if (OUTPUT_ORIENT === "vertical") return [x, y, z + 3.5 * factor]
  else return [x, y + 3, z]
}
