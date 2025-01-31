import { useRef, useEffect } from "react"
import { create } from "zustand"

export const useStatusText = create<{
  percent: number | undefined
  setPercent: (p: number | undefined) => void
  statusText: string | null
  setStatusText: (t: string, percent?: number) => void
}>((set) => ({
  percent: undefined, // -1 for spinner mode
  setPercent: (percent: number | undefined) => set({ percent }),
  statusText: null,
  setStatusText: (newText: string | null, percent?: number) =>
    set({ statusText: newText, percent }),
}))

export const Status = () => {
  const statusText = useStatusText((s) => s.statusText)
  const keptText = useRef<string>("")
  useEffect(() => {
    if (statusText !== null) {
      keptText.current = statusText
    }
  }, [statusText])
  return (
    <div
      className={`max-w-[50vh] ml-auto text-right ${
        !!statusText ? "opacity-100 duration-0" : "opacity-0 duration-300"
      } transition-opacity ease-in-out`}
      dangerouslySetInnerHTML={{ __html: statusText || keptText.current }}
    />
  )
}
