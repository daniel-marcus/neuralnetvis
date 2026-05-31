import { Suspense } from "react"
import { SceneStoreProvider } from "@/store/scene-provider"
import { useSceneStore } from "@/store"
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

import { LoadWeightsButton, SceneButtons } from "./scene-buttons"
import { DrawArea } from "@/data/draw-area"
import { LayerWheel } from "./layer-wheel"
import { NeuronStatus } from "./neuron-status"
import { Portal } from "@/utils/portal"
import { useDomRefs } from "@/utils/dom-refs"
import { SampleViewer } from "./sample-viewer"
import { useScreenshotSettings } from "@/utils/screenshot"
import { useDidMount } from "@/utils/helpers"

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
  const sampleViewerIdxs = useSceneStore((s) => s.sampleViewerIdxs)
  const showSampleViewer = isActive && (!!sampleViewerIdxs.length || dsDef?.sampleViewer)
  const ownCanvas = !!dsDef?.mapProps
  useScreenshotSettings(isActive)
  const [ref, didMount] = useDidMount<HTMLDivElement>()
  const { neuronStatusRef, sampleViewerRef } = useDomRefs()
  const drawAreaShown = useSceneStore((s) => s.drawAreaShown)
  return (
    <div
      className={`flex justify-center items-center w-full h-full`}
      onMouseEnter={!isActive ? () => setIsHovered(true) : undefined}
      onMouseLeave={!isActive ? () => setIsHovered(false) : undefined}
      ref={ref}
    >
      {showMap && <MapPlot />}
      {!!dsDef?.camProps && <VideoWindow />}
      <SampleName />
      <CanvasView {...props} ownCanvas={ownCanvas} />
      {section === "play" && isActive && didMount && <LayerWheel />}
      {isActive && <BlurMask />}
      <SceneOverlay section={section}>
        <div
          className={`w-full ${
            isActive ? "sticky left-0 p-main pt-(--header-height)!" : "p-4"
          } flex flex-col gap-2 sm:gap-4 items-start`}
        >
          <SceneTitle title={title} href={path} section={section} ds={ds ?? dsDef} />
          <LoadWeightsButton />
          {section === "play" && isActive && <SceneButtons />}
          {isActive && view === "layers" && drawAreaShown && (
            <DrawArea title={dsDef?.drawOptions?.title} />
          )}
        </div>
        {view === "evaluation" && <EvaluationView />}
      </SceneOverlay>
      {section === "play" && view === "layers" && !showSampleViewer && <SampleSlider />}
      {showSampleViewer && (
        <Portal target={sampleViewerRef}>
          <SampleViewer />
        </Portal>
      )}
      {section === "play" && isActive && (
        <Portal target={neuronStatusRef}>
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
      isLargeModel={props.isLargeModel}
      drawAreaShown={props.hasDraw}
    >
      <Suspense>
        <SceneViewerInner {...props} />
      </Suspense>
    </SceneStoreProvider>
  )
}
