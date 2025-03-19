import { Scene } from "@/scene"
import { SceneStoreProvider, useSceneStore } from "@/store"
import { useModel } from "@/model/model"
import { useDataset, useDsDef } from "@/data/dataset"
import { useSample } from "@/data"
import { VideoControl, VideoWindow } from "./video"
import { SampleSlider } from "./sample-slider"
import { useTraining } from "@/model"
import { InitialState, useInitialState } from "@/utils/initial-state"
import { Section } from "./tile-grid"
import { InlineButton } from "./ui-elements"
import { useSearchParams } from "next/navigation"
import { Suspense, useMemo } from "react"
import { AsciiText, splitWithThreshold } from "./ui-elements/ascii-text"
import { Map } from "./map"

interface SceneViewerProps {
  isActive: boolean
  section: Section
  dsKey?: string
  initialState?: InitialState
  shouldLoadFullDs?: boolean
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

function SceneViewerInner(props: SceneViewerProps) {
  const { dsKey, isActive, section } = props
  const isPreview = !isActive
  const dsKeyFromParams = useSearchParams().get("ds")
  const dsDef = useDsDef(isActive && dsKeyFromParams ? dsKeyFromParams : dsKey)
  const ds = useDataset(dsDef, isPreview)
  const model = useModel(ds, isPreview)
  useSample(ds, isActive)
  useTraining(model, ds)
  useInitialState(props.initialState)
  return (
    <>
      {dsDef?.hasMap && <Map />}
      {dsDef?.hasCam && <VideoWindow />}
      <SampleName />
      <Scene {...props} />
      {isActive && (
        <SceneBtns>
          <LoadFullBtn />
          {dsDef?.hasCam && <VideoControl />}
        </SceneBtns>
      )}
      {section === "play" && <SampleSlider isActive={isActive} />}
    </>
  )
}

export function SceneBtns({ children }: { children?: React.ReactNode }) {
  return (
    <div
      className={`absolute z-50 left-0 top-[calc(62px+var(--padding-main))] p-main flex gap-2 justify-start w-auto`}
    >
      {children}
    </div>
  )
}

function LoadFullBtn() {
  const dsLoaded = useSceneStore((s) => !!s.ds)
  const hasMoreData = useSceneStore((s) => s.ds?.loaded !== "full")
  const shouldLoadFullDs = useSceneStore((s) => s.shouldLoadFullDs)
  const setLoadFull = useSceneStore((s) => s.setLoadFullDs)
  if (!hasMoreData || shouldLoadFullDs || !dsLoaded) return null
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

function SampleName() {
  const isActive = useSceneStore((s) => s.isActive)
  const sampleName = useSceneStore((s) => s.sample?.name)
  const chunks = useMemo(
    () => splitWithThreshold(sampleName ?? "", 9),
    [sampleName]
  )
  if (!sampleName) return null
  return (
    <div
      className={`absolute top-0 w-full h-full p-4 pointer-events-none flex items-end justify-end pb-24 ${
        isActive ? "pb-30 sm:items-center sm:justify-start sm:pb-4" : ""
      }`}
    >
      <div
        className={`text-right ${
          isActive ? "text-[min(0.75vw,0.3rem)] sm:text-left" : "text-[2px]"
        } brightness-25`}
      >
        {chunks.map((chunk, i) => (
          <AsciiText key={i}>{chunk}</AsciiText>
        ))}
      </div>
    </div>
  )
}
