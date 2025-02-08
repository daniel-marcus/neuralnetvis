import { useRef, useState } from "react"
import { useSelected } from "@/lib/neuron-select"
import { normalizeWithSign } from "@/data/normalization"
import { getHighlightColor } from "../three/neuron-group"
import { SphereGeometry } from "three"
import { Neuron } from "../lib/neuron"
import { Table, useStatusText } from "./status"

export const NeuronStatus = () => {
  const _selected = useSelected((s) => s.selected)
  const _hovered = useSelected((s) => s.hovered)
  const hasCurrentSelected = !!_selected || !!_hovered
  let selected = _hovered ?? _selected
  const prevSelected = useRef<Neuron | null>(null)
  if (selected) prevSelected.current = selected
  else selected = prevSelected.current
  // TODO: normalize in group?
  const normalizedWeights = normalizeWithSign(selected?.weights) ?? []
  const length = normalizedWeights.length
  const kernelSize = selected?.layer.tfLayer.getConfig().kernelSize
  const [, , prevHeight, prevDepth] =
    (selected?.layer.prevVisibleLayer?.tfLayer.outputShape as number[]) ?? []
  const cols = Array.isArray(kernelSize)
    ? (kernelSize[0] as number)
    : prevHeight ?? Math.ceil(Math.sqrt(length)) // 1D Dense to square
  const isRounded =
    selected?.layer.prevVisibleLayer?.meshParams.geometry instanceof
    SphereGeometry

  const hasStatus = !!useStatusText((s) => s.statusText)
  const setSelected = useSelected((s) => s.setSelected)
  if (!selected) return <div />
  return (
    <div
      className={`flex gap-4 items-end sm:flex-col ${
        hasCurrentSelected
          ? "pointer-events-auto cursor-pointer"
          : "opacity-0 max-w-[20%] pointer-events-none"
      } ${hasStatus ? "hidden sm:flex" : ""} transition-opacity duration-150`}
      onClick={() => setSelected(null)}
    >
      <WeightsViewer
        weights={normalizedWeights}
        cols={cols}
        isRounded={isRounded}
        groupCount={prevDepth || 1}
      />
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

interface WeightsGridProps {
  weights: number[]
  cols: number
  isRounded?: boolean
  groupCount?: number
}

const WeightsViewer = ({
  weights,
  cols,
  isRounded,
  groupCount = 1,
}: WeightsGridProps) => {
  const [currGroup, setCurrGroup] = useState(0)
  if (!weights.length) return null
  const prev = () => setCurrGroup((g) => (g - 1 + groupCount) % groupCount)
  const next = () => setCurrGroup((g) => (g + 1) % groupCount)
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640
  const maxGroupsPerView = isMobile ? 4 : 16
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
            <WeightsGrid
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

const WeightsGrid = ({ weights, cols, isRounded }: WeightsGridProps) => {
  return (
    <div
      className={`grid gap-[var(--grid-gap)] sm:gap-[var(--grid-gap-sm)]`}
      style={
        {
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          "--grid-gap": weights.length > 100 ? "0" : "2px",
          "--grid-gap-sm": weights.length > 100 ? "0.2px" : "4px",
        } as React.CSSProperties
      }
    >
      {weights.map((w, i) => (
        <Box key={i} color={getHighlightColor(w)} isRounded={isRounded} />
      ))}
    </div>
  )
}

// TODO: hover values
const Box = ({ color, isRounded }: { color: string; isRounded?: boolean }) => (
  <div
    className={`aspect-square ${isRounded ? "rounded-full" : ""}`}
    style={{
      backgroundColor: color,
    }}
  />
)
