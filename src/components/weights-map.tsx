import { useSelected } from "@/lib/neuron-select"
import { normalizeWithSign } from "@/lib/normalization"
import { getHighlightColor } from "./neuron-group"
import { SphereGeometry } from "three"

export const WeightsMap = () => {
  const selected = useSelected((s) => s.selected)
  const normalizedWeights = normalizeWithSign(selected?.weights) ?? []
  const length = normalizedWeights.length
  if (!length) return null
  const kernelSize = selected?.layer.tfLayer.getConfig().kernelSize
  const cols = Array.isArray(kernelSize)
    ? kernelSize[0]
    : selected?.layer.prevVisibleLayer?.tfLayer.outputShape[2] ?? // TODO: multi-dim (e.g. Dense after Conv2D)
      Math.ceil(Math.sqrt(length))
  const isRounded =
    selected?.layer.prevVisibleLayer?.meshParams.geometry instanceof
    SphereGeometry
  return (
    <div className="">
      <div className="mb-4">weights</div>
      <div
        className={`grid ${
          length > 100 ? "gap-[0.5px] sm:gap-0.5" : "gap-1"
        } w-[100px] sm:w-[160px]`}
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(5px, 1fr))`,
        }}
      >
        {normalizedWeights.map((w, i) => (
          <Box key={i} color={getHighlightColor(w)} isRounded={isRounded} />
        ))}
      </div>
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
