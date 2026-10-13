import { useEffect, useState, type ReactNode } from "react"
import { useSceneStore } from "@/store"

interface InputAreaProps {
  title?: ReactNode
  buttons?: ReactNode // right-aligned below the input
  children: ReactNode // the input box (w-full), e.g. canvas or textarea
}

const INTRO_DURATION = 2000 // ms, fully shown after mount before it is tucked away

// shared layout of DrawArea and TextArea: title, input box, button bar
// auto-hide: only a strip stays in the viewport, hover (or typing) reveals the full area
export const InputArea = ({ title, buttons, children }: InputAreaProps) => {
  const hasSelected = useSceneStore((s) => !!s.selectedNid) // full NeuronInspector overlaps
  const isIntro = useIsIntro()
  return (
    <div
      tabIndex={-1} // touch: tap to reveal, tap outside to tuck away
      data-intro={isIntro || undefined}
      className={`group/input-area relative hover:after:absolute hover:after:inset-0 hover:after:-right-8 hover:after:-bottom-8 hover:after:-z-10 z-20 box-content w-40 lg:w-75 pl-(--padding-main) -ml-(--padding-main) ${
        hasSelected ? "hidden" : "flex"
      } flex-col gap-2 pointer-events-auto pt-8 outline-none transition-transform duration-300 ${
        isIntro
          ? "translate-x-0"
          : "-translate-x-[calc(100%-3rem)] [@media(hover:none)]:not-focus-within:*:pointer-events-none"
      } hover:translate-x-0 has-[textarea:focus]:translate-x-0 [@media(hover:none)]:focus-within:translate-x-0`}
    >
      {!!title && <div>{title}</div>}
      {children}
      {!!buttons && (
        <div className="flex justify-end gap-2 opacity-0 transition-opacity duration-300 group-data-intro/input-area:opacity-100 group-hover/input-area:opacity-100 group-has-[textarea:focus]/input-area:opacity-100 [@media(hover:none)]:group-focus-within/input-area:opacity-100">
          {buttons}
        </div>
      )}
    </div>
  )
}

// show the full area first, so that the user knows what is behind the strip
function useIsIntro() {
  const [isIntro, setIsIntro] = useState(true)
  useEffect(() => {
    const timeout = setTimeout(() => setIsIntro(false), INTRO_DURATION)
    return () => clearTimeout(timeout)
  }, [])
  return isIntro
}
