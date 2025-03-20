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
import { InlineButton } from "./ui-elements"
import { useSearchParams } from "next/navigation"
import { Suspense, useMemo, useState } from "react"
import { AsciiText, splitWithThreshold } from "./ui-elements/ascii-text"
import { Map } from "./map"
import { ExtLink } from "./ui-elements/buttons"

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
  useSample(ds, isActive)
  useTraining(model, ds)
  useInitialState(props.initialState)
  const [showDescription, setShowDescription] = useState(true)
  const title = section === "play" && dsDef ? dsDef.name : props.title
  return (
    <>
      {dsDef?.hasMap && <Map />}
      {dsDef?.hasCam && <VideoWindow />}
      <SampleName />
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
                {dsDef?.hasCam && <VideoControl />}
              </SceneBtns>
            </>
          )}
        </SceneOverlay>
      )}
      {section === "play" && <SampleSlider isActive={isActive} />}
    </>
  )
}

const DsDescription = ({ ds }: { ds: Dataset | DatasetDef }) => (
  <div className="max-w-[300px] mb-4 pointer-events-auto">
    <p>{ds.description}</p>
    <p>
      <ExtLink href={ds.aboutUrl}>See Details</ExtLink>
    </p>
  </div>
)

type SceneOverlayProps = {
  children?: React.ReactNode
  isActive: boolean
  className?: string
}

const SceneOverlay = ({ children, isActive, className }: SceneOverlayProps) => (
  <div
    className={`absolute z-50 top-0 left-0 h-full pointer-events-none ${
      isActive
        ? "p-main translate-y-[calc(var(--header-height)-var(--padding-main))]"
        : "p-4"
    } transition-transform duration-[var(--tile-duration)] flex flex-col gap-4 items-start ${
      className ?? ""
    }`}
  >
    {children}
  </div>
)

const SceneBtns = ({ children }: { children?: React.ReactNode }) => (
  <div className={`flex gap-2 justify-start w-auto pointer-events-auto`}>
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
  const rows = useMemo(
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
