import { useEffect, useMemo, useRef, useState } from "react"
import { SphereGeometry } from "three/webgpu"
import { useGlobalStore, useSceneStore } from "@/store"
import { useHovered, useSelected } from "@/neuron-layers/neurons"
import { normalizeWithSign } from "@/data/utils"
import { getActColor } from "@/utils/colors"
import { isScreen } from "@/utils/screen"
import { Table } from "@/components/ui-elements"
import { useHasLesson } from "@/components/lesson"
import { maximizeActivation, supportsFeatureVis } from "@/model/feature-vis"
import { imageInputRanges } from "@/data/preprocess"
import type { LayersModel } from "@tensorflow/tfjs"
import type { FeatureVis } from "@/model/feature-vis"
import type { NeuronStateful, Nid } from "@/neuron-layers/types"

export const NeuronStatus = () => {
  const _hovered = useHovered()
  const _selected = useSelected()
  const selected = _hovered ?? _selected
  const toggleSelected = useSceneStore((s) => s.toggleSelected)
  const hasStatus = !!useGlobalStore((s) => s.status.getCurrent())
  const hasLesson = useHasLesson()
  const visLocked = useSceneStore((s) => s.vis.isLocked)
  const model = useSceneStore((s) => s.model)
  const preprocessFunc = useSceneStore((s) => s.ds?.preprocessFunc)
  const [showFeatureVis, setShowFeatureVis] = useState(false)
  const handleClick = (e: React.MouseEvent) => {
    if ("tagName" in e.target && e.target.tagName === "BUTTON") return
    toggleSelected(undefined)
  }
  if (!selected || (hasLesson && visLocked)) return null
  const inputRange = preprocessFunc && imageInputRanges[preprocessFunc]
  const hasFeatureVis = !!model && !!inputRange && supportsFeatureVis(model, selected.layer.tfLayer)
  return (
    <div
      className={`p-main flex gap-4 items-end sm:flex-col ${
        hasStatus ? "hidden sm:flex" : ""
      } pointer-events-auto active:brightness-120`}
      onClick={handleClick}
    >
      {hasFeatureVis && showFeatureVis ? (
        <FeatureVisViewer neuron={selected} inputRange={inputRange} />
      ) : (
        <WeightsViewer neuron={selected} />
      )}
      {hasFeatureVis && (
        <button onClick={() => setShowFeatureVis((v) => !v)}>
          {showFeatureVis ? "show weights" : "show preferred input"}
        </button>
      )}
      <NeuronInfo neuron={selected} />
    </div>
  )
}

const NeuronInfo = ({ neuron }: { neuron: NeuronStateful }) => {
  const { index3d, activation, bias, weights, rawInput } = neuron
  const data = {
    Neuron: `${neuron.layer.index}_${index3d.join(".")}`,
    Weights: weights?.length,
    Bias: bias?.toFixed(2),
    Activation: activation?.toFixed(2),
    "Raw input": rawInput?.toFixed(2),
  }
  return (
    <div className="w-full">
      <Table data={data} />
    </div>
  )
}

const GRID_STYLE = {
  "--grid-width": "calc(4 * 1em * 1.5 - 0.6em)",
  "--grid-width-sm": "199px",
} as React.CSSProperties

const FEATURE_VIS_DELAY = 300 // ms, hovered neurons change quickly

// reset when the weights change (training)
const featureVisCache = new WeakMap<LayersModel, Map<Nid, FeatureVis>>()

function useFeatureVis(neuron: NeuronStateful, inputRange: [number, number]) {
  const model = useSceneStore((s) => s.model)
  const isTraining = useSceneStore((s) => s.isTraining)
  const [current, setCurrent] = useState<{ nid: Nid; featureVis: FeatureVis }>()
  const { nid, index } = neuron
  const { tfLayer } = neuron.layer
  useEffect(() => {
    if (!model) return
    if (isTraining) {
      featureVisCache.delete(model)
      return
    }
    if (featureVisCache.get(model)?.has(nid)) return
    let aborted = false
    const timeout = setTimeout(async () => {
      const featureVis = await maximizeActivation(model, tfLayer, index, {
        inputRange,
        shouldAbort: () => aborted,
        onProgress: (preview) => !aborted && setCurrent({ nid, featureVis: preview }),
      })
      if (!featureVis || aborted) return
      if (!featureVisCache.has(model)) featureVisCache.set(model, new Map())
      featureVisCache.get(model)!.set(nid, featureVis)
      setCurrent({ nid, featureVis })
    }, FEATURE_VIS_DELAY)
    return () => {
      aborted = true
      clearTimeout(timeout)
    }
  }, [model, isTraining, nid, index, tfLayer, inputRange])
  const cached = model ? featureVisCache.get(model)?.get(nid) : undefined
  return cached ?? (current?.nid === nid ? current.featureVis : undefined)
}

// generated input that activates the neuron the most, cropped to its receptive field
interface FeatureVisViewerProps {
  neuron: NeuronStateful
  inputRange: [number, number]
}

