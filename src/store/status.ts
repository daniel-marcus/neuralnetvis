import type { ReactNode } from "react"
import type { StateCreator } from "zustand"
import type { TableProps } from "@/components/ui-elements/table"

const DISPLAY_TIME = 5 // seconds

interface Status {
  id: string
  text: TableProps | ReactNode
  percent: undefined | number | null
  fullscreen?: boolean
}

export interface StatusSlice {
  status: {
    stack: Status[]
    update: (
      text: TableProps | ReactNode,
      percent?: number | null,
      opts?: Partial<Omit<Status, "text" | "percent">>
    ) => Status["id"]
    clear: (id: string) => void
    getPercent: () => number | null
    getCurrent: () => Status | undefined
  }
}

export const createStatusSlice: StateCreator<StatusSlice> = (set, get) => ({
  status: {
    stack: [],
    update: (text, percent, opts = {}) => {
      const id = opts.id ?? uid()
      if (typeof percent !== "number" || (percent === 1 && !opts.id)) {
        setTimeout(() => {
          get().status.clear(id)
        }, DISPLAY_TIME * 1000)
      }
      const newStatus = { ...opts, id, text, percent }
      set(({ status }) => ({
        status: {
          ...status,
          stack: [...status.stack.filter((s) => s.id !== id), newStatus],
        },
      }))
      return id
    },
    clear: (id) =>
      set(({ status }) => ({
        status: {
          ...status,
          stack: status.stack.filter((s) => s.id !== id),
        },
      })),
    getPercent: () => {
      const stack = get().status.stack
      if (stack.length === 0) return null
      return (
        stack.filter((s) => typeof s.percent === "number").at(-1)?.percent ??
        null
      )
    },
    getCurrent: () => {
      const stack = get().status.stack
      const spinningStatus = stack.findLast((s) => s.percent === -1)
      return spinningStatus ?? stack.at(-1)
    },
  },
})

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}
