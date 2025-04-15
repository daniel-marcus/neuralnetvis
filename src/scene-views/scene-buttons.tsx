import { useSceneStore } from "@/store"
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

const VIEWS = [
  { value: "model" },
  { value: "evaluation", label: "evaluation" },
  { value: "map", cond: (ds?: Dataset) => !!ds?.mapProps },
  { value: "graph" },
]

export function ViewSelect() {
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

export function ViewSubsetSelect() {
  const ds = useSceneStore((s) => s.ds)
  const subset = useSceneStore((s) => s.subset)
  const setSubset = useSceneStore((s) => s.setSubset)
  if (!ds) return null
  const subsets = (["train", "test"] as const).filter(
    (s) => ds[s].totalSamples > 0
  )
  if (subsets.length < 2) return null
  return (
    <Select
      options={subsets.map((s) => ({ value: s, label: s }))}
      value={subset}
      onChange={(val: string) => setSubset(val as "train" | "test")}
      className="pointer-events-auto"
      label="subset"
    />
  )
}
