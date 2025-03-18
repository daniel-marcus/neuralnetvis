import { useGlobalStore } from "@/store"
import { AsciiText } from "@/components/ui-elements/ascii-text"

export const Logo = () => {
  const currTab = useGlobalStore((s) => s.tab)
  const tabIsShwon = useGlobalStore((s) => s.tabIsShown)
  const mobileCrop = currTab && tabIsShwon
  return (
    <div
      className={`text-logo p-main hover:text-white transition-colors duration-100 h-[112px] ${
        mobileCrop ? "max-h-[40px] overflow-clip sm:max-h-none" : ""
      }`}
    >
      <AsciiText>Neural</AsciiText>
      <div
        className={`transition-opacity duration-100 ${
          mobileCrop
            ? "opacity-0 pointer-events-none sm:opacity-100 sm:pointer-events-auto"
            : ""
        }`}
      >
        <AsciiText>Net</AsciiText>
        <AsciiText>Vis</AsciiText>
      </div>
    </div>
  )
}
