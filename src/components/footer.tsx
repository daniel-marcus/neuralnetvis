import { ProgressBar } from "./progress-bar"
import { Status } from "./status"
import { NeuronStatus } from "./neuron-status"
import { useSelected } from "@/lib/neuron-select"

export const Footer = () => {
  const selected = useSelected((s) => s.selected)
  const hovered = useSelected((s) => s.hovered)
  const hasSelected = !!selected || !!hovered
  return (
    <div className="fixed z-[2] bottom-0 right-0 w-[100vw] p-[10px] sm:p-4 select-none text-sm sm:text-base pointer-events-none">
      <div className="flex justifiy-between items-end">
        <NeuronStatus />
        <div
          className={`text-right w-full ${
            hasSelected ? "hidden sm:block" : ""
          }`}
        >
          <Status />
        </div>
      </div>
      <ProgressBar />
    </div>
  )
}
