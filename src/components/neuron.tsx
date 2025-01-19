import React, { useState, ReactElement, useEffect, useContext } from "react"
import { LayerProps, LayerType, OUTPUT_ORIENT } from "./sequential"
import { Connection } from "./connection"
import { Text } from "@react-three/drei"
import { useStatusText } from "./status-text"
import { OptionsContext, TrainingYContext } from "./model"
import { normalize } from "@/lib/datasets"

const LINE_ACTIVATION_THRESHOLD = 0.5
const LINE_WEIGHT_THRESHOLD = 0.8 // 0.1 // maybe use dynamic threshold based on max weight?

interface NeuronProps {
  index: number
  position: [number, number, number]
  layer: LayerProps
  prevLayer?: LayerProps
  rawInput?: number
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
    layer,
    prevLayer,
    rawInput,
    activation,
    normalizedActivation,
    weights,
    bias,
    label,
    ...otherProps
  } = props
  const [hovered, setHover] = useState(false)
  const geometry = getGeometry(layer.type, layer.units)
  const value = normalizedActivation ? Math.min(normalizedActivation, 1) : 0
  const color = `rgb(${Math.ceil(value * 255)}, 20, 100)`
  const [x, y, z] = position
  const { hideLines } = useContext(OptionsContext)
  const trainingY = useContext(TrainingYContext)
  useHoverStatus(hovered, index, rawInput, activation, bias, weights, prevLayer)
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
            const normalizedWeights = normalize(weights)
            const weight = normalizedWeights?.[j] ?? 0 // weights?.[j] ?? 0
            const input = prevLayer.normalizedActivations?.[j] ?? 0
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
      {(layer.type === "output" || !!label) && (
        <Text
          position={getTextPos(x, y, z, layer.type)}
          fontSize={3}
          color={color}
          anchorX={
            OUTPUT_ORIENT === "vertical"
              ? layer.type === "input"
                ? "right"
                : "left"
              : "center"
          }
          anchorY="middle"
          rotation={[0, -Math.PI / 2, 0]}
        >
          {label ??
            (activation ? `${activation?.toFixed(0)} vs. ${trainingY}` : "")}
        </Text>
      )}
      {layer.type === "input" && !!label && rawInput !== undefined && (
        <Text
          position={getTextPos(x, y, z, "output")} // show on the other side
          fontSize={3}
          color={color}
          anchorX={"left"}
          anchorY="middle"
          rotation={[0, -Math.PI / 2, 0]}
        >
          {rawInput}
        </Text>
      )}
      {layer.type === "output" && // TODO: show correct values for linear output (california housing)
        typeof trainingY === "number" &&
        trainingY === index && (
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

function getTextPos(x: number, y: number, z: number, layerType?: LayerType) {
  const factor = layerType === "output" ? 1 : -1
  if (OUTPUT_ORIENT === "vertical") return [x, y, z + 3.5 * factor]
  else return [x, y + 3, z]
}
function getDotPos(x: number, y: number, z: number) {
  if (OUTPUT_ORIENT === "vertical") return [x, y, z + 2.5]
  else return [x, y + 5, z]
}

const geometryMap: Record<string, ReactElement> = {
  boxSmall: <boxGeometry args={[0.6, 0.6, 0.6]} />,
  boxBig: <boxGeometry args={[1.8, 1.8, 1.8]} />,
  sphere: <sphereGeometry args={[0.6, 32, 32]} />,
}

function getGeometry(type: LayerType, units: number) {
  if (["input", "output"].includes(type)) {
    if (units <= 10) return geometryMap.boxBig
    return geometryMap.boxSmall
  }
  return geometryMap.sphere
}

function useHoverStatus(
  hovered: boolean,
  index: number,
  rawInput: number | undefined,
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
            .map((o) => `Neuron ${layerIndex - 1}_${o.i} (${o.w.toFixed(4)})`)
            .join("<br/>")}`
        : ""
      setStatusText(
        `<strong>Neuron ${layerIndex}_${index}</strong><br/><br/>
${rawInput !== undefined ? `Raw Input: ${rawInput}<br/>` : ""}
Activation: ${activation?.toFixed(4)}<br/>
${bias !== undefined ? `Bias: ${bias?.toFixed(4)}<br/>` : ""}
${weightsText}`
      )
      return () => {
        setStatusText("")
      }
    }
  }, [
    hovered,
    index,
    rawInput,
    activation,
    bias,
    layerIndex,
    weights,
    setStatusText,
  ])
}
