import React, { useRef, useEffect, ReactNode, useMemo } from "react"
import { create } from "zustand"

const DISPLAY_TIME = 5 // seconds
let timeout: NodeJS.Timeout

interface StatusStore {
  percent: number | null
  setPercent: (p: number | null) => void
  statusText: TableProps | ReactNode
  setStatusText: (t: TableProps | ReactNode, percent?: number | null) => void
}

export const useStatusStore = create<StatusStore>((set) => ({
  percent: null, // -1 for spinner mode
  setPercent: (percent: number | null) => set({ percent }),
  statusText: null,
  setStatusText: (newText: TableProps | ReactNode, percent?: number | null) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      set(() => ({ statusText: null }))
      clearTimeout(timeout)
    }, DISPLAY_TIME * 1000)
    set(({ percent: oldPercent }) => ({
      statusText: newText,
      percent: typeof percent !== "undefined" ? percent : oldPercent,
    }))
  },
}))

export const Status = () => {
  const statusText = useStatusStore((s) => s.statusText)
  const parsedText = useMemo(
    () =>
      isValidReactNode(statusText) ? statusText : <Table {...statusText} />,
    [statusText]
  )
  const keptText = useRef<ReactNode>("")
  useEffect(() => {
    if (parsedText !== null) {
      keptText.current = parsedText
    }
  }, [parsedText])
  return (
    <div
      className={`absolute right-0 bottom-0 sm:relative lg:max-w-[33vw] ml-auto ${
        !!statusText
          ? "opacity-100 duration-0 pointer-events-auto"
          : "opacity-0 duration-300 pointer-events-none"
      } transition-opacity ease-in-out text-right`}
    >
      {parsedText || keptText.current}
    </div>
  )
}

function isValidReactNode(node: unknown): node is ReactNode {
  return (
    node === null ||
    node === undefined ||
    React.isValidElement(node) ||
    typeof node === "string" ||
    typeof node === "number" ||
    Array.isArray(node)
  )
}

export type TableProps = {
  data: Record<string, ReactNode>
  title?: string
  keyAlign?: "left" | "right"
  valueAlign?: "left" | "right"
}

export const Table = ({
  data,
  title,
  keyAlign = "left",
  valueAlign = "right",
}: TableProps) => (
  <table className="table-auto w-full">
    {!!title && <caption className="whitespace-nowrap">{title}</caption>}
    <tbody>
      {Object.entries(data).map(([key, value]) => (
        <tr key={key}>
          <td
            className={`text-${keyAlign} align-top ${
              typeof value === "undefined" ? "opacity-50" : ""
            } pr-4`}
          >
            {key}
          </td>
          <td className={`align-top text-${valueAlign} break-words`}>
            {value}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
)
