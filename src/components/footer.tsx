import { ProgressBar } from "../ui-components/progress-bar"
import { Status, useStatusText } from "./status"
import { NeuronStatus } from "./neuron-status"
import { useSelected } from "@/lib/neuron-select"
import { SampleSlider } from "@/tabs/data"
import { useDatasetStore } from "@/lib/datasets"

export const Footer = () => {
  return (
    <div className="fixed z-[2] bottom-0 left-0 w-[100vw] select-none text-sm sm:text-base pointer-events-none">
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
  return (
    <div className="absolute bottom-0 left-0 p-main w-full flex justify-center">
      <div
        className={`w-full max-w-[380px] pointer-events-auto ${
          hasProgressBar || !totalSamples
            ? "opacity-0 pointer-events-none"
            : hasStatus || hasSelected
            ? "opacity-0 pointer-events-none lg:opacity-[var(--opacity-inactive)] lg:pointer-events-auto lg:hover:opacity-[var(--opacity-active)] lg:active:opacity-[var(--opacity-active)]"
            : "opacity-[var(--opacity-inactive)] hover:opacity-[var(--opacity-active)] active:opacity-[var(--opacity-active)]"
        } transition-opacity duration-200`}
        style={
          {
            "--opacity-active": "100%",
            "--opacity-inactive": "40%",
          } as React.CSSProperties
        }
      >
        <div className="label absolute -top-2 pointer-events-none">
          {i} / {totalSamples}
        </div>
        <SampleSlider />
      </div>
    </div>
  )
}
