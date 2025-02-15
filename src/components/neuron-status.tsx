import { useEffect, useRef, useState } from "react"
import { SphereGeometry } from "three"
import { useStore } from "@/store"
import { useHovered, useSelected } from "@/neuron-layers/neuron-select"
import { normalizeWithSign } from "@/data/utils"
import { getHighlightColor } from "@/neuron-layers/colors"
import { isScreen } from "@/utils/screen"
import { Table } from "./ui-elements"
import { useHasLesson } from "./lesson"
import type { Neuron } from "@/neuron-layers/types"

export const NeuronStatus = () => {
  const _hovered = useHovered()
  const _selected = useSelected()
  const selected = _hovered ?? _selected
  const toggleSelected = useStore((s) => s.toggleSelected)
  const hasStatus = !!useStore((s) => s.status.text)
  const hasLesson = useHasLesson()
  const visLocked = useStore((s) => s.vis.isLocked)
  const handleClick = (e: React.MouseEvent) => {
    if ("tagName" in e.target && e.target.tagName === "BUTTON") return
    toggleSelected(null)
  }
  if (!selected || (hasLesson && visLocked)) return <div />
  return (
    <div
      className={`flex gap-4 items-end sm:flex-col ${
        hasStatus ? "hidden sm:flex" : ""
      } pointer-events-auto`}
      onClick={handleClick}
    >
      <WeightsViewer neuron={selected} />
      <NeuronInfo neuron={selected} />
    </div>
  )
}

const NeuronInfo = ({ neuron }: { neuron: Neuron }) => {
  const { nid, activation, bias, weights, rawInput } = neuron
  const _data = {
    Neuron: nid,
    Weights: weights?.length,
    Bias: bias?.toFixed(2),
    Activation: activation?.toFixed(2),
  }
  const data =
    typeof rawInput === "number"
      ? { ..._data, "Raw input": Math.round(rawInput * 100) / 100 }
      : _data
  return (
    <div className="w-full">
      <Table data={data} />
    </div>
  )
}

const WeightsViewer = ({ neuron }: { neuron: Neuron }) => {
  const [currGroup, setCurrGroup] = useState(0)
  const highlightProp = useStore((s) => s.vis.highlightProp)
  const isScreenSm = isScreen("sm")
  if (highlightProp === "weights") return null // will be duplication

  const { prevLayer } = neuron.layer
  if (!neuron.weights?.length || !prevLayer) return null
  // TODO: normalize in group?
  const weights = normalizeWithSign(neuron.weights) ?? []

  const prevShape = prevLayer.tfLayer.outputShape as number[]
  const [, , prevWidth, groupCount = 1] = prevShape
  const kernelSize = neuron.layer.tfLayer.getConfig().kernelSize
  const cols = Array.isArray(kernelSize)
    ? (kernelSize[0] as number)
    : prevWidth ?? Math.ceil(Math.sqrt(weights.length)) // 1D Dense to square
  const isRounded = prevLayer.meshParams.geometry instanceof SphereGeometry

  const prev = () => setCurrGroup((g) => (g - 1 + groupCount) % groupCount)
  const next = () => setCurrGroup((g) => (g + 1) % groupCount)
  const maxGroupsPerView = isScreenSm ? 16 : 4
  const needsShifter = groupCount > maxGroupsPerView
  return (
    <div
      className="flex-shrink-0 w-[var(--grid-width)] sm:w-[var(--grid-width-sm)] overflow-hidden mb-[0.3em]"
      style={
        {
          "--grid-width": "calc(4 * 1em * 1.5 - 0.6em)",
          "--grid-width-sm": "199px",
        } as React.CSSProperties
      }
    >
      <div
        className={`${
          needsShifter ? "block" : "hidden"
        } flex justify-center gap-4`}
      >
        <button
          disabled={currGroup === 0}
          className={"disabled:opacity-0"}
          onClick={prev}
        >
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
            ? "grid-cols-[var(--cols-shifted)] sm:grid-cols-[var(--cols-shifted-sm)] translate-x-[(var(--current-shift)]"
            : "grid-cols-[var(--cols-all)]"
        } gap-2 transition-transform duration-100 ease-in-out`}
        style={
          {
            "--cols-shifted": `repeat(${groupCount}, var(--grid-width))`,
            "--cols-shifted-sm": `repeat(${groupCount}, var(--grid-width-sm))`,
            "--cols-all": `repeat(${Math.ceil(Math.sqrt(groupCount))}, 1fr)`,
            "--current-shift": `translateX(calc(-${
              currGroup * 100
            }% - ${currGroup}*0.5rem))`,
          } as React.CSSProperties
        }
      >
        {Array.from({ length: groupCount }).map((_, i) => {
          const groupWeights = weights.filter((_, j) => j % groupCount === i)
          const isInView = needsShifter ? i === currGroup : true
          if (!isInView) return null
          return (
            <WeightsGridCanvas
              key={`${i}_${groupWeights.length}`}
              weights={groupWeights}
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
  cols: number
  isRounded?: boolean
  groupCount?: number
}

const WeightsGridCanvas = ({ weights, cols, isRounded }: WeightsGridProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const MIN_WIDTH = 400
    if (canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")
      if (ctx) {
        const rows = Math.ceil(weights.length / cols)
        const pixelSize = Math.ceil(MIN_WIDTH / cols)
        const gapSize = Math.floor(pixelSize / 5)

        canvas.width = cols * (pixelSize + gapSize) - gapSize
        canvas.height = rows * (pixelSize + gapSize) - gapSize

        weights.forEach((w, i) => {
          const x = (i % cols) * (pixelSize + gapSize) + pixelSize / 2
          const y = Math.floor(i / cols) * (pixelSize + gapSize) + pixelSize / 2

          const color = getHighlightColor(w).getStyle()

          ctx.fillStyle = color
          if (isRounded) {
            ctx.beginPath()
            ctx.arc(x, y, pixelSize / 2, 0, 2 * Math.PI)
            ctx.fill()
          } else {
            ctx.fillRect(
              x - pixelSize / 2,
              y - pixelSize / 2,
              pixelSize,
              pixelSize
            )
          }
        })
      }
    }
  }, [weights, cols, isRounded])

  return <canvas ref={canvasRef} className="w-full" />
}