const FeatureVisViewer = ({ neuron, inputRange }: FeatureVisViewerProps) => {
  const featureVis = useFeatureVis(neuron, inputRange)
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
    <div className="shrink-0 w-(--grid-width) sm:w-(--grid-width-sm) mb-[0.3em]" style={GRID_STYLE}>
      {featureVis ? (
        <canvas ref={canvasRef} className="w-full [image-rendering:pixelated]" />
      ) : (
        <div className="aspect-square flex items-center justify-center">…</div>
      )}
    </div>
  )
}

const WeightsViewer = ({ neuron }: { neuron: NeuronStateful }) => {
  const [currGroup, setCurrGroup] = useState(0)
  const highlightProp = useGlobalStore((s) => s.scene?.getState().vis?.highlightProp)
  const isScreenSm = isScreen("sm")

  const { prevLayer } = neuron.layer

  // normalize in group?
  const weights = useMemo(() => normalizeWithSign(neuron.weights) ?? [], [neuron])

  if (!neuron.weights?.length || !prevLayer) return null
  if (highlightProp === "weights") return null // will be duplication

  const prevShape = prevLayer.tfLayer.outputShape as number[]
  const [, prevHeight, prevWidth, groupCount = 1] = prevShape
  const kernelSize = neuron.layer.tfLayer.getConfig().kernelSize
  const sqr = Math.ceil(Math.sqrt(weights.length))
  const [rows, cols] = Array.isArray(kernelSize)
    ? (kernelSize as number[])
    : prevWidth
      ? [prevHeight, prevWidth]
      : [sqr, sqr] // 1D Dense to square
  const isRounded = prevLayer.meshParams.geometry instanceof SphereGeometry

  const prev = () => setCurrGroup((g) => (g - 1 + groupCount) % groupCount)
  const next = () => setCurrGroup((g) => (g + 1) % groupCount)
  const maxGroupsPerView = isScreenSm ? 16 : 4
  const needsShifter = groupCount > maxGroupsPerView
  return (
    <div
      className="shrink-0 w-(--grid-width) sm:w-(--grid-width-sm) overflow-hidden mb-[0.3em]"
      style={GRID_STYLE}
    >
      <div className={`${needsShifter ? "block" : "hidden"} flex justify-center gap-4`}>
        <button disabled={currGroup === 0} className={"disabled:opacity-0"} onClick={prev}>
          &lt;
        </button>
        <div>{currGroup + 1}</div>
        <button
          disabled={currGroup === groupCount - 1}
          className={"disabled:opacity-0"}
          onClick={next}
        >
          &gt;
        </button>
      </div>
      <div
        className={`grid ${
          needsShifter
            ? "grid-cols-(--cols-shifted) sm:grid-cols-(--cols-shifted-sm) translate-x-(--current-shift)"
            : "grid-cols-(--cols-all)"
        } gap-2 transition-transform duration-100 ease-in-out`}
        style={
          {
            "--cols-shifted": `repeat(${groupCount}, var(--grid-width))`,
            "--cols-shifted-sm": `repeat(${groupCount}, var(--grid-width-sm))`,
            "--cols-all": `repeat(${Math.ceil(Math.sqrt(groupCount))}, 1fr)`,
            "--current-shift": `translateX(calc(-${currGroup * 100}% - ${currGroup}*0.5rem))`,
          } as React.CSSProperties
        }
      >
        {Array.from({ length: groupCount }).map((_, i) => {
          const groupWeights = weights.filter((_weight, j) => j % groupCount === i)
          const isInView = needsShifter ? i === currGroup : true
          if (!isInView) return null
          return (
            <WeightsGridCanvas
              key={`${i}_${groupWeights.length}`}
              weights={groupWeights}
              rows={rows}
              cols={cols}
              isRounded={isRounded}
            />
          )
        })}
      </div>
    </div>
  )
}

interface WeightsGridProps {
  weights: number[]
  rows: number
  cols: number
  isRounded?: boolean
}

const WeightsGridCanvas = ({ weights, rows, cols, isRounded }: WeightsGridProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const MIN_WIDTH = 400
    if (canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")
      if (ctx) {
        const maxDim = Math.max(rows, cols)
        const ps = Math.ceil(MIN_WIDTH / maxDim) // pixelSize
        const gap = Math.floor(ps / 5)
        canvas.width = cols * (ps + gap) - gap
        canvas.height = rows * (ps + gap) - gap
        weights.forEach((w, i) => {
          const x = (i % cols) * (ps + gap) + ps / 2
          const y = Math.floor(i / cols) * (ps + gap) + ps / 2

          const safeW = Math.max(-1, Math.min(1, w)) // clamp to [-1, 1], sometimes we have floats like -1.0000001 etc.
          const color = getActColor(safeW).style

          ctx.fillStyle = color
          if (isRounded) {
            ctx.beginPath()
            ctx.arc(x, y, ps / 2, 0, 2 * Math.PI)
            ctx.fill()
          } else {
            ctx.fillRect(x - ps / 2, y - ps / 2, ps, ps)
          }
        })
      }
    }
  }, [weights, rows, cols, isRounded])
  return (
    <canvas
      ref={canvasRef}
      className="max-w-full max-h-(--grid-width) sm:max-h-(--grid-width-sm)"
    />
  )
}
