import { useAsciiText } from "@/lib/ascii-text"
import { useTabStore } from "./menu"

export const Logo = () => {
  const currTab = useTabStore((s) => s.currTab)
  const isShown = useTabStore((s) => s.isShown)
  const hasTab = currTab && isShown
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
          hasTab ? "opacity-0 sm:opacity-100" : ""
        }`}
      >
        <pre>{net}</pre>
        <pre>{vis}</pre>
      </div>
    </div>
  )
}
