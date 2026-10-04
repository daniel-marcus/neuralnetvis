import { memo, Suspense, useMemo, useRef } from "react"
import * as THREE from "three/webgpu"
import { useFrame, useThree } from "@react-three/fiber"
import { useSceneStore } from "@/store"
import { round } from "@/data/utils"
import { useActivation } from "@/model/activations"
import { useRawInput } from "@/data/sample"
import { getIndex3d } from "@/neuron-layers/helpers"
import { text2Texture } from "./text-to-texture"
import { isSceneRendered } from "./utils"
import { hasAllGlyphs, textGeometry, useFont } from "./vector-text"
import type { Font } from "three/addons/loaders/FontLoader.js"
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
  return <NeuronLabel {...props} text={props.overrideText ?? label} side={side} />
}

function useLabelFromDs(layer: NeuronLayer, neuronIdx: number) {
  const ds = useSceneStore((s) => s.ds)
  return useMemo(() => {
    const index3d = getIndex3d(neuronIdx, layer.outputShape)
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

function NeuronLabel(props: NeuronLabelProps) {
  const { side = "right", position = [0, 0, 0], size = 1 } = props
  const zOffset = side === "right" ? 3 : -3
  const [x, y, z] = position
  const offsetPos = useMemo(
    () => [x, y, z + size * zOffset] as [number, number, number],
    [x, y, z, size, zOffset],
  )
  return <TextLabel {...props} position={offsetPos} lookAtCamera={true} />
}

export const TextLabel = memo(function TextLabel_(props: NeuronLabelProps) {
  const lightsOn = useSceneStore((s) => s.vis.lightsOn)
  if (!props.text || !lightsOn) return null
  return (
    <Suspense fallback={null}>
      <TextLabelContent {...props} text={props.text} />
    </Suspense>
  )
})

// vector text, sizes match the texture fallback (single line)
const FONT_SIZE = 0.8
const LINE_HEIGHT = 1

function TextLabelContent({
  text,
  position,
  side = "right",
  color = LABEL_COLOR,
  size = 1,
  lookAtCamera,
}: NeuronLabelProps & { text: string }) {
  const labelRef = useRef<THREE.Object3D>(null)

  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  useFrame(() => {
    if (!lookAtCamera || !isSceneRendered(scene)) return // e.g. offscreen tiles
    labelRef.current?.lookAt(camera.position)
  })

  const font = useFont()
  const align = side === "left" ? "right" : "left"
  const isVector = hasAllGlyphs(font, text) // fallback for emojis etc.
  return (
    <group position={position} rotation={[0, -Math.PI / 2, 0]} ref={labelRef} scale={size * 1.2}>
      {isVector ? (
        <VectorLabel font={font} text={text} align={align} color={color} />
      ) : (
        <TextureLabel text={text} align={align} color={color} />
      )}
    </group>
  )
}

interface LabelContentProps {
  text: string
  align: "left" | "right"
  color: string | THREE.Color
}

const geometryCache = new Map<string, THREE.BufferGeometry>()

function VectorLabel({ font, text, align, color }: LabelContentProps & { font: Font }) {
  const geometry = useMemo(() => {
    const key = `${text}-${align}`
    if (!geometryCache.has(key)) {
      const options = { fontSize: FONT_SIZE, lineHeight: LINE_HEIGHT, align }
      geometryCache.set(key, textGeometry(font, text, options))
    }
    return geometryCache.get(key)!
  }, [font, text, align])
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color={color} />
    </mesh>
  )
}

function TextureLabel({ text, align, color }: LabelContentProps) {
  const { texture, scale } = useMemo(
    () => text2Texture({ text, fontFace: "Menlo-Regular", align }),
    [text, align],
  )
  const anchorOffset = align === "right" ? -scale[0] / 2 : scale[0] / 2
  const anchorPos = [anchorOffset, 0, 0] as [number, number, number]
  // spriteNodeMaterial didn't work with sprite.center, so using meshBasicMaterial + camera lookAt
  return (
    <sprite position={anchorPos} scale={scale}>
      <meshBasicMaterial map={texture} transparent color={color} />
    </sprite>
  )
}
