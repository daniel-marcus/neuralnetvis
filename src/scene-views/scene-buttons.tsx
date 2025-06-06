import { useCallback, useEffect, useState, useTransition } from "react"
import { clearStatus, setStatus, useHasFocussed, useSceneStore } from "@/store"
import { Button, Select } from "@/components/ui-elements"
import type { Dataset } from "@/data"
import type { View } from "@/store/view"

export const SceneButtons = ({ isLarge }: { isLarge?: boolean }) => {
  return (
    <div
      className={`max-w-[300px] flex gap-2 flex-wrap justify-start w-auto pointer-events-auto screenshot:hidden`}
    >
      <LoadWeightsButton />
      <LoadFullDsButton />
      <ViewSelect />
      <ViewSubsetSelect />
      {isLarge && <ToggleHiddenLayersButton />}
      <ShowAllLayersBtn />
    </div>
  )
}

function ToggleHiddenLayersButton() {
  const showHidden = useSceneStore((s) => s.vis.showHiddenLayers)
  const _toggleHidden = useSceneStore((s) => s.vis.toggleShowHiddenLayers)
  const [statusId, setStatusId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const toggle = useCallback(() => {
    const text = showHidden ? "" : "Loading hidden layers ..."
    const newStatusId = setStatus(text, -1)
    setStatusId(newStatusId)
  }, [showHidden])
  useEffect(() => {
    if (!statusId) return
    startTransition(() => _toggleHidden())
  }, [statusId, _toggleHidden])
  useEffect(() => {
    if (!isPending || !statusId) return
    return () => {
      setStatusId(null)
      clearStatus(statusId)
    }
  }, [isPending, statusId])
  return (
    <Button variant="secondary" onClick={toggle}>
      {showHidden ? "hide" : "show"} hidden
    </Button>
  )
}

function LoadWeightsButton() {
  const ds = useSceneStore((s) => s.ds)
  const shouldLoadWeights = useSceneStore((s) => s.shouldLoadWeights)
  const loadState = useSceneStore((s) => s.modelLoadState)
  const setLoadWeights = useSceneStore((s) => s.setLoadWeights)
  if (!ds || !ds.model) return null
  const isPreview = ds.model.lazyLoadWeights && loadState === "no-weights"
  if (!isPreview || shouldLoadWeights) return null
  return (
    <>
      <span className="text-accent">PREVIEW</span>
      <Button
        onClick={() => setLoadWeights(true)}
        className="pointer-events-auto"
      >
        load model weights
      </Button>
    </>
  )
}

function LoadFullDsButton() {
  const dsLoaded = useSceneStore((s) => !!s.ds)
  const isDsPreview = useSceneStore((s) => s.ds?.loaded !== "full")
  const shouldLoadFullDs = useSceneStore((s) => s.shouldLoadFullDs)
  const setLoadFull = useSceneStore((s) => s.setLoadFullDs)
  if (!isDsPreview || shouldLoadFullDs || !dsLoaded) return null
  return (
    <>
      <span className="text-accent">PREVIEW</span>
      <Button onClick={() => setLoadFull(true)} className="pointer-events-auto">
        load full data
      </Button>
    </>
  )
}

type ViewOption = {
  value: View
  label?: string
  cond?: (ds?: Dataset) => boolean
}

const VIEWS: ViewOption[] = [
  { value: "layers", label: "layers view" },
  { value: "graph", label: "graph view" },
  { value: "map", cond: (ds?: Dataset) => !!ds?.mapProps },
  { value: "evaluation", label: "evaluation" },
]

function ViewSelect() {
  const view = useSceneStore((s) => s.view)
  const setView = useSceneStore((s) => s.setView)
  const ds = useSceneStore((s) => s.ds)
  const views = VIEWS.filter((v) => !v.cond || v.cond(ds))
  if (views.length < 2) return null
  return (
    <Select
      options={views}
      value={view}
      onChange={(val) => setView(val as View)}
      label="view"
    />
  )
}

function ViewSubsetSelect() {
  const ds = useSceneStore((s) => s.ds)
  const view = useSceneStore((s) => s.view)
  const subset = useSceneStore((s) => s.subset)
  const setSubset = useSceneStore((s) => s.setSubset)
  if (!ds || view === "graph") return null
  const subsets = (["train", "test"] as const).filter(
    (s) => ds[s].totalSamples > 0
  )
  if (subsets.length < 2) return null
  return (
    <Select
      options={subsets.map((s) => ({ value: s, label: `${s} data` }))}
      value={subset}
      onChange={(val) => setSubset(val as (typeof subsets)[number])}
      className="pointer-events-auto"
      label="subset"
    />
  )
}

function ShowAllLayersBtn() {
  const view = useSceneStore((s) => s.view)
  const hasFocussed = useHasFocussed()
  const setFocussedIdx = useSceneStore((s) => s.setFocussedLayerIdx)
  if (view !== "layers" || !hasFocussed) return null
  return (
    <Button
      onClick={() => setFocussedIdx(undefined)}
      variant="transparent"
      className="border-menu-border!"
    >
      &lt; back
    </Button>
  )
}
