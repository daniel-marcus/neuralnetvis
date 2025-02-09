import { ProgressBar } from "../ui-components/progress-bar"
import { Status, useStatusText } from "./status"
import { NeuronStatus } from "./neuron-status"
import { useSelected } from "@/lib/neuron-select"
import { SampleSlider } from "@/tabs/data"
import { useDatasetStore } from "@/data/datasets"
import { useLockStore } from "./lock"

export const Footer = () => {
  return (
    <div className="fixed z-[2] bottom-0 left-0 w-[100vw] select-none pointer-events-none">
      <div className="p-main -mb-1 relative">
        <div className="flex justify-between items-end relative">
          <NeuronStatus />
          <Status />
        </div>
        <MainSampleSlider />
      </div>
      <ProgressBar />
    </div>
  )
}

export const MainSampleSlider = () => {
  const hasSelected = useSelected((s) => s.hasHoveredOrSelected())
  const hasStatus = !!useStatusText((s) => s.statusText)
  const hasProgressBar = typeof useStatusText((s) => s.percent) === "number"
  const i = useDatasetStore((s) => s.i)
  const totalSamples = useDatasetStore((s) => s.totalSamples)
  const visualizationLocked = useLockStore((s) => s.visualizationLocked)
  return (
    <div className="absolute bottom-0 left-0 p-main w-full flex justify-center">
      <div
        className={`w-full max-w-[80vw] sm:max-w-[380px] pointer-events-auto ${
          hasProgressBar || !totalSamples || visualizationLocked
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
        <SampleSlider />
        <div className="label pointer-events-none text-left opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-200">
          {i + 1} / {totalSamples}
        </div>
      </div>
    </div>
  )
}
