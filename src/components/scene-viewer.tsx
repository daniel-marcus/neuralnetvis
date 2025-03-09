import { Scene } from "@/scene"
import { SceneStoreProvider } from "@/store"
import { useModel } from "@/model/model"
import { useDataset, useDsDef } from "@/data/dataset"
import { useSample } from "@/data"
import { VideoWindow } from "./video"
import { SampleSlider } from "./sample-slider"
import { useTraining } from "@/model"
import { InitialState, useInitialState } from "@/utils/initial-state"
import { SceneType } from "./tile-grid"

interface SceneViewerProps {
  isActive: boolean
  sceneType: SceneType
  dsKey?: string
  initialState?: InitialState
}

export const SceneViewer = (props: SceneViewerProps) => {
  return (
    <SceneStoreProvider isActive={props.isActive}>
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
      {dsDef?.hasCam && <VideoWindow isActive={isActive} />}
      <Scene {...props} />
      {sceneType === "dataset" && <SampleSlider isActive={isActive} />}
    </>
  )
}
