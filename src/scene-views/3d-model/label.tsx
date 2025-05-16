import { memo, useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three/webgpu"
import { useFrame, useThree } from "@react-three/fiber"
import { useSceneStore } from "@/store"
import { round } from "@/data/utils"
import { useActivation } from "@/model/activations"
import { useRawInput } from "@/data/sample"
import { getIndex3d } from "@/neuron-layers/neurons"
import { text2Canvas } from "./text-to-canvas"
import type { NeuronLayer } from "@/neuron-layers/types"

export const LABEL_COLOR = "rgb(150, 156, 171)"

interface NeuronLabelsProps {
  neuronIdx: number
  layer: NeuronLayer
  position?: [number, number, number]
  size?: number
  label?: string
}

export function NeuronLabels(props: NeuronLabelsProps) {
  const layerPos = props.layer.layerPos
  const isRegression = useSceneStore((s) => s.isRegression())
  const label = useLabelFromDs(props.layer, props.neuronIdx)
  if (isRegression) {
    const Comp = layerPos === "input" ? InputValueLabel : OutputValueLabel
    return <Comp {...props} label={label} />
  }
  const side = layerPos === "input" ? "left" : "right"
  return <NeuronLabel {...props} text={label} side={side} />
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
  let text = `${props.label}\n ${round(activation)} (predicted)`
  if (typeof trainingY === "number") text += `\n${round(trainingY)} (actual)`
  return <NeuronLabel side="right" {...props} text={text} />
}

interface NeuronLabelProps {
  text?: string
  position?: [number, number, number]
  side?: "left" | "right"
  color?: string
  size?: number
  lookAtCamera?: boolean
}

interface LabelState {
  texture: THREE.CanvasTexture
  scale: [number, number, number]
  anchorPos: [number, number, number]
}

function NeuronLabel(props: NeuronLabelProps) {
  const { side, position = [0, 0, 0], size = 1 } = props
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
  const [canvas, setCanvas] = useState<HTMLCanvasElement | undefined>()
  useEffect(() => {
    const canvas = document.createElement("canvas")
    setCanvas(canvas)
  }, [])
  useEffect(() => {
    if (!text || !canvas) return
    const align = side === "left" ? "right" : "left"
    const fontFace = "Menlo-Regular"
    const [, numLines] = text2Canvas({ text, fontFace, color, align, canvas })
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.generateMipmaps = false
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.anisotropy = 1
    const yScale = numLines
    const xScale = (canvas.width / canvas.height) * yScale
    const scale = [xScale, yScale, 0] as [number, number, number]
    const anchorOffset = side === "left" ? -xScale / 2 : xScale / 2
    const anchorPos = [anchorOffset, 0, 0] as [number, number, number]
    setLabelState({ texture, scale, anchorPos })
  }, [text, color, side, canvas])

  const lightsOn = useSceneStore((s) => s.vis.lightsOn)
  if (!text || !labelState || !lightsOn) return null
  const { texture, scale, anchorPos } = labelState

  // spriteNodeMaterial didn't work with sprite.center, so using meshBasicMaterial + camera lookAt
  return (
    <group
      position={position}
      rotation={[0, -Math.PI / 2, 0]}
      ref={labelRef}
      scale={size}
    >
      <sprite ref={labelRef} position={anchorPos} scale={scale}>
        <meshBasicMaterial map={texture} transparent />
      </sprite>
    </group>
  )
})
