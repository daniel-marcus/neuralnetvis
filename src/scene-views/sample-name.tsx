import { useMemo } from "react"
import { useSceneStore } from "@/store"
import { AsciiText } from "@/components/ui-elements"
import { splitWithThreshold } from "@/components/ui-elements/ascii-text"

export function SampleName() {
  const isActive = useSceneStore((s) => s.isActive)
  const sampleName = useSceneStore((s) => s.sample?.name)
  const rows = useMemo(
    () => splitWithThreshold(sampleName ?? "", 9),
    [sampleName]
  )
  if (!sampleName) return null
  return (
    <div
      className={`absolute top-0 w-full h-full p-4 pointer-events-none flex items-end justify-end pb-24 ${
        isActive ? "pb-30 sm:items-center sm:justify-start sm:pb-4" : ""
      } transition-opacity duration-200`}
    >
      <div
        className={`text-right ${
          isActive ? "text-[min(0.75vw,0.25rem)] sm:text-left" : "text-[2px]"
        } brightness-25`}
      >
        {rows.map((row, i) => (
          <AsciiText key={i}>{row}</AsciiText>
        ))}
      </div>
    </div>
  )
}
