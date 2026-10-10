import { useState } from "react"
import { useGlobalStore, useSceneStore } from "@/store"
import { useHovered, useSelected } from "@/neuron-layers/neurons"
import { Select, Table } from "@/components/ui-elements"
import { useHasLesson } from "@/components/lesson"
import { supportsFeatureVis } from "@/model/feature-vis"
import { imageInputRanges } from "@/data/preprocess"
import { GRID_STYLE } from "./viewer-slot"
import { WeightsViewer } from "./weights-viewer"
import { FeatureVisViewer } from "./feature-vis"
import type { NeuronStateful } from "@/neuron-layers/types"

type NeuronView = "weights" | "featureVis"

const VIEW_OPTIONS: { value: NeuronView; label: string }[] = [
  { value: "weights", label: "Weights" },
  { value: "featureVis", label: "Preferred input" },
]

const INTERACTIVE_TAGS = ["BUTTON", "SELECT", "OPTION"] // clicks that don't deselect the neuron

export const NeuronInspector = () => {
  const _hovered = useHovered()
  const _selected = useSelected()
  const selected = _hovered ?? _selected
  const toggleSelected = useSceneStore((s) => s.toggleSelected)
  const hasStatus = !!useGlobalStore((s) => s.status.getCurrent())
  const hasLesson = useHasLesson()
  const visLocked = useSceneStore((s) => s.vis.isLocked)
  const model = useSceneStore((s) => s.model)
  const preprocessFunc = useSceneStore((s) => s.ds?.preprocessFunc)
  const highlightProp = useGlobalStore((s) => s.scene?.getState().vis?.highlightProp)
  const [view, setView] = useState<NeuronView>("weights")
  const handleClick = (e: React.MouseEvent) => {
    if ("tagName" in e.target && INTERACTIVE_TAGS.includes(e.target.tagName as string)) return
    toggleSelected(undefined)
  }
  if (!selected || (hasLesson && visLocked)) return null
  const inputRange = preprocessFunc && imageInputRanges[preprocessFunc]
  const hasFeatureVis = !!model && !!inputRange && supportsFeatureVis(model, selected.layer.tfLayer)
  const hasWeights =
    !!selected.weights?.length && !!selected.layer.prevLayer && highlightProp !== "weights" // will be duplication
  const currView = hasWeights && hasFeatureVis ? view : hasFeatureVis ? "featureVis" : "weights"
  return (
    <div
      className={`p-main flex gap-4 items-end sm:flex-col ${
        hasStatus ? "hidden sm:flex" : ""
      } pointer-events-auto [&:active:not(:has(button:active,select:active))]:brightness-120`}
      onClick={handleClick}
    >
      {(hasWeights || hasFeatureVis) && (
        <div
          className="shrink-0 w-(--grid-width) sm:w-(--grid-width-sm) mb-[0.3em]"
          style={GRID_STYLE}
        >
          {hasWeights && hasFeatureVis && (
            <Select
              className="mb-2"
              label="Neuron view"
              options={VIEW_OPTIONS}
              value={currView}
              onChange={(val) => setView(val as NeuronView)}
            />
          )}
          {currView === "featureVis" && inputRange ? (
            <FeatureVisViewer neuron={selected} inputRange={inputRange} />
          ) : (
            <WeightsViewer neuron={selected} />
          )}
        </div>
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
