import { Suspense } from "react"
import { SceneStoreProvider, useSceneStore } from "@/store"
import { useDsDef, useDataset, useSample } from "@/data"
import { useModel, useTraining } from "@/model"
import { useInitialState } from "@/utils/initial-state"

import { SampleName } from "./sample-name"
import { ThreeCanvas } from "./3d-model/canvas"
import { BlurMask } from "./blur-mask"
import { VideoWindow } from "./video"
import { EvaluationView } from "./evaluation/evaluation"
import { MapPlot } from "./map/map-plot"

import { SceneOverlay } from "./overlay"
import { SceneTitle } from "./title"
import { SampleSlider } from "./sample-slider"

import type { TileDef } from "@/components/tile-grid"
import { SceneButtons } from "./scene-buttons"

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
      {!!dsDef?.camProps && <VideoWindow />}
      <SampleName />
      <ThreeCanvas {...props} />
      {isActive && <BlurMask />}
      <SceneOverlay section={section}>
        <SceneTitle
          title={title}
          href={path}
          section={section}
          ds={ds ?? dsDef}
        />
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
