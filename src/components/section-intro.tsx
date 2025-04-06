import { ReactNode } from "react"
import { useSection } from "./tile-grid"
import { metadata, learnMetadata, playMetadata } from "@/app/metadata"

const introTexts = {
  learn: learnMetadata.description,
  play: playMetadata.description,
  "": metadata.description,
} as Record<string, ReactNode>

export const SectionIntro = ({ className = "" }) => {
  const section = useSection()
  return (
    <div className={`py-16 screenshot:opacity-0 screenshot:py-8 ${className}`}>
      {introTexts[section] ?? ""}
    </div>
  )
}
