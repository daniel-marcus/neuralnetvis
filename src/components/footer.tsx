import { ProgressBar } from "./progress-bar"
import { Status } from "./status"
import { NeuronStatus } from "./neuron-status"
import { SampleSlider } from "./sample-slider"

export const Footer = () => {
  return (
    <div className="fixed z-[2] bottom-0 left-0 w-[100vw] select-none pointer-events-none">
      <div className="p-main -mb-1 relative">
        <div className="flex justify-between items-end relative">
          <NeuronStatus />
          <Status />
        </div>
        <SampleSlider />
      </div>
      <ProgressBar />
    </div>
  )
}
