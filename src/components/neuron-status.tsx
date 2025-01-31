import { useState } from "react"
import { useSelected } from "@/lib/neuron-select"
import { normalizeWithSign } from "@/lib/normalization"
import { getHighlightColor } from "./neuron-group"
import { SphereGeometry } from "three"
import { Neuron } from "./neuron"

export const NeuronStatus = () => {
  const _selected = useSelected((s) => s.selected)
  const _hovered = useSelected((s) => s.hovered)
  const selected = _hovered ?? _selected
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
  if (!selected) return null
  return (
    <div className="flex gap-4 items-end pointer-events-auto">
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
  const { nid, activation, bias, weights } = neuron
  const weightsName = weights?.length ? "<- Weights" : "Weights"
  const table = {
    Neuron: nid,
    Activation: activation?.toFixed(2),
    [weightsName]: neuron.weights?.length,
    Bias: bias?.toFixed(2),
  }
  return (
    <div>
      <Table obj={table} />
    </div>
  )
}

export const Table = ({
  obj,
}: {
  obj: Record<string, string | number | undefined>
}) => (
  <table>
    <tbody>
      {Object.entries(obj).map(([key, value]) => (
        <tr key={key}>
          <td className={typeof value === "undefined" ? "opacity-50" : ""}>
            {key}
          </td>
          <td className="text-right pl-4">{value}</td>
        </tr>
      ))}
    </tbody>
  </table>
)

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
  const prev = () => setCurrGroup((g) => (g - 1 + groupCount) % groupCount)
  const next = () => setCurrGroup((g) => (g + 1) % groupCount)
  return (
    <div className="w-[calc(80px-0.6em)] sm:w-[calc(96px-0.6em)] overflow-hidden">
      <div
        className={`${
          groupCount === 1 ? "hidden" : ""
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
        className={`grid gap-2 transition-transform duration-100 ease-in-out`}
        style={{
          gridTemplateColumns: `repeat(${groupCount}, 1fr)`,
          transform: `translateX(calc(-${
            currGroup * 100
          }% - ${currGroup}*0.5rem))`,
        }}
      >
        {Array.from({ length: groupCount }).map((_, i) => {
          const groupWeights = weights.filter((_, j) => j % groupCount === i)
          return (
            <WeightsGrid
              key={i}
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
  if (!weights.length) return null
  return (
    <div
      className={`grid w-[calc(80px-0.6em)] sm:w-[calc(96px-0.6em)] ${
        weights.length > 100 ? "gap-0 sm:gap-[1px]" : "gap-1"
      } py-[0.3em] `}
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
      }}
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
