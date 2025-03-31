import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { Scene } from "@/scene"
import { SceneStoreProvider, useGlobalStore, useSceneStore } from "@/store"
import { useModel, useTraining } from "@/model"
import { useDsDef, useDataset, useSample, type Dataset } from "@/data"
import { VideoControl, VideoWindow } from "./video"
import { SampleSlider } from "./sample-slider"
import { useInitialState } from "@/utils/initial-state"
import { Button, Select, ExtLink } from "./ui-elements"
import { AsciiText, splitWithThreshold } from "./ui-elements/ascii-text"
import { MapPlot } from "./datavis/map-plot"
import { BlurMask } from "./status-bar"
import { EvaluationView } from "./evaluation"
import { getTileDuration, type TileDef } from "./tile-grid"
import type { View } from "@/store/view"
import { createPortal } from "react-dom"

type SceneViewerProps = TileDef & { isActive: boolean }

function SceneViewerInner(props: SceneViewerProps) {
  const { dsKey, isActive, section, path } = props
  const dsDef = useDsDef(dsKey)
  const ds = useDataset(dsDef)
  const model = useModel(ds)
  useSample(ds, isActive)
  useTraining(model, ds)
  useInitialState(props.initialState)
  const view = useSceneStore((s) => s.view)
  const title = section === "play" && dsDef ? dsDef.name : props.title
  return (
    <>
      {dsDef?.task === "regression" && <MapPlot />}
      {dsDef?.hasCam && <VideoWindow />}
      <SampleName />
      <BlurMask />
      <Scene {...props} />
      <SceneOverlay>
        <SceneTitle title={title} href={path} section={section} />
        {section === "play" && isActive && <SceneButtons />}
        {view === "evaluation" && <EvaluationView />}
      </SceneOverlay>
      {section === "play" && view === "model" && <SampleSlider />}
    </>
  )
}

export const SceneViewer = (props: SceneViewerProps) => {
  const { isActive, shouldLoadFullDs } = props
  return (
    <SceneStoreProvider isActive={isActive} shouldLoadFullDs={shouldLoadFullDs}>
      <Suspense>
        <SceneViewerInner {...props} />
      </Suspense>
    </SceneStoreProvider>
  )
}

const DsDescription = () => {
  const view = useSceneStore((s) => s.view)
  const ds = useSceneStore((s) => s.ds)
  if (!ds) return null
  return (
    <div
      className={`max-w-[300px] mb-2 pointer-events-auto ${
        view !== "model" ? "hidden xl:block" : ""
      }`}
    >
      <p>{ds.description}</p>
      <p>
        <ExtLink href={ds.aboutUrl}>See Details</ExtLink>
      </p>
    </div>
  )
}

const SceneOverlay = ({ children }: { children: ReactNode }) => {
  const isActive = useSceneStore((s) => s.isActive)
  const [localActive, setLocalActive] = useState(false)
  useEffect(() => {
    if (!isActive) return
    window.scrollTo({ top: 0 })
    setTimeout(() => setLocalActive(true), getTileDuration())
    return () => {
      window.scrollTo({ top: useGlobalStore.getState().scrollPos })
      setLocalActive(false)
    }
  }, [isActive])
  const comp = (
    <div
      className={`relative top-0 left-0 h-full w-full overflow-scroll pointer-events-none ${
        isActive || (!isActive && localActive)
          ? "p-main pt-[var(--header-height)]!"
          : "p-4"
      } transition-[padding] duration-[var(--tile-duration)] flex flex-col gap-2 sm:gap-4 items-start`}
    >
      {children}
    </div>
  )
  return isActive && localActive
    ? createPortal(comp, document.querySelector("#my-portal")!)
    : comp
}

const SceneButtons = () => {
  const ds = useSceneStore((s) => s.ds)
  return (
    <div
      className={`max-w-[300px] flex gap-2 flex-wrap justify-start w-auto pointer-events-auto`}
    >
      <LoadFullButton />
      {ds?.hasCam && <VideoControl />}
      <ViewSelect />
      <ViewSubsetSelect />
    </div>
  )
}

interface SceneTitleProps {
  title: string
  href: string
  section?: string
}

export const SceneTitle = ({ title, href, section }: SceneTitleProps) => {
  const isActive = useSceneStore((s) => s.isActive)
  const [showDescription, setShowDescription] = useState(true)
  const toggleDescription = () => setShowDescription((s) => !s)
  const Comp = isActive ? "button" : Link
  const onClick = isActive ? toggleDescription : undefined
  if (isActive && section === "learn") return null
  return (
    <>
      <Comp
        href={href}
        onClick={onClick}
        className={`pointer-events-auto ${
          section === "learn" ? "absolute bottom-4" : ""
        } ${isActive ? "hover:text-white" : "group-hover/tile:text-white"}`}
      >
        <AsciiText className={`text-logo mb-[-2em]`}>{title}</AsciiText>
      </Comp>
      {isActive && showDescription && <DsDescription />}
    </>
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
    />
  )
}

function ViewSubsetSelect() {
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
    />
  )
}

function SampleName() {
  const isActive = useSceneStore((s) => s.isActive)
  const sampleName = useSceneStore((s) => s.sample?.name)
  const rows = useMemo(
    () => splitWithThreshold(sampleName ?? "", 9),
    [sampleName]
  )
  if (!sampleName) return null
  return (
    <div
      className={`absolute top-0 w-full h-full p-4 pointer-events-none flex items-end justify-end pb-24 ${
        isActive ? "pb-30 sm:items-center sm:justify-start sm:pb-4" : ""
      } transition-opacity duration-200`}
    >
      <div
        className={`text-right ${
          isActive ? "text-[min(0.75vw,0.25rem)] sm:text-left" : "text-[2px]"
        } brightness-25`}
      >
        {rows.map((row, i) => (
          <AsciiText key={i}>{row}</AsciiText>
        ))}
      </div>
    </div>
  )
}
