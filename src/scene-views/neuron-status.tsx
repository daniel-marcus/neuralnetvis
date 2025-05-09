import { useEffect, useMemo, useRef, useState } from "react"
import { SphereGeometry } from "three/webgpu"
import { useGlobalStore, useSceneStore } from "@/store"
import { useHovered, useSelected } from "@/neuron-layers/neurons"
import { normalizeWithSign } from "@/data/utils"
import { getActColor } from "@/utils/colors"
import { isScreen } from "@/utils/screen"
import { Table } from "@/components/ui-elements"
import { useHasLesson } from "@/components/lesson"
import type { NeuronStateful } from "@/neuron-layers/types"

export const NeuronStatus = () => {
  const _hovered = useHovered()
  const _selected = useSelected()
  const selected = _hovered ?? _selected
  const toggleSelected = useSceneStore((s) => s.toggleSelected)
  const hasStatus = !!useGlobalStore((s) => s.status.getCurrent())
  const hasLesson = useHasLesson()
  const visLocked = useSceneStore((s) => s.vis.isLocked)
  const handleClick = (e: React.MouseEvent) => {
    if ("tagName" in e.target && e.target.tagName === "BUTTON") return
    toggleSelected(undefined)
  }
  if (!selected || (hasLesson && visLocked)) return null
  return (
    <div
      className={`p-main flex gap-4 items-end sm:flex-col ${
        hasStatus ? "hidden sm:flex" : ""
      } pointer-events-auto active:brightness-120`}
      onClick={handleClick}
    >
      <WeightsViewer neuron={selected} />
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

const WeightsViewer = ({ neuron }: { neuron: NeuronStateful }) => {
  const [currGroup, setCurrGroup] = useState(0)
  const highlightProp = useGlobalStore(
    (s) => s.scene?.getState().vis?.highlightProp
  )
  const isScreenSm = isScreen("sm")

  const { prevLayer } = neuron.layer

  // normalize in group?
  const weights = useMemo(
    () => normalizeWithSign(neuron.weights) ?? [],
    [neuron]
  )

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

const WeightsGridCanvas = ({
  weights,
  rows,
  cols,
  isRounded,
}: WeightsGridProps) => {
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
          const color = getActColor(w).style
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
      className="max-w-full max-h-[var(--grid-width)] sm:max-h-[var(--grid-width-sm)]"
    />
  )
}
