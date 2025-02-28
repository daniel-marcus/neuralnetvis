import type { ReactNode } from "react"
import type { StateCreator } from "zustand"
import type { TableProps } from "@/components/ui-elements/table"

const DISPLAY_TIME = 5 // seconds

interface Status {
  id: string
  text: TableProps | ReactNode
  percent: undefined | number | null
}

export interface StatusSlice {
  status: {
    stack: Status[]
    update: (
      text: TableProps | ReactNode,
      percent?: number | null,
      id?: Status["id"]
    ) => Status["id"]
    clear: (id: string) => void
    getPercent: () => number | null
    getText: () => TableProps | ReactNode
  }
}

export const createStatusSlice: StateCreator<StatusSlice> = (set, get) => ({
  status: {
    stack: [],
    update: (text, percent, _id) => {
      const id = _id ?? uid()
      const newStatus = { id, text, percent }
      if (!percent || percent === 1) {
        setTimeout(() => {
          get().status.clear(id)
        }, DISPLAY_TIME * 1000)
      }
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
    getText: () => {
      const stack = get().status.stack
      const spinningStatus = stack.findLast((s) => s.percent === -1)
      return spinningStatus?.text ?? stack.at(-1)?.text
    },
  },
})

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}
