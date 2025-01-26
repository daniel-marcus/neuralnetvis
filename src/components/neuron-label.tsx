import { OUTPUT_ORIENT } from "@/lib/layer-layout"
import { useFrame, useThree, extend } from "@react-three/fiber"
import { useContext, useRef } from "react"
import { Mesh } from "three"
import { Text } from "troika-three-text"
import { NeuronDef, NeuronState } from "./neuron"
import { TrainingYContext } from "./app"

// https://r3f.docs.pmnd.rs/tutorials/typescript#extending-threeelements
class CustomText extends Text {}
extend({ CustomText })
declare module "@react-three/fiber" {
  interface ThreeElements {
    customText: unknown // Object3DNode<CustomText, typeof CustomText>
  }
}

const FONT_SIZE = 2.5

interface NeuronLabelsProps {
  neuron: NeuronDef & NeuronState
  position?: [number, number, number]
  color?: string
}

export function NeuronLabels({ neuron, position, color }: NeuronLabelsProps) {
  const { label, activation } = neuron
  const isClassification = true // TODO
  const showValueLabel = false
  const trainingY = useContext(TrainingYContext)
  const showPointer = !!trainingY && trainingY === neuron.index
  if (!position) return null
  return (
    <group>
      {!!label && (
        <NeuronLabel
          side={isClassification ? "right" : "left"}
          position={position}
          color={color}
        >
          {label}
        </NeuronLabel>
      )}
      {showValueLabel && (
        <NeuronLabel side={"right"} position={position} color={color}>
          {/* rawInput
            ? String(rawInput)
            : activation
            ? `${activation?.toFixed(0)} (predicted)\n${trainingY} (actual)`
            : "" */}
        </NeuronLabel>
      )}
      {showPointer && (
        <Pointer
          position={position}
          color={Number(activation) > 0.5 ? "rgb(0, 200, 80)" : "white"}
        />
      )}
    </group>
  )
}

interface NeuronLabelProps {
  position?: [number, number, number]
  side?: "left" | "right"
  color?: string
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

interface PointerProps {
  position: [number, number, number]
  color: string
}

export const Pointer = ({ position: [x, y, z], color }: PointerProps) => (
  <customText
    position={getPointerPos(x, y, z)}
    text={"☜"} // ·
    fontSize={1}
    color={color}
    anchorX="center"
    anchorY="middle"
    rotation={[0, -Math.PI / 2, 0]}
  />
)

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

function getPointerPos(x: number, y: number, z: number) {
  if (OUTPUT_ORIENT === "vertical")
    return [x, y - 0.1, z + 2.2] // [x, y, z + 2.5]
  else return [x, y + 5, z]
}
