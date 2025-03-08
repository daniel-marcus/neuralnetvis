import { Scene } from "@/scene"
import { SceneStoreProvider } from "@/store"
import { useModel } from "@/model/model"
import { useDataset, useDsDef } from "@/data/dataset"
import { useSample } from "@/data"
import { VideoWindow } from "./video"
import { SampleSlider } from "./sample-slider"
import { useTraining } from "@/model"

interface SceneViewerProps {
  isActive: boolean
  dsKey?: string
}

export const SceneViewer = (props: SceneViewerProps) => {
  return (
    <SceneStoreProvider isActive={props.isActive}>
      <SceneViewerInner {...props} />
    </SceneStoreProvider>
  )
}

function SceneViewerInner(props: SceneViewerProps) {
  const { dsKey, isActive } = props
  const isPreview = !isActive
  const dsDef = useDsDef(dsKey)
  const ds = useDataset(dsDef, isPreview)
  const model = useModel(ds, isPreview)
  useSample(ds, isActive)
  useTraining(model, ds)
  return (
    <>
      {dsDef?.hasCam && <VideoWindow isActive={isActive} />}
      <Scene {...props} />
      <SampleSlider isActive={isActive} />
    </>
  )
}
