"use client"

import DeckGL from "@deck.gl/react"
import { OrthographicView } from "@deck.gl/core"
import { useViewState } from "./view-state"
import { useLayers } from "./layers"
import { useSceneStore } from "@/store"
import { useCurrSampleStatus } from "./sample-status"

export const MapPlot = () => {
  const view = useSceneStore((s) => s.view)
  const isActive = useSceneStore((s) => s.isActive)
  const viewStateProps = useViewState()
  const layers = useLayers()
  useCurrSampleStatus(isActive && view === "map")
  return (
    <div
      className={`absolute pointer-events-none ${
        isActive
          ? view === "evaluation"
            ? "z-30"
            : view === "map"
            ? `pointer-events-auto!`
            : "md:translate-x-[25vw]"
          : "grayscale-25 opacity-75"
      } transition duration-[var(--tile-duration)] w-[100vw] h-[100vh]`}
    >
      <DeckGL
        layers={layers}
        views={new OrthographicView()}
        controller
        getCursor={({ isDragging, isHovering }) =>
          isDragging ? "grabbing" : isHovering ? "pointer" : "grab"
        }
        {...viewStateProps}
      />
    </div>
  )
}
