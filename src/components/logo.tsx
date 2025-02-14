import { useStore } from "@/store"
import { useAsciiText } from "@/utils/ascii-text"

export const Logo = () => {
  const currTab = useStore((s) => s.tab)
  const isShown = useStore((s) => s.tabIsShown)
  const neural = useAsciiText("Neural")
  const net = useAsciiText("Net")
  const vis = useAsciiText("Vis")
  return (
    <div
      className={`text-logo hover:text-white transition-colors duration-100 h-[112px]`}
    >
      <pre>{neural}</pre>
      <div
        className={`transition-opacity duration-100 ${
          currTab && isShown ? "opacity-0 sm:opacity-100" : ""
        }`}
      >
        <pre>{net}</pre>
        <pre>{vis}</pre>
      </div>
    </div>
  )
}
