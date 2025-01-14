import * as THREE from "three"
import React, { useState } from "react"
import { ThreeElements } from "@react-three/fiber"
import { Layer, LayerType } from "./sequential"
import { Connection } from "./connection"

const LINE_THRESHOLD = 0.7

export function Neuron(
  props: ThreeElements["mesh"] & {
    type?: LayerType
    prevLayer?: Layer
    activation?: number
    normalizedActivation?: number
    weights?: number[]
    bias?: number
  }
) {
  const {
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
  // TODO: normalizedValue
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
      {!!prevLayer &&
        (hovered ||
          active ||
          Number(normalizedActivation) >= LINE_THRESHOLD) && (
          <group>
            {prevLayer.props.positions?.map((prevPos, j) => {
              if (
                !prevLayer.props.input ||
                prevLayer.props.input[j] < LINE_THRESHOLD
              )
                return null
              return (
                <Connection
                  key={j}
                  start={new THREE.Vector3(...prevPos)}
                  end={
                    new THREE.Vector3(...(position as [number, number, number]))
                  }
                  weight={weights?.[j]}
                  input={prevLayer.props.input[j]}
                  bias={bias}
                />
              )
            })}
          </group>
        )}
    </group>
  )
}

const geometryMap: Record<LayerType, React.ReactElement> = {
  input: <boxGeometry args={[1, 1, 1]} />,
  hidden: <sphereGeometry args={[0.6, 32, 32]} />,
  output: <boxGeometry args={[2, 2, 2]} />,
}
