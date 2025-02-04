import { ProgressBar } from "../ui-components/progress-bar"
import { Status, useStatusText } from "./status"
import { NeuronStatus } from "./neuron-status"
import { useSelected } from "@/lib/neuron-select"
import { SampleSlider } from "@/tabs/data"
import { useTrainingStore } from "@/lib/training"
import { useDatasetStore } from "@/lib/datasets"

export const Footer = () => {
  const selected = useSelected((s) => s.selected)
  const hovered = useSelected((s) => s.hovered)
  const hasSelected = !!selected || !!hovered
  const hasStatus = !!useStatusText((s) => s.statusText)
  const isTraining = useTrainingStore((s) => s.isTraining)
  const i = useDatasetStore((s) => s.i)
  const totalSamples = useDatasetStore((s) => s.totalSamples)
  return (
    <div className="fixed  z-[2] bottom-0 left-0 w-[100vw] p-main pb-5! sm:pb-6! select-none text-sm sm:text-base pointer-events-none">
      <div className="flex justify-between items-end">
        <NeuronStatus />
        <div className={`${hasSelected ? "invisible sm:visible" : ""}`}>
          <Status />
        </div>
      </div>
      <div className="absolute bottom-0 left-0 p-main pb-5! w-full flex justify-center">
        <div
          className={`sm:max-w-[380px] pointer-events-auto ${
            isTraining
              ? "opacity-0 pointer-events-none"
              : hasStatus || hasSelected
              ? "opacity-0 pointer-events-none sm:opacity-30 sm:pointer-events-auto  sm:hover:opacity-50"
              : "opacity-30 sm:hover:opacity-50"
          } transition-opacity duration-200 `}
        >
          <div className="label">
            {i} / {totalSamples}
          </div>
          <SampleSlider />
        </div>
      </div>
      <ProgressBar />
    </div>
  )
}
