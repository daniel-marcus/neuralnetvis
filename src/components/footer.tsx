import { ProgressBar } from "./progress-bar"
import { Status } from "./status"
import { NeuronStatus } from "./neuron-status"
import { useSelected } from "@/lib/neuron-select"

export const Footer = () => {
  const selected = useSelected((s) => s.selected)
  const hovered = useSelected((s) => s.hovered)
  const hasSelected = !!selected || !!hovered
  return (
    <div className="fixed z-[2] bottom-0 left-0 w-[100vw] p-[10px] sm:p-4 pb-5 sm:pb-6 select-none text-sm sm:text-base pointer-events-none">
      <div className="flex justify-between items-end">
        <NeuronStatus />
        <div className={`${hasSelected ? "invisible sm:visible" : ""}`}>
          <Status />
        </div>
      </div>
      <ProgressBar />
    </div>
  )
}
