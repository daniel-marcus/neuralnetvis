import Link from "next/link"
import { AsciiText } from "@/components/ui-elements/ascii-text"
import { useIsPlayMode } from "./tab-menu"
import { useHasLesson } from "./lesson"
import { useIsCoverOpen } from "./cover/cover"
import { useDomRefs } from "@/utils/dom-refs"

export const Logo = () => {
  const isPlayMode = useIsPlayMode()
  const hasLesson = useHasLesson()
  const isCoverOpen = useIsCoverOpen()
  const { logoRef } = useDomRefs()
  return (
    <Link
      ref={logoRef}
      href={"/"}
      prefetch={false}
      className={`pointer-events-auto text-logo p-main hover:text-white active:text-white ${
        isPlayMode ? "screenshot:hidden" : !hasLesson ? "screenshot:scale-150 origin-top-left" : ""
      } ${isCoverOpen ? "opacity-0" : ""}`} // the logo of the cover takes its place when leaving
      scroll={hasLesson}
    >
      <AsciiText>{isPlayMode ? "../" : "Neural"}</AsciiText>
      {!isPlayMode && (
        <div className={`transition-opacity duration-100`}>
          <AsciiText>Net</AsciiText>
          <AsciiText>Vis</AsciiText>
        </div>
      )}
    </Link>
  )
}
