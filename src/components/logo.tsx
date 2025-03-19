import { useGlobalStore } from "@/store"
import { AsciiText } from "@/components/ui-elements/ascii-text"

export const Logo = () => {
  const currTab = useGlobalStore((s) => s.tab)
  const tabIsShwon = useGlobalStore((s) => s.tabIsShown)
  const mobileCrop = currTab && tabIsShwon
  return (
    <div className={`text-logo p-main hover:text-white`}>
      <AsciiText className="">Neural</AsciiText>
      {!mobileCrop && (
        <div className={`transition-opacity duration-100`}>
          <AsciiText>Net</AsciiText>
          <AsciiText>Vis</AsciiText>
        </div>
      )}
    </div>
  )
}
