import { useMemo } from "react"
import figlet, { Fonts } from "figlet"
import { blurVision } from "../lib/figlet-fonts"

const MAX_CHARS_PER_LINE = 10

figlet.parseFont("Blur Vision ASCII", blurVision)
export const useAsciiText = (input: string) => {
  return useMemo(() => {
    const textWithLineBreaks = splitWithThreshold(input).join("\n")
    return figlet
      .textSync(textWithLineBreaks, {
        font: "Blur Vision ASCII" as Fonts,
      })
      .replace(/[░▒]/g, " ")
      .replace(/^.{2}/gm, "")
  }, [input])
}

function splitWithThreshold(str: string, threshold = MAX_CHARS_PER_LINE) {
  return str.split(" ").reduce((acc, word) => {
    const lastChunk = acc[acc.length - 1] || ""
    const newChunk = lastChunk ? `${lastChunk} ${word}` : word
    return newChunk.length <= threshold
      ? [...acc.slice(0, -1), newChunk]
      : [...acc, word]
  }, [] as string[])
}
