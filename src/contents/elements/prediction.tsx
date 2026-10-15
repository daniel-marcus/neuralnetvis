import { useCurrScene } from "@/store"

// inline prediction of the model for the current sample, e.g. "3 (91%)"
export function Prediction() {
  const outputIdx = useCurrScene((s) => s.allLayers.find((l) => l.layerPos === "output")?.index)
  const activations = useCurrScene((s) =>
    typeof outputIdx === "number" ? s.activations[outputIdx]?.activations : undefined,
  )
  const labels = useCurrScene((s) => s.ds?.outputLabels)
  if (!activations?.length) return <strong>…</strong>
  const maxIdx = activations.reduce((best, val, i, arr) => (val > arr[best] ? i : best), 0)
  const label = labels?.[maxIdx] ?? maxIdx
  const percent = Math.round(activations[maxIdx] * 100)
  const paddedPercent = `${percent}`.padStart(2, " ") // figure space: stable width for 1-digit values
  return (
    <span className="tabular-nums whitespace-pre">
      <strong>{label}</strong> ({paddedPercent}%)
    </span>
  )
}
