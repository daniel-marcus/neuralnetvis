import { useLayoutEffect, useRef } from "react"
import { useFrame, useThree, extend } from "@react-three/fiber"
import * as THREE from "three"
import { Text } from "troika-three-text"
import { useStore } from "@/store"
import { OUTPUT_ORIENT } from "@/neuron-layers/layout"
import type { NeuronDef, NeuronState } from "@/neuron-layers/types"

// https://r3f.docs.pmnd.rs/tutorials/typescript#extending-threeelements
class CustomText extends Text {}
extend({ CustomText })
declare module "@react-three/fiber" {
  interface ThreeElements {
    customText: unknown // Object3DNode<CustomText, typeof CustomText>
  }
}

const FONT_SIZE = 2
const LABEL_COLOR = "rgb(140, 146, 164)"

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
          size={isRegression ? 1 : FONT_SIZE}
          color={isRegression ? LABEL_COLOR : neuron.color.three}
        >
          {label}
        </NeuronLabel>
      )}
      {showValueLabel && (
        <NeuronLabel
          side={"right"}
          position={position}
          size={isRegression ? 1 : FONT_SIZE}
          color={isRegression ? LABEL_COLOR : neuron.color.three}
        >
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
  const labelRef = useRef<THREE.Mesh & { sync: (cb: () => void) => void }>(null)
  const camera = useThree((state) => state.camera)
  useFrame(() => {
    if (labelRef.current) {
      labelRef.current.lookAt(camera.position)
    }
  })
  const invalidate = useThree(({ invalidate }) => invalidate)
  useLayoutEffect(() => {
    if (!labelRef.current) return
    labelRef.current.sync(() => {
      invalidate()
    })
  }, [labelRef, children, invalidate])

  return (
    <customText
      ref={labelRef}
      text={children}
      position={getTextPos(x, y, z, side)}
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
  side: "left" | "right" = "right"
): [number, number, number] {
  const factor = side === "right" ? 1 : -1
  return OUTPUT_ORIENT === "vertical" ? [x, y, z + 3.5 * factor] : [x, y + 3, z]
}
