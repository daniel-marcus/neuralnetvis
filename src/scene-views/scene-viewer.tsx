import { Suspense, useContext, useEffect, useState, type RefObject } from "react"
import { SceneStoreProvider } from "@/store/scene-provider"
import { SceneContext, useSceneStore } from "@/store"
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
import { TextArea } from "@/data/text-area"
import { LayerWheel } from "./layer-wheel"
import { NeuronInspector } from "./neuron-inspector/neuron-inspector"
import { Portal } from "@/utils/portal"
import { useDomRefs } from "@/utils/dom-refs"
import { SampleViewer } from "./sample-viewer"
import { useScreenshotSettings } from "@/utils/screenshot"
import { useDidMount } from "@/utils/helpers"
import { useInView } from "@/utils/screen"
import { useHasActiveTile } from "@/components/tile-grid-data"

import type { TileDef } from "@/components/tile-grid-data"

type SceneViewerProps = TileDef & {
  isActive: boolean
  tileIdx: number
}

function SceneViewerInner(props: SceneViewerProps) {
  const { dsKey, isActive, section, path } = props
  const [ref, didMount] = useDidMount<HTMLDivElement>()
  const shouldLoad = useShouldLoad(ref, isActive)
  const dsDef = useDsDef(dsKey)
  const ds = useDataset(shouldLoad ? dsDef : undefined) // no dataset -> no model either
  const model = useModel(ds)
  useTraining(model, ds)
  const view = useSceneStore((s) => s.view)
  const title = section === "play" && dsDef ? dsDef.name : props.title
  const showMap = dsDef?.task === "regression" && view !== "graph"
  const setIsHovered = useSceneStore((s) => s.setIsHovered)
  const sampleViewerIdxs = useSceneStore((s) => s.sampleViewerIdxs)
  const sampleViewerEnabled = useSceneStore((s) => s.showSampleViewer)
  const showSampleViewer =
    isActive && sampleViewerEnabled && (!!sampleViewerIdxs.length || dsDef?.sampleViewer)
  const ownCanvas = !!dsDef?.mapProps
  useScreenshotSettings(isActive)
  const { neuronInspectorRef, sampleViewerRef } = useDomRefs()
  const hasInputArea = !!dsDef?.drawOptions || !!dsDef?.tokenizerName
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
          {section === "play" &&
            isActive &&
            view === "layers" &&
            hasInputArea &&
            (dsDef?.tokenizerName ? (
              <TextArea title={dsDef.drawOptions?.title ?? "Write a review"} />
            ) : (
              <DrawArea title={dsDef?.drawOptions?.title} />
            ))}
        </div>
        {view === "evaluation" && <EvaluationView />}
      </SceneOverlay>
      {section === "play" && view === "layers" && !showSampleViewer && <SampleSlider />}
      {showSampleViewer && (
        <Portal target={sampleViewerRef}>
          <SampleViewer />
        </Portal>
      )}
      {isActive && (
        <Portal target={neuronInspectorRef}>
          <NeuronInspector />
        </Portal>
      )}
    </div>
  )
}

// load dataset & model only for tiles within one screen distance (stays loaded afterwards)
const NEAR_VIEW_OPTIONS = { rootMargin: "100% 0px" }

function useShouldLoad(ref: RefObject<HTMLDivElement | null>, isActive: boolean) {
  const hasActive = useHasActiveTile()
  const [, nearView] = useInView(NEAR_VIEW_OPTIONS, ref)
  const [wasNearView, setWasNearView] = useState(false)
  // don't start loading tiles in the background while another scene is open
  if (nearView && !hasActive && !wasNearView) setWasNearView(true)
  const shouldLoad = isActive || wasNearView
  const store = useContext(SceneContext)
  useEffect(() => store?.setState({ shouldLoad }), [store, shouldLoad])
  return shouldLoad
}

export const SceneViewer = (props: SceneViewerProps) => {
  const { isActive, shouldLoadFullDs, path, initialState, section } = props
  return (
    <SceneStoreProvider
      isActive={isActive}
      shouldLoadFullDs={shouldLoadFullDs}
      uid={path}
      initialState={initialState}
      isLargeModel={props.isLargeModel}
      showSampleViewer={section !== "learn"} // lessons can enable it via setShowSampleViewer
    >
      <Suspense>
        <SceneViewerInner {...props} />
      </Suspense>
    </SceneStoreProvider>
  )
}
