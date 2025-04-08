import { useSceneStore } from "@/store"
import { LinearInterpolator, type OrthographicViewState } from "@deck.gl/core"
import { useEffect, useState } from "react"

const DEFAULT_VIEW: OrthographicViewState = {
  target: [0, 0, 0],
  zoom: 0,
}
const DESKTOP_ZOOM = 0.5
const MOBILE_ZOOM = 0
function getZoom() {
  return window.innerWidth > 640 ? DESKTOP_ZOOM : MOBILE_ZOOM
}

const orthographicInterpolator = new LinearInterpolator({
  transitionProps: ["target", "zoom"],
})

export function useViewState() {
  const [viewState, setViewState] = useState(DEFAULT_VIEW)

  const view = useSceneStore((s) => s.view)
  useEffect(() => {
    if (view !== "map")
      setViewState({
        ...DEFAULT_VIEW,
        zoom: getZoom(),
        transitionDuration: 500,
        transitionInterpolator: orthographicInterpolator,
      })
  }, [view])

  useEffect(() => {
    function onResize() {
      setViewState((s) => ({ ...s, zoom: getZoom() }))
    }
    onResize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])
  const onViewStateChange = (e: { viewState: OrthographicViewState }) =>
    setViewState(e.viewState)
  return { viewState, onViewStateChange }
}
