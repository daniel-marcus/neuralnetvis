import Link from "next/link"
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
  path: string
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
  const { dsKey, isActive, section, path } = props
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
      <SceneOverlay>
        {section === "play" && (
          <SceneTitle
            isActive={isActive}
            title={dsDef?.name ?? ""}
            path={path}
          />
        )}
        {isActive && (
          <SceneBtns>
            <LoadFullBtn />
            {dsDef?.hasCam && <VideoControl />}
          </SceneBtns>
        )}
      </SceneOverlay>
      {section === "play" && <SampleSlider isActive={isActive} />}
    </>
  )
}

const SceneOverlay = ({ children }: { children?: React.ReactNode }) => (
  <div className="absolute z-50 top-0 left-0 w-full h-full pointer-events-none p-main">
    {children}
  </div>
)

function SceneBtns({ children }: { children?: React.ReactNode }) {
  return (
    <div className={`flex gap-2 justify-start w-auto py-[var(--padding-main)]`}>
      {children}
    </div>
  )
}

interface SceneTitleProps {
  isActive?: boolean
  title: string
  path: string
}

export const SceneTitle = ({ isActive, title, path }: SceneTitleProps) => (
  <Link
    href={isActive ? "/" : path}
    prefetch={!isActive}
    className="pointer-events-auto pb-4"
  >
    <AsciiText
      className={`text-logo ${
        isActive ? "hover:text-white" : "group-hover/tile:text-white"
      }`}
    >
      {isActive ? `../\n${title}` : title}
    </AsciiText>
  </Link>
)

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
