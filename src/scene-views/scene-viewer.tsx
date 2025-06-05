import { Suspense } from "react"
import { SceneStoreProvider, useSceneStore } from "@/store"
import { useDsDef, useDataset } from "@/data"
import { useModel, useTraining } from "@/model"

import { SampleName } from "./sample-name"
import { CanvasView } from "./3d-model/canvas-view"
import { BlurMask } from "./blur-mask"
import { VideoWindow } from "./video"
import { EvaluationView } from "./evaluation/evaluation"
import { MapPlot } from "./map/map-plot"

import { SceneOverlay } from "./overlay"
import { SceneTitle } from "./title"
import { SampleSlider } from "./sample-slider"

import { SceneButtons } from "./scene-buttons"
import { LayerWheel } from "./layer-wheel"
import { NeuronStatus } from "./neuron-status"
import { neuronStatusPortal } from "@/components/status-bar"
import { Portal } from "@/components/portal"

import type { TileDef } from "@/components/tile-grid"

type SceneViewerProps = TileDef & {
  isActive: boolean
  tileIdx: number
}

function SceneViewerInner(props: SceneViewerProps) {
  const { dsKey, isActive, section, path } = props
  const dsDef = useDsDef(dsKey)
  const ds = useDataset(dsDef)
  const model = useModel(ds)
  useTraining(model, ds)
  const view = useSceneStore((s) => s.view)
  const title = section === "play" && dsDef ? dsDef.name : props.title
  const showMap = dsDef?.task === "regression" && view !== "graph"
  const setIsHovered = useSceneStore((s) => s.setIsHovered)
  return (
    <div
      className={`flex justify-center items-center w-full h-full ${
        showMap ? "bg-background" : ""
      }`}
      onMouseEnter={!isActive ? () => setIsHovered(true) : undefined}
      onMouseLeave={!isActive ? () => setIsHovered(false) : undefined}
    >
      {showMap && <MapPlot />}
      {!!dsDef?.camProps && <VideoWindow />}
      <SampleName />
      <CanvasView {...props} copyCanvas={showMap} />
      {section === "play" && isActive && <LayerWheel />}
      {isActive && <BlurMask />}
      <SceneOverlay section={section}>
        <div
          className={`w-full ${
            isActive ? "sticky left-0 p-main pt-[var(--header-height)]!" : "p-4"
          } flex flex-col gap-2 sm:gap-4 items-start`}
        >
          <SceneTitle
            title={title}
            href={path}
            section={section}
            ds={ds ?? dsDef}
          />
          {section === "play" && isActive && <SceneButtons />}
        </div>
        {view === "evaluation" && <EvaluationView />}
      </SceneOverlay>
      {section === "play" && view === "layers" && <SampleSlider />}
      {section === "play" && isActive && (
        <Portal target={neuronStatusPortal}>
          <NeuronStatus />
        </Portal>
      )}
    </div>
  )
}

export const SceneViewer = (props: SceneViewerProps) => {
  const { isActive, shouldLoadFullDs, path, initialState } = props
  return (
    <SceneStoreProvider
      isActive={isActive}
      shouldLoadFullDs={shouldLoadFullDs}
      uid={path}
      initialState={initialState}
    >
      <Suspense>
        <SceneViewerInner {...props} />
      </Suspense>
    </SceneStoreProvider>
  )
}
