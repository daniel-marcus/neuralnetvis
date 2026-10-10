import { useEffect, useRef, useState } from "react"
import { useSceneStore } from "@/store"
import { maximizeActivation } from "@/model/feature-vis"
import { ViewerSlot } from "./viewer-slot"
import type { FeatureVis } from "@/model/feature-vis"
import type { NeuronStateful, Nid } from "@/neuron-layers/types"

const FEATURE_VIS_DELAY = 300 // ms, hovered neurons change quickly

function useFeatureVis(neuron: NeuronStateful, inputRange: [number, number]) {
  const model = useSceneStore((s) => s.model)
  const isTraining = useSceneStore((s) => s.isTraining)
  const [current, setCurrent] = useState<{ nid: Nid; featureVis: FeatureVis; progress: number }>()
  const { nid, index } = neuron
  const { tfLayer } = neuron.layer
  useEffect(() => {
    if (!model || isTraining) return // weights are changing
    let aborted = false
    const timeout = setTimeout(async () => {
      const featureVis = await maximizeActivation(model, tfLayer, index, {
        inputRange,
        shouldAbort: () => aborted,
        onProgress: (preview, progress) =>
          !aborted && setCurrent({ nid, featureVis: preview, progress }),
      })
      if (!featureVis || aborted) return
      setCurrent({ nid, featureVis, progress: 1 })
    }, FEATURE_VIS_DELAY)
    return () => {
      aborted = true
      clearTimeout(timeout)
    }
  }, [model, isTraining, nid, index, tfLayer, inputRange])
  return current?.nid === nid ? current : { featureVis: undefined, progress: 0 }
}

// generated input that activates the neuron the most, cropped to its receptive field
interface FeatureVisViewerProps {
  neuron: NeuronStateful
  inputRange: [number, number]
}

export const FeatureVisViewer = ({ neuron, inputRange }: FeatureVisViewerProps) => {
  const { featureVis, progress } = useFeatureVis(neuron, inputRange)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx || !featureVis) return
    const { data, shape, receptiveField: rf } = featureVis
    const [, width, channels] = shape
    canvas.width = rf.width
    canvas.height = rf.height
    const imageData = ctx.createImageData(rf.width, rf.height)
    for (let y = 0; y < rf.height; y++) {
      for (let x = 0; x < rf.width; x++) {
        const src = ((rf.y + y) * width + rf.x + x) * channels
        const dst = (y * rf.width + x) * 4
        for (let c = 0; c < 3; c++) {
          imageData.data[dst + c] = data[src + (channels === 1 ? 0 : c)] * 255
        }
        imageData.data[dst + 3] = 255
      }
    }
    ctx.putImageData(imageData, 0, 0)
  }, [featureVis])
  return (
    <ViewerSlot footer={progress < 1 && <AsciiProgress progress={progress} />}>
      {featureVis ? (
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain [image-rendering:pixelated]"
        />
      ) : (
        <Noise />
      )}
    </ViewerSlot>
  )
}

// as ProgressBar / Slider: clipped rows of block characters instead of measuring the available width
const AsciiProgress = ({ progress }: { progress: number }) => (
  <div
    className="absolute top-1 inset-x-0 overflow-hidden whitespace-nowrap leading-none select-none"
    role="progressbar"
    aria-valuenow={Math.round(progress * 100)}
  >
    {"░".repeat(100)}
    <span
      className="absolute top-0 left-0 overflow-hidden text-marker"
      style={{ width: `${progress * 100}%` }}
    >
      {"█".repeat(100)}
    </span>
  </div>
)

const NOISE_CHARS = "░░░▒▒▓"
const NOISE_SIZE = [30, 40] // rows, cols: more than fit into the slot, the rest is clipped
const NOISE_INTERVAL = 150 // ms

const getNoiseChar = () => NOISE_CHARS[Math.floor(Math.random() * NOISE_CHARS.length)]

function getNoise() {
  const [rows, cols] = NOISE_SIZE
  const getRow = () => Array.from({ length: cols }, getNoiseChar).join("")
  return Array.from({ length: rows }, getRow).join("\n")
}

// placeholder until the first preview: the image starts as noise
const Noise = () => {
  const [noise, setNoise] = useState(getNoise)
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const interval = setInterval(() => setNoise(getNoise()), NOISE_INTERVAL)
    return () => clearInterval(interval)
  }, [])
  return (
    <div
      className="w-full self-stretch overflow-hidden whitespace-pre leading-none select-none opacity-50"
      aria-hidden
    >
      {noise}
    </div>
  )
}
