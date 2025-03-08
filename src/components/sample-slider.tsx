import { useGlobalStore } from "@/store"
import { Slider } from "@/components/ui-elements"

export const SampleSlider = () => {
  const hasSelected = useGlobalStore((s) => !!s.hoveredNid || !!s.selectedNid)
  const hasStatus = !!useGlobalStore((s) => s.status.getCurrent())
  const hasProgressBar =
    typeof useGlobalStore((s) => s.status.getPercent()) === "number"
  const visIsLocked = useGlobalStore((s) => s.vis.isLocked)
  const sampleIdx = useGlobalStore((s) => s.sampleIdx)
  const totalSamples = useGlobalStore((s) => s.totalSamples())
  const hasStream = useGlobalStore((s) => !!s.stream)
  return (
    <div className="absolute bottom-0 left-0 p-main w-full flex justify-center">
      <div
        className={`w-full max-w-[80vw] sm:max-w-[380px] pointer-events-auto ${
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
          onChange={(sampleIdx) => useGlobalStore.setState({ sampleIdx })}
          min={0}
          max={totalSamples - 1}
          yPad={0.25}
        />
        <div className="label pointer-events-none text-left opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-200">
          {sampleIdx + 1} / {totalSamples}
        </div>
      </div>
    </div>
  )
}
