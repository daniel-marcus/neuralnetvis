import { useContext, useState, ReactElement } from "react"
import { Layer, LayerType } from "./sequential"
import { Connection } from "./connection"
import { OptionsContext } from "./model"
import { Text } from "@react-three/drei"

const LINE_ACTIVATION_THRESHOLD = 0.5
const LINE_WEIGHT_THRESHOLD = 0.1

export function Neuron(props: {
  type?: LayerType
  index: number
  position: [number, number, number]
  prevLayer?: Layer
  activation?: number
  normalizedActivation?: number
  weights?: number[]
  bias?: number
}) {
  const {
    index,
    position,
    type = "hidden",
    prevLayer,
    activation,
    normalizedActivation,
    weights,
    bias,
    ...otherProps
  } = props
  const [hovered, setHover] = useState(false)
  const [active, setActive] = useState(false)
  const geometry = geometryMap[type]
  const color =
    normalizedActivation !== undefined
      ? `rgb(${Math.ceil(normalizedActivation * 255)}, 20, 100)`
      : hovered
      ? "hotpink"
      : active
      ? "#1f4f80"
      : type === "input"
      ? "rgb(12, 12, 12)"
      : "#2f74c0"
  const { hideLines } = useContext(OptionsContext)
  const [x, y, z] = position
  return (
    <group>
      <mesh
        {...otherProps}
        position={position}
        userData={{ activation, bias }}
        scale={1}
        onClick={() => setActive(!active)}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        {geometry}
        <meshStandardMaterial color={color} />
      </mesh>
      {!!prevLayer && !hideLines && (
        <group>
          {prevLayer.props.positions?.map((prevPos, j) => {
            if (
              !hovered &&
              !active &&
              Number(normalizedActivation) < LINE_ACTIVATION_THRESHOLD
            )
              return null
            const weight = weights?.[j] ?? 0
            const input = prevLayer.props.activations?.[j] ?? 0
            if (Math.abs(weight) < LINE_WEIGHT_THRESHOLD) return null
            return (
              <Connection
                key={j}
                start={prevPos}
                end={position as [number, number, number]}
                weight={weight}
                input={input}
              />
            )
          })}
        </group>
      )}
      {type === "output" && position && (
        <Text
          position={[x, y + 3, z]}
          fontSize={4}
          color={color}
          anchorX="center"
          anchorY="middle"
          rotation={[0, -Math.PI / 2, 0]}
        >
          {index}
        </Text>
      )}
    </group>
  )
}

const geometryMap: Record<LayerType, ReactElement> = {
  input: <boxGeometry args={[0.6, 0.6, 0.6]} />,
  hidden: <sphereGeometry args={[0.6, 32, 32]} />,
  output: <boxGeometry args={[1.8, 1.8, 1.8]} />,
}
