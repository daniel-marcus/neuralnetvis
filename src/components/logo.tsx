import Link from "next/link"
import { AsciiText } from "@/components/ui-elements/ascii-text"
import { useIsPlayMode } from "./tab-menu"
import { useHasLesson } from "./lesson"

export const Logo = () => {
  const isPlayMode = useIsPlayMode()
  const hasLesson = useHasLesson()
  return (
    <Link
      href={"/"}
      prefetch={false}
      className={`pointer-events-auto text-logo p-main hover:text-white active:text-white ${
        isPlayMode
          ? "screenshot:hidden"
          : !hasLesson
          ? "screenshot:scale-150 origin-top-left"
          : ""
      }`}
      scroll={hasLesson ? true : false}
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
