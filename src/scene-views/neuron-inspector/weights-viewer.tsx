import { useEffect, useMemo, useRef, useState } from "react"
import { SphereGeometry } from "three/webgpu"
import { normalizeWithSign } from "@/data/utils"
import { getActColor } from "@/utils/colors"
import { isScreen } from "@/utils/screen"
import { Pager, ViewerSlot } from "./viewer-slot"
import type { NeuronStateful } from "@/neuron-layers/types"

export const WeightsViewer = ({ neuron }: { neuron: NeuronStateful }) => {
  const [currGroup, setCurrGroup] = useState(0)
  const isScreenSm = isScreen("sm")

  const { prevLayer } = neuron.layer

  // normalize in group?
  const weights = useMemo(() => normalizeWithSign(neuron.weights) ?? [], [neuron])

  if (!neuron.weights?.length || !prevLayer) return null

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

  const maxGroupsPerView = isScreenSm ? 16 : 4
  const needsShifter = groupCount > maxGroupsPerView
  return (
    <ViewerSlot
      footer={
        needsShifter && <Pager page={currGroup} numPages={groupCount} setPage={setCurrGroup} />
      }
    >
      <div
        className={`w-full shrink-0 grid ${
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
    </ViewerSlot>
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
