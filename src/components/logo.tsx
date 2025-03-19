import { AsciiText } from "@/components/ui-elements/ascii-text"
import { useIsPlayMode } from "./header"

export const Logo = () => {
  const isPlayMode = useIsPlayMode()
  return (
    <div className={`text-logo p-main hover:text-white`}>
      <AsciiText className="">{isPlayMode ? "../" : "Neural"}</AsciiText>
      {!isPlayMode && (
        <div className={`transition-opacity duration-100`}>
          <AsciiText>Net</AsciiText>
          <AsciiText>Vis</AsciiText>
        </div>
      )}
    </div>
  )
}
