import { Scene } from "@/scene"
import { SceneStoreProvider, useSceneStore } from "@/store"
import { useModel } from "@/model/model"
import { useDataset, useDsDef } from "@/data/dataset"
import { useSample } from "@/data"
import { VideoControl, VideoWindow } from "./video"
import { SampleSlider } from "./sample-slider"
import { useTraining } from "@/model"
import { InitialState, useInitialState } from "@/utils/initial-state"
import { SceneType } from "./tile-grid"
import { InlineButton } from "./ui-elements"

interface SceneViewerProps {
  isActive: boolean
  sceneType: SceneType
  dsKey?: string
  initialState?: InitialState
  shouldLoadFullDs?: boolean
}

export const SceneViewer = (props: SceneViewerProps) => {
  const { isActive, shouldLoadFullDs } = props
  return (
    <SceneStoreProvider isActive={isActive} shouldLoadFullDs={shouldLoadFullDs}>
      <SceneViewerInner {...props} />
    </SceneStoreProvider>
  )
}

function SceneViewerInner(props: SceneViewerProps) {
  const { dsKey, isActive, sceneType } = props
  const isPreview = !isActive
  const dsDef = useDsDef(dsKey)
  const ds = useDataset(dsDef, isPreview)
  const model = useModel(ds, isPreview)
  useSample(ds, isActive)
  useTraining(model, ds)
  useInitialState(props.initialState)
  return (
    <>
      {dsDef?.hasCam && <VideoWindow />}
      <Scene {...props} />
      {isActive && (
        <SceneBtns>
          <LoadFullBtn />
          {dsDef?.hasCam && <VideoControl />}
        </SceneBtns>
      )}
      {sceneType === "dataset" && <SampleSlider isActive={isActive} />}
    </>
  )
}

export function SceneBtns({ children }: { children?: React.ReactNode }) {
  return (
    <div
      className={`fixed z-50 left-0 top-[34px] sm:top-[102px] p-main flex gap-2 justify-end sm:justify-start w-full sm:w-auto`}
    >
      {children}
    </div>
  )
}

function LoadFullBtn() {
  const hasMoreData = useSceneStore((s) => s.ds?.loaded !== "full")
  const shouldLoadFullDs = useSceneStore((s) => s.shouldLoadFullDs)
  const setLoadFull = useSceneStore((s) => s.setLoadFullDs)
  if (!hasMoreData || shouldLoadFullDs) return null
  return (
    <>
      <span className="text-accent">PREVIEW</span>
      <InlineButton onClick={setLoadFull} className="pointer-events-auto">
        load full
      </InlineButton>
    </>
  )
}
