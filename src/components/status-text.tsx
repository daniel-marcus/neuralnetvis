import { useRef, useEffect } from "react"
import { create } from "zustand"
import { ProgressBar } from "./progress-bar"

export const useStatusText = create<{
  percent: number | undefined
  statusText: string
  setStatusText: (t: string, percent?: number) => void
}>((set) => ({
  percent: undefined,
  statusText: "",
  setStatusText: (newText: string, percent?: number) =>
    set({ statusText: newText, percent }),
}))

export const StatusText = () => {
  const statusText = useStatusText((s) => s.statusText)
  const percent = useStatusText((s) => s.percent)
  const keptText = useRef<string>("")
  useEffect(() => {
    if (statusText) {
      keptText.current = statusText
    }
  }, [statusText])
  return (
    <div
      className={`fixed z-[2] bottom-0 right-0 text-right w-[100vw] p-[10px] sm:p-4 select-none text-sm sm:text-base ${
        !!statusText ? "opacity-100 duration-0" : "opacity-100 duration-300"
      } transition-opacity ease-in-out pointer-events-none`}
    >
      <div
        className="max-w-[50vh] ml-auto"
        dangerouslySetInnerHTML={{ __html: statusText || keptText.current }}
      />
      <div className="w-full">
        <ProgressBar percent={percent} />
      </div>
    </div>
  )
}
