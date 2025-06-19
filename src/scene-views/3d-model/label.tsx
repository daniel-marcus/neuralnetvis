import { memo, useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three/webgpu"
import { useFrame, useThree } from "@react-three/fiber"
import { useSceneStore } from "@/store"
import { round } from "@/data/utils"
import { useActivation } from "@/model/activations"
import { useRawInput } from "@/data/sample"
import { getIndex3d } from "@/neuron-layers/neurons"
import { text2Texture } from "./text-to-texture"
import type { NeuronLayer } from "@/neuron-layers/types"

export const LABEL_COLOR = new THREE.Color("rgb(150, 156, 171)")

interface NeuronLabelsProps {
  neuronIdx: number
  layer: NeuronLayer
  position?: [number, number, number]
  size?: number
  label?: string
  overrideText?: string
}

export function NeuronLabels(props: NeuronLabelsProps) {
  const layerPos = props.layer.layerPos
  const isRegression = useSceneStore((s) => s.isRegression())
  const label = useLabelFromDs(props.layer, props.neuronIdx)
  const decodeInput = useSceneStore((s) => !!s.ds?.tokenizer)
  if (isRegression) {
    const Comp = layerPos === "input" ? InputValueLabel : OutputValueLabel
    return <Comp {...props} label={label} />
  }
  if (layerPos === "input" && !!decodeInput) {
    return <DecodedInputLabel {...props} label={label} />
  }
  const side = layerPos === "input" ? "left" : "right"
  return (
    <NeuronLabel {...props} text={props.overrideText ?? label} side={side} />
  )
}

function useLabelFromDs(layer: NeuronLayer, neuronIdx: number) {
  const ds = useSceneStore((s) => s.ds)
  return useMemo(() => {
    const index3d = getIndex3d(neuronIdx, layer.tfLayer.outputShape as number[])
    return layer.layerPos === "input" && index3d[1] === 0 && index3d[2] === 0
      ? ds?.inputLabels?.[index3d[0]]
      : layer.layerPos === "output"
      ? ds?.outputLabels?.[neuronIdx]
      : undefined
  }, [layer, neuronIdx, ds])
}

function DecodedInputLabel(props: NeuronLabelsProps) {
  const rawInput = useRawInput(props.layer.index, props.neuronIdx)
  const decodeFunc = useSceneStore((s) => s.ds?.tokenizer?.decode)
  if (typeof rawInput !== "number" || !decodeFunc) return null
  const decoded = decodeFunc(rawInput)
  return <NeuronLabel {...props} text={decoded} />
}

function InputValueLabel(props: NeuronLabelsProps) {
  const rawInput = useRawInput(props.layer.index, props.neuronIdx)
  if (typeof rawInput !== "number") return null
  return (
    <group>
      <NeuronLabel side="left" {...props} text={props.label} />
      <NeuronLabel {...props} text={`${round(rawInput)}`} />
    </group>
  )
}

function OutputValueLabel(props: NeuronLabelsProps) {
  const activation = useActivation(props.layer.index, props.neuronIdx)
  const trainingY = useSceneStore((s) => s.sample?.y)
  if (typeof activation !== "number") return null
  let text = `${props.label}\n${round(activation)} (predicted)`
  if (typeof trainingY === "number") text += `\n${round(trainingY)} (actual)`
  return <NeuronLabel side="right" {...props} text={text} />
}

interface NeuronLabelProps {
  text?: string
  position?: [number, number, number]
  side?: "left" | "right"
  color?: string | THREE.Color
  size?: number
  lookAtCamera?: boolean
}

interface LabelState {
  texture: THREE.CanvasTexture
  scale: [number, number, number]
  anchorPos: [number, number, number]
}

function NeuronLabel(props: NeuronLabelProps) {
  const { side = "right", position = [0, 0, 0], size = 1 } = props
  const zOffset = side === "right" ? 3 : -3
  const [x, y, z] = position
  const offsetPos = useMemo(
    () => [x, y, z + size * zOffset] as [number, number, number],
    [x, y, z, size, zOffset]
  )
  return <TextLabel {...props} position={offsetPos} lookAtCamera={true} />
}

export const TextLabel = memo(function NeuronLabel({
  text,
  position,
  side = "right",
  color = LABEL_COLOR,
  size = 1,
  lookAtCamera,
}: NeuronLabelProps) {
  const labelRef = useRef<THREE.Object3D>(null)

  const camera = useThree((s) => s.camera)
  useFrame(() => lookAtCamera && labelRef.current?.lookAt(camera.position))

  const [labelState, setLabelState] = useState<LabelState | undefined>()
  useEffect(() => {
    if (!text) return
    const align = side === "left" ? "right" : "left"
    const fontFace = "Menlo-Regular"
    const { texture, scale } = text2Texture({ text, fontFace, align })
    const anchorOffset = side === "left" ? -scale[0] / 2 : scale[0] / 2
    const anchorPos = [anchorOffset, 0, 0] as [number, number, number]
    setLabelState({ texture, scale, anchorPos })
  }, [text, side])

  const lightsOn = useSceneStore((s) => s.vis.lightsOn)
  if (!text || !labelState || !lightsOn) return null
  const { texture, scale, anchorPos } = labelState

  // spriteNodeMaterial didn't work with sprite.center, so using meshBasicMaterial + camera lookAt
  return (
    <group
      position={position}
      rotation={[0, -Math.PI / 2, 0]}
      ref={labelRef}
      scale={size * 1.2}
    >
      <sprite ref={labelRef} position={anchorPos} scale={scale}>
        <meshBasicMaterial map={texture} transparent color={color} />
      </sprite>
    </group>
  )
})
