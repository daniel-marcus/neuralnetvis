import { useGlobalStore, useSceneStore } from "@/store"
import { Slider } from "@/components/ui-elements"

export const SampleSlider = ({ isActive }: { isActive: boolean }) => {
  const hasSelected = useSceneStore((s) => !!s.hoveredNid || !!s.selectedNid)
  const hasStatus = useGlobalStore((s) => !!s.status.getCurrent())
  const hasProgressBar =
    typeof useGlobalStore((s) => s.status.getPercent()) === "number"
  const visIsLocked = useSceneStore((s) => s.vis.isLocked)
  const sampleIdx = useSceneStore((s) => s.sampleIdx)
  const setSampleIdx = useSceneStore((s) => s.setSampleIdx)
  const totalSamples = useSceneStore((s) => s.totalSamples())
  const hasStream = useSceneStore((s) => !!s.stream)
  return (
    <div
      className={`absolute left-0 ${
        isActive ? "bottom-8" : "bottom-0 leading-[1]"
      } w-full flex justify-center transition-[bottom] duration-300`}
    >
      <div
        className={`w-full ${
          isActive ? "max-w-[80vw] sm:max-w-[380px]" : ""
        } pointer-events-auto ${
          hasProgressBar || !totalSamples || visIsLocked || hasStream
            ? "opacity-0 pointer-events-none"
            : hasStatus || hasSelected
            ? "opacity-0 pointer-events-none lg:opacity-[var(--opacity-inactive-lg)] lg:pointer-events-auto lg:hover:opacity-[var(--opacity-active)] lg:active:opacity-[var(--opacity-active)]"
            : "opacity-[var(--opacity-inactive)] lg:opacity-[var(--opacity-inactive-lg)] hover:opacity-[var(--opacity-active)] active:opacity-[var(--opacity-active)]"
        } transition-opacity duration-200 group`}
        style={
          {
            "--opacity-active": "1",
            "--opacity-inactive": "0.5",
            "--opacity-inactive-lg": "0.3",
          } as React.CSSProperties
        }
      >
        <Slider
          value={sampleIdx}
          onChange={(sampleIdx) => setSampleIdx(sampleIdx)}
          min={0}
          max={totalSamples - 1}
          yPad={0.25}
        />
        {isActive && (
          <div className="label pointer-events-none text-left opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-200 flex justify-between">
            <div>
              {sampleIdx + 1} / {totalSamples}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
