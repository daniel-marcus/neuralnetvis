import { useHasFocussedLayer, useSceneStore } from "@/store"
import { VideoControl } from "./video"
import { Button, Select } from "@/components/ui-elements"
import type { Dataset } from "@/data"
import type { View } from "@/store/view"

export const SceneButtons = () => {
  const ds = useSceneStore((s) => s.ds)
  return (
    <div
      className={`max-w-[300px] flex gap-2 flex-wrap justify-start w-auto pointer-events-auto screenshot:hidden`}
    >
      <LoadFullButton />
      {!!ds?.camProps && <VideoControl />}
      <ViewSelect />
      <ViewSubsetSelect />
      <ShowAllLayersBtn />
    </div>
  )
}

function LoadFullButton() {
  const dsLoaded = useSceneStore((s) => !!s.ds)
  const isPreview = useSceneStore((s) => s.ds?.loaded !== "full")
  const shouldLoadFullDs = useSceneStore((s) => s.shouldLoadFullDs)
  const setLoadFull = useSceneStore((s) => s.setLoadFullDs)
  if (!isPreview || shouldLoadFullDs || !dsLoaded) return null
  return (
    <>
      <span className="text-accent">PREVIEW</span>
      <Button onClick={() => setLoadFull(true)} className="pointer-events-auto">
        load full
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
  const hasFocussed = useHasFocussedLayer()
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
