import React, { useState, ReactElement, useEffect, useContext } from "react"
import { LayerProps, LayerType, OUTPUT_ORIENT } from "./sequential"
import { Connection } from "./connection"
import { Text } from "@react-three/drei"
import { useStatusText } from "./status-text"
import { OptionsContext, TrainingLabelContext } from "./model"

const LINE_ACTIVATION_THRESHOLD = 0.5
const LINE_WEIGHT_THRESHOLD = 0.1 // maybe use dynamic threshold based on max weight?

interface NeuronProps {
  type?: LayerType
  index: number
  position: [number, number, number]
  prevLayer?: LayerProps
  activation?: number
  normalizedActivation?: number
  weights?: number[]
  bias?: number
  label?: string
}

export function Neuron(props: NeuronProps) {
  const {
    index,
    position,
    type = "hidden",
    prevLayer,
    activation,
    normalizedActivation,
    weights,
    bias,
    label,
    ...otherProps
  } = props
  const [hovered, setHover] = useState(false)
  const geometry = geometryMap[type]
  const value = normalizedActivation ?? 0
  const color = `rgb(${Math.ceil(value * 255)}, 20, 100)`
  const [x, y, z] = position
  const { hideLines } = useContext(OptionsContext)
  const trainingLabel = useContext(TrainingLabelContext)
  useHoverStatus(hovered, index, activation, bias, weights, prevLayer)
  return (
    <group>
      <mesh
        {...otherProps}
        position={position}
        userData={{ activation, bias }}
        scale={1}
        onPointerOver={(e) => {
          if (e.buttons) return
          setHover(true)
        }}
        onPointerOut={() => setHover(false)}
      >
        {geometry}
        <meshStandardMaterial color={color} />
      </mesh>
      {!!prevLayer && !hideLines && (
        <group>
          {prevLayer.positions?.map((prevPos, j) => {
            if (
              !hovered &&
              Number(normalizedActivation) < LINE_ACTIVATION_THRESHOLD
            )
              return null
            const weight = weights?.[j] ?? 0
            const input = prevLayer.activations?.[j] ?? 0
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
          position={getTextPos(x, y, z)}
          fontSize={3}
          color={color}
          anchorX={OUTPUT_ORIENT === "vertical" ? "left" : "center"}
          anchorY="middle"
          rotation={[0, -Math.PI / 2, 0]}
        >
          {label ?? index}
        </Text>
      )}
      {type === "output" &&
        typeof trainingLabel === "number" &&
        trainingLabel === index && (
          <Text
            position={getDotPos(x, y, z)}
            fontSize={3}
            color={Number(activation) > 0.5 ? "rgb(0, 200, 80)" : "white"}
            anchorX="center"
            anchorY="middle"
            rotation={[0, -Math.PI / 2, 0]}
          >
            ·
          </Text>
        )}
    </group>
  )
}

function getTextPos(x: number, y: number, z: number) {
  if (OUTPUT_ORIENT === "vertical") return [x, y, z + 3.5]
  else return [x, y + 3, z]
}
function getDotPos(x: number, y: number, z: number) {
  if (OUTPUT_ORIENT === "vertical") return [x, y, z + 2.5]
  else return [x, y + 5, z]
}

const geometryMap: Record<LayerType, ReactElement> = {
  input: <boxGeometry args={[0.6, 0.6, 0.6]} />,
  hidden: <sphereGeometry args={[0.6, 32, 32]} />,
  output: <boxGeometry args={[1.8, 1.8, 1.8]} />,
}

function useHoverStatus(
  hovered: boolean,
  index: number,
  activation: number | undefined,
  bias: number | undefined,
  weights: number[] | undefined,
  prevLayer: LayerProps | undefined
) {
  const setStatusText = useStatusText((s) => s.setStatusText)
  const layerIndex = (prevLayer?.index ?? -1) + 1
  useEffect(() => {
    if (hovered) {
      const weightObjects = weights?.map((w, i) => ({ w, i }))
      const strongestWeights = weightObjects
        ?.filter((o) => Math.abs(o.w) > LINE_WEIGHT_THRESHOLD)
        .toSorted((a, b) => Math.abs(b.w) - Math.abs(a.w))
        .slice(0, 5)
      const weightsText = strongestWeights?.length
        ? `<br/>Top weights:<br/>${strongestWeights
            .map((o) => `Neuron ${layerIndex - 1}_${o.i} (${o.w})`)
            .join("<br/>")}`
        : ""
      setStatusText(
        `<strong>Neuron ${layerIndex}_${index}</strong><br/><br/>
Activation: ${activation}<br/>
Bias: ${bias}<br/>
${weightsText}`
      )
      return () => {
        setStatusText("")
      }
    }
  }, [hovered, index, activation, bias, layerIndex, weights, setStatusText])
}
