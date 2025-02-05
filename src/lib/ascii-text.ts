import { useMemo } from "react"
import figlet, { Fonts } from "figlet"
import { blurVision } from "../lib/figlet-fonts"

figlet.parseFont("Blur Vision ASCII", blurVision)
export const useAsciiText = (input: string) => {
  return useMemo(() => {
    const textWithLineBreaks = input.split(" ").join("\n")
    return figlet
      .textSync(textWithLineBreaks, {
        font: "Blur Vision ASCII" as Fonts,
      })
      .replaceAll("░", " ") // reduce blur
  }, [input])
}
