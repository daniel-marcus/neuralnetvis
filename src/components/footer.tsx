import { ProgressBar } from "./progress-bar"
import { Status } from "./status"
import { WeightsMap } from "./weights-map"

export const Footer = () => (
  <div className="fixed z-[2] bottom-0 right-0 w-[100vw] p-[10px] sm:p-4 select-none text-sm sm:text-base pointer-events-none">
    <div className="flex justifiy-between items-end">
      <WeightsMap />
      <Status />
    </div>
    <ProgressBar />
  </div>
)
