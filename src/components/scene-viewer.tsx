import Link from "next/link"
import { Scene } from "@/scene"
import { SceneStoreProvider, useSceneStore } from "@/store"
import { useModel } from "@/model/model"
import { useDataset, useDsDef } from "@/data/dataset"
import { Dataset, DatasetDef, useSample } from "@/data"
import { VideoControl, VideoWindow } from "./video"
import { SampleSlider } from "./sample-slider"
import { useTraining } from "@/model"
import { useInitialState } from "@/utils/initial-state"
import { TileDef } from "./tile-grid"
import { InlineButton, Select } from "./ui-elements"
import { useSearchParams } from "next/navigation"
import { Suspense, useMemo, useState } from "react"
import { AsciiText, splitWithThreshold } from "./ui-elements/ascii-text"
import { MapPlot } from "./datavis/map-plot"
import { ExtLink } from "./ui-elements/buttons"
import { BlurMask, useHasBlur } from "./status-bar"
import { View } from "@/store/view"
import { ConfusionMatrix } from "./datavis/confusion-matrix"
import { SampleViewer } from "./sample-viewer"

type SceneViewerProps = TileDef & { isActive: boolean }

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

function SceneViewerInner(props: SceneViewerProps) {
  const { dsKey, isActive, section, path } = props
  const isPreview = !isActive
  const dsKeyFromParams = useSearchParams().get("ds")
  const dsDef = useDsDef(isActive && dsKeyFromParams ? dsKeyFromParams : dsKey)
  const ds = useDataset(dsDef, isPreview)
  const model = useModel(ds, isPreview)
  const view = useSceneStore((s) => s.view)
  useSample(ds, isActive)
  useTraining(model, ds)
  useInitialState(props.initialState)
  const [showDescription, setShowDescription] = useState(true)
  const title = section === "play" && dsDef ? dsDef.name : props.title
  return (
    <>
      {dsDef?.task === "regression" && <MapPlot />}
      {dsDef?.hasCam && <VideoWindow />}
      <SampleName />
      <BlurMask />
      <Scene {...props} />
      {(section === "play" || !isActive) && (
        <SceneOverlay
          isActive={isActive}
          className={section === "learn" ? "justify-end pb-8" : ""}
        >
          <SceneTitle
            isActive={isActive}
            title={title}
            href={isActive ? undefined : path}
            onClick={isActive ? () => setShowDescription((s) => !s) : undefined}
          />
          {isActive && (
            <>
              {showDescription && !!dsDef && <DsDescription ds={ds ?? dsDef} />}
              <SceneBtns>
                <LoadFullBtn />
                <ViewSelect />
                <ViewSubsetSelect />
                {dsDef?.hasCam && <VideoControl />}
              </SceneBtns>
              {dsDef?.task === "classification" && view === "evaluation" && (
                <StatsViewer />
              )}
            </>
          )}
        </SceneOverlay>
      )}
      {section === "play" && view === "model" && (
        <SampleSlider isActive={isActive} />
      )}
    </>
  )
}

function StatsViewer() {
  const hasSample = useSceneStore((s) => typeof s.sampleIdx === "number")
  const setSampleIdx = useSceneStore((s) => s.setSampleIdx)
  return (
    <div className="flex w-[calc(100vw-2*var(--padding-main))] justify-center xl:fixed xl:inset-0 xl:max-h-screen xl:min-h-screen xl:items-center">
      <div className="py-8">
        <div
          className={`${
            hasSample ? "-translate-x-full scale-50" : ""
          } transition-transform duration-500 pointer-events-auto`}
          onClick={hasSample ? () => setSampleIdx(undefined) : undefined}
        >
          <ConfusionMatrix />
        </div>
        <SampleViewer />
      </div>
    </div>
  )
}

const DsDescription = ({ ds }: { ds: Dataset | DatasetDef }) => {
  const hasBlur = useHasBlur()
  return (
    <div
      className={`max-w-[300px] mb-4 ${
        hasBlur ? "hidden md:block" : "pointer-events-auto"
      }`}
    >
      <p>{ds.description}</p>
      <p>
        <ExtLink href={ds.aboutUrl}>See Details</ExtLink>
      </p>
    </div>
  )
}

type SceneOverlayProps = {
  children?: React.ReactNode
  isActive: boolean
  className?: string
}

const SceneOverlay = ({ children, isActive, className }: SceneOverlayProps) => (
  <div
    className={`absolute z-50 top-0 left-0 h-full overflow-scroll pointer-events-none ${
      isActive
        ? "p-main mt-[calc(var(--header-height)-var(--padding-main))]"
        : "p-4"
    } transition-transform duration-[var(--tile-duration)] flex flex-col gap-4 items-start ${
      className ?? ""
    }`}
  >
    {children}
  </div>
)

const SceneBtns = ({ children }: { children?: React.ReactNode }) => (
  <div
    className={`flex gap-2 flex-wrap justify-start w-auto pointer-events-auto`}
  >
    {children}
  </div>
)

interface SceneTitleProps {
  isActive?: boolean
  title: string
  href?: string
  onClick?: () => void
}

export const SceneTitle = (props: SceneTitleProps) => {
  const { isActive, title, href, onClick } = props
  const Comp = href ? Link : "button"
  return (
    <Comp href={href!} className={`pointer-events-auto`} onClick={onClick}>
      <AsciiText
        className={`text-logo mb-[-2em] ${
          isActive ? "hover:text-white" : "group-hover/tile:text-white"
        }`}
      >
        {title}
      </AsciiText>
    </Comp>
  )
}

function LoadFullBtn() {
  const dsLoaded = useSceneStore((s) => !!s.ds)
  const isPreview = useSceneStore((s) => s.ds?.loaded !== "full")
  const shouldLoadFullDs = useSceneStore((s) => s.shouldLoadFullDs)
  const setLoadFull = useSceneStore((s) => s.setLoadFullDs)
  if (!isPreview || shouldLoadFullDs || !dsLoaded) return null
  return (
    <>
      <span className="text-accent">PREVIEW</span>
      <InlineButton
        onClick={() => setLoadFull(true)}
        className="pointer-events-auto"
      >
        load full
      </InlineButton>
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
