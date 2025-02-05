import { useAsciiText } from "@/lib/ascii-text"
import { useTabStore } from "./menu"

export const Logo = () => {
  const currTab = useTabStore((s) => s.currTab)
  const isShown = useTabStore((s) => s.isShown)
  const hasTab = currTab && isShown
  const text = useAsciiText("Neural Net Vis")
  return (
    <pre
      className={`text-logo ${
        hasTab ? "opacity-30 sm:opacity-100" : ""
      } hover:text-white transition duration-100 origin-top-left`}
    >
      {text}
    </pre>
  )
}
