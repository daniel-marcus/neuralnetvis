import { useRef, useEffect, ReactNode } from "react"
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

export const Status = ({ children }: { children?: ReactNode }) => {
  const statusText = useStatusText((s) => s.statusText)
  const keptText = useRef<string>("")
  useEffect(() => {
    if (statusText !== null) {
      keptText.current = statusText
    }
  }, [statusText])
  return (
    <div
      className={`fixed z-[2] bottom-0 right-0 w-[100vw] p-[10px] sm:p-4 select-none text-sm sm:text-base ${
        !!statusText ? "opacity-100 duration-0" : "opacity-0 duration-300"
      } transition-opacity ease-in-out pointer-events-none`}
    >
      <div
        className="max-w-[50vh] ml-auto text-right"
        dangerouslySetInnerHTML={{ __html: statusText || keptText.current }}
      />
      <div className="w-full">{children}</div>
    </div>
  )
}
