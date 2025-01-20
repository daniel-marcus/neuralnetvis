import { Text } from "@react-three/drei"
import { OUTPUT_ORIENT } from "./sequential"
import { useFrame, useThree } from "@react-three/fiber"
import { useRef } from "react"
import { Mesh } from "three"

const FONT_SIZE = 2.5

interface NeuronLabelProps {
  position?: [number, number, number]
  side?: "left" | "right"
  color?: string
  children?: React.ReactNode
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
    <Text
      ref={labelRef}
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
    >
      {children}
    </Text>
  )
}

interface DotProps {
  position: [number, number, number]
  color: string
}

export const Dot = ({ position: [x, y, z], color }: DotProps) => (
  <Text
    position={getDotPos(x, y, z)}
    fontSize={FONT_SIZE}
    color={color}
    anchorX="center"
    anchorY="middle"
    rotation={[0, -Math.PI / 2, 0]}
    characters="·"
  >
    ·
  </Text>
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

function getDotPos(x: number, y: number, z: number) {
  if (OUTPUT_ORIENT === "vertical") return [x, y, z + 2.5]
  else return [x, y + 5, z]
}
