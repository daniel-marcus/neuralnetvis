import { useGlobalStore, useSceneStore } from "@/store"
import { useHovered, useSelected } from "@/neuron-layers/neurons"
import { Select, Table } from "@/components/ui-elements"
import { useHasLesson } from "@/components/lesson"
import { supportsFeatureVis } from "@/model/feature-vis"
import { imageInputRanges } from "@/data/preprocess"
import { hasWeightedInputs } from "@/neuron-layers/connections"
import { GRID_STYLE } from "./viewer-slot"
import { WeightsViewer } from "./weights-viewer"
import { WeightedInputsViewer } from "./weighted-inputs"
import { FeatureVisViewer } from "./feature-vis"
import { MIN_SAMPLES, TopSamplesViewer } from "./top-samples"
import type { NeuronStateful } from "@/neuron-layers/types"
import type { NeuronView } from "@/store/neurons"

const VIEW_OPTIONS: { value: NeuronView; label: string }[] = [
  { value: "topSamples", label: "Top samples" },
  { value: "weights", label: "Weights" },
  { value: "weightedInputs", label: "Weighted inputs" },
  { value: "featureVis", label: "Preferred input" },
]

export const NeuronInspector = () => {
  const _hovered = useHovered()
  const _selected = useSelected()
  const hasLesson = useHasLesson()
  const visLocked = useSceneStore((s) => s.vis.isLocked)
  const displayOnly = hasLesson && visLocked // lesson controls selection & view
  const selected = _selected ?? (displayOnly ? undefined : _hovered) // a selected neuron pins the inspector
  const infoOnly = !_selected // hover: compact info only
  const toggleSelected = useSceneStore((s) => s.toggleSelected)
  const hasStatus = !!useGlobalStore((s) => s.status.getCurrent())
  const model = useSceneStore((s) => s.model)
  const preprocessFunc = useSceneStore((s) => s.ds?.preprocessFunc)
  const totalSamples = useSceneStore((s) => s.totalSamples(s.subset))
  const hasSample = useSceneStore((s) => !!s.sample)
  const view = useSceneStore((s) => s.neuronView)
  const setView = useSceneStore((s) => s.setNeuronView)
  const handleClick = (e: React.MouseEvent) => {
    if (e.target instanceof Element && e.target.closest("button, select")) return // controls don't deselect
    toggleSelected(undefined)
  }
  if (!selected) return null
  const inputRange = preprocessFunc && imageInputRanges[preprocessFunc]
  const hasFeatureVis = !!model && !!inputRange && supportsFeatureVis(model, selected.layer.tfLayer)
  const hasWeights = !!selected.weights?.length && !!selected.layer.prevLayer
  const hasWeighted = hasWeights && hasSample && hasWeightedInputs(selected)
  const hasTopSamples =
    !!model && !!inputRange && selected.layer.layerPos !== "input" && totalSamples >= MIN_SAMPLES
  const isAvailable = {
    weights: hasWeights,
    weightedInputs: hasWeighted,
    featureVis: hasFeatureVis,
    topSamples: hasTopSamples,
  }
  const options = VIEW_OPTIONS.filter((o) => isAvailable[o.value])
  const currView = infoOnly ? undefined : isAvailable[view] ? view : options[0]?.value
  return (
    <div
      className={`p-main flex gap-4 items-end sm:flex-col ${hasStatus ? "hidden sm:flex" : ""} ${
        displayOnly
          ? "pointer-events-none"
          : "pointer-events-auto [&:active:not(:has(button:active,select:active))]:brightness-120"
      }`}
      onClick={displayOnly ? undefined : handleClick}
    >
      {!!currView && (
        <div
          className="shrink-0 w-(--grid-width) sm:w-(--grid-width-sm) mb-[0.3em]"
          style={GRID_STYLE}
        >
          {options.length > 1 && !displayOnly && (
            <Select
              className="mb-2"
              label="Neuron view"
              options={options}
              value={currView}
              onChange={(val) => setView(val as NeuronView)}
            />
          )}
          {currView === "featureVis" && inputRange ? (
            <FeatureVisViewer neuron={selected} inputRange={inputRange} />
          ) : currView === "topSamples" ? (
            <TopSamplesViewer key={selected.nid} neuron={selected} />
          ) : currView === "weightedInputs" ? (
            <WeightedInputsViewer neuron={selected} />
          ) : (
            <WeightsViewer neuron={selected} />
          )}
        </div>
      )}
      <NeuronInfo neuron={selected} hint={infoOnly ? "Click to inspect" : undefined} />
    </div>
  )
}

const NeuronInfo = ({ neuron, hint }: { neuron: NeuronStateful; hint?: string }) => {
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
      {!!hint && <p className="text-muted">{hint}</p>}
    </div>
  )
}
