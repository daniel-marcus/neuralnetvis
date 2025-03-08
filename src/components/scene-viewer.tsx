import { Scene } from "@/scene"
import { SceneStoreProvider } from "@/store"
import { useModel } from "@/model/model"
import { useDataset, useDsDef } from "@/data/dataset"
import { useSample } from "@/data"
import { VideoWindow } from "./video"

interface SceneViewerProps {
  isActive: boolean
  dsKey?: string
}

export const SceneViewer = (props: SceneViewerProps) => {
  return (
    <SceneStoreProvider>
      <SceneViewerInner {...props} />
    </SceneStoreProvider>
  )
}

function SceneViewerInner(props: SceneViewerProps) {
  const { dsKey, isActive } = props
  const isPreview = !isActive

  const dsDef = useDsDef(dsKey)
  const ds = useDataset(dsDef, isPreview)
  useModel(ds, isPreview)
  useSample(ds, isActive)
  return (
    <>
      {dsDef?.hasCam && isActive && <VideoWindow />}
      <Scene {...props} />
    </>
  )
}
