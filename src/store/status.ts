import type { ReactNode } from "react"
import type { StateCreator } from "zustand"
import type { TableProps } from "@/components/ui-elements/table"

const DISPLAY_TIME = 5 // seconds
let timeout: NodeJS.Timeout

export interface StatusSlice {
  status: {
    percent: number | null
    setPercent: (p: number | null) => void
    text: TableProps | ReactNode
    setText: (t: TableProps | ReactNode, percent?: number | null) => void
  }
}

export const createStatusSlice: StateCreator<StatusSlice> = (set) => ({
  status: {
    percent: null, // -1 for spinner mode
    setPercent: (percent: number | null) =>
      set(({ status }) => ({ status: { ...status, percent } })),
    text: null,
    setText: (newText: TableProps | ReactNode, percent?: number | null) => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => {
        set(({ status }) => ({ status: { ...status, text: null } }))
        clearTimeout(timeout)
      }, DISPLAY_TIME * 1000)
      set(({ status }) => ({
        status: {
          ...status,
          text: newText,
          percent: typeof percent !== "undefined" ? percent : status.percent,
        },
      }))
    },
  },
})
