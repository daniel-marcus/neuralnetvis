import { useGlobalStore } from "@/store"
import { useAsciiText } from "@/utils/ascii-text"

export const Logo = () => {
  const currTab = useGlobalStore((s) => s.tab)
  const tabIsShwon = useGlobalStore((s) => s.tabIsShown)
  const mobileCrop = currTab && tabIsShwon
  const neural = useAsciiText("Neural")
  const net = useAsciiText("Net")
  const vis = useAsciiText("Vis")
  return (
    <div
      className={`text-logo hover:text-white transition-colors duration-100 h-[112px] ${
        mobileCrop ? "max-h-[40px] overflow-clip sm:max-h-none" : ""
      }`}
    >
      <pre>{neural}</pre>
      <div
        className={`transition-opacity duration-100 ${
          mobileCrop
            ? "opacity-0 pointer-events-none sm:opacity-100 sm:pointer-events-auto"
            : ""
        }`}
      >
        <pre>{net}</pre>
        <pre>{vis}</pre>
      </div>
    </div>
  )
}
