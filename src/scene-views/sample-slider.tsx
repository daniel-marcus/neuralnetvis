import { useCallback } from "react"
import { useGlobalStore, useSceneStore } from "@/store"
import { Slider } from "@/components/ui-elements"
import { useKeyCommand } from "@/utils/key-command"

export const SampleSlider = () => {
  const isHovered = useSceneStore((s) => s.isHovered)
  const isActive = useSceneStore((s) => s.isActive)
  const hasSelected = useSceneStore((s) => !!s.hoveredNid || !!s.selectedNid)
  const hasStatus = useGlobalStore((s) => !!s.status.getCurrent())
  const hasProgressBar =
    typeof useGlobalStore((s) => s.status.getPercent()) === "number"
  const visIsLocked = useSceneStore((s) => s.vis.isLocked)
  const sampleIdx = useSceneStore((s) => s.sampleIdx)
  const setSampleIdx = useSceneStore((s) => s.setSampleIdx)
  const subset = useSceneStore((s) => s.subset)
  const totalSamples = useSceneStore((s) => s.totalSamples(subset))
  const hasStream = useSceneStore((s) => !!s.stream)

  const next = useSceneStore((s) => s.nextSample)
  const prev = useCallback(() => next(-1), [next])
  useKeyCommand("ArrowLeft", prev, isActive || isHovered)
  useKeyCommand("ArrowRight", next, isActive || isHovered)

  return (
    <div
      className={`absolute will-change-transform left-0 ${
        isActive ? "bottom-8" : "bottom-[-2px] leading-[1]"
      } w-full flex-row items-center justify-center transition-[bottom] duration-300 screenshot:hidden`}
    >
      <div className="flex justify-center">
        <div
          className={`w-full ${
            isActive ? "px-4 max-w-[320px] sm:max-w-[380px]" : ""
          } pointer-events-auto ${
            hasProgressBar || !totalSamples || visIsLocked || hasStream
              ? "opacity-0 pointer-events-none"
              : isActive && (hasStatus || hasSelected)
              ? "opacity-0 pointer-events-none lg:opacity-[var(--opacity-inactive-lg)] lg:pointer-events-auto lg:hover:opacity-[var(--opacity-active)] lg:active:opacity-[var(--opacity-active)]"
              : "opacity-[var(--opacity-inactive)] lg:opacity-[var(--opacity-inactive-lg)] hover:opacity-[var(--opacity-active)] active:opacity-[var(--opacity-active)]"
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
            onChange={(sampleIdx) => setSampleIdx(sampleIdx)}
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
