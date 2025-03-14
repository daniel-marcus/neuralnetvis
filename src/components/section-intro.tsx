import { ReactNode } from "react"
import { useSection } from "./tile-grid"

const introTexts = {
  play: "Play with neural networks: Pick a dataset, then adjust and train your model",
  default: "Wrap your head around neural networks and watch machines learn!",
} as Record<string, ReactNode>

export const SectionIntro = ({ className = "" }) => {
  const section = useSection()
  return (
    <div className={`mb-16 ${className}`}>
      {introTexts[section] ?? introTexts.default}
    </div>
  )
}
