import { useCallback } from "react"
import { useGlobalStore, useSceneStore } from "@/store"
import { Slider } from "@/components/ui-elements"
import { useKeyCommand } from "@/utils/key-command"

export const SampleSlider = () => {
  const isHovered = useSceneStore((s) => s.isHovered)
  const isActive = useSceneStore((s) => s.isActive)
  const hasStatusOrSelected = useHasStatusOrSelected()
  const hasProgressBar = typeof useGlobalStore((s) => s.status.getPercent()) === "number"
  const visIsLocked = useSceneStore((s) => s.vis.isLocked)
  const sampleIdx = useSceneStore((s) => s.sampleIdx)
  const setSampleIdx = useSceneStore((s) => s.setSampleIdx)
  const subset = useSceneStore((s) => s.subset)
  const totalSamples = useSceneStore((s) => s.totalSamples(subset))
  const hasStream = useSceneStore((s) => !!s.stream)
  useKeyboardNavigation(isActive || isHovered)
  return (
    <div
      className={`absolute will-change-transform left-0 ${
        isActive ? "bottom-8" : "-bottom-0.5 leading-none"
      } w-full flex-row items-center justify-center transition-[bottom] duration-300 screenshot:hidden`}
    >
      <div className="flex justify-center">
        <div
          className={`w-full ${
            isActive ? "px-4 max-w-[320px] sm:max-w-95" : ""
          } pointer-events-auto ${
            hasProgressBar || !totalSamples || visIsLocked || hasStream
              ? "opacity-0 pointer-events-none"
              : isActive && hasStatusOrSelected
                ? "opacity-0 pointer-events-none lg:opacity-(--opacity-inactive-lg) lg:pointer-events-auto lg:hover:opacity-(--opacity-active) lg:active:opacity-(--opacity-active)"
                : "opacity-(--opacity-inactive) lg:opacity-(--opacity-inactive-lg) hover:opacity-(--opacity-active) active:opacity-(--opacity-active)"
          } transition-opacity duration-200 group/sample-slider`}
          style={
            {
              "--opacity-active": "1",
              "--opacity-inactive": "0.5",
              "--opacity-inactive-lg": "0.3",
            } as React.CSSProperties
          }
        >
          <Slider
            value={sampleIdx ?? 0}
            onChange={(idx) => setSampleIdx(idx)}
            min={0}
            max={totalSamples - 1}
            yPad={0.25}
          />
          {isActive && (
            <div className="label pointer-events-none select-none text-left opacity-0 group-hover/sample-slider:opacity-100 group-active/sample-slider:opacity-100 transition-opacity duration-200 flex justify-between">
              <div>
                {(sampleIdx ?? 0) + 1} / {totalSamples}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function useKeyboardNavigation(isActive = true) {
  const next = useSceneStore((s) => s.nextSample)
  const prev = useCallback(() => next(-1), [next])
  useKeyCommand("ArrowLeft", prev, isActive)
  useKeyCommand("ArrowRight", next, isActive)
}

/**
 * used for mobile styles to hide sample slider or sample viewer
 */
export function useHasStatusOrSelected() {
  const hasStatus = useGlobalStore((s) => !!s.status.getCurrent())
  const hasSelected = useSceneStore((s) => !!s.hoveredNid || !!s.selectedNid)
  return hasStatus || hasSelected
}
