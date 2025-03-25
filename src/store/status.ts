import type { ReactNode } from "react"
import type { StateCreator } from "zustand"
import type { TableProps } from "@/components/ui-elements/table"

const DEFAULT_DURATION = 5

interface Status {
  id: string
  text: TableProps | ReactNode
  percent: undefined | number | null
  fullscreen?: boolean
  permanent?: boolean
  duration?: number // display time in seconds
  timer?: NodeJS.Timeout
}

export interface StatusSlice {
  status: {
    stack: Status[]
    update: (
      text: TableProps | ReactNode,
      percent?: number | null,
      opts?: Partial<Omit<Status, "text" | "percent" | "timer">>
    ) => Status["id"]
    clearTimer: (id: string) => void
    clear: (id: string) => void
    getPercent: () => number | null
    getCurrent: () => Status | undefined
    reset: () => void
  }
}

export const createStatusSlice: StateCreator<StatusSlice> = (set, get) => ({
  status: {
    stack: [],
    update: (text, percent, opts = {}) => {
      const id = opts.id ?? uid()
      if (opts.id) get().status.clearTimer(id)
      const duration = (opts.duration ?? DEFAULT_DURATION) * 1000
      const expires =
        !opts.permanent &&
        (typeof percent !== "number" || (percent === 1 && !opts.id))
      let timer: NodeJS.Timeout | undefined
      if (expires) {
        timer = setTimeout(() => get().status.clear(id), duration)
      }
      const newStatus = { ...opts, id, text, percent, timer }
      set(({ status }) => ({
        status: {
          ...status,
          stack: [...status.stack.filter((s) => s.id !== id), newStatus],
        },
      }))
      return id
    },
    clearTimer: (id) => {
      const oldStatus = get().status.stack.find((s) => s.id === id)
      if (oldStatus?.timer) clearTimeout(oldStatus.timer)
    },
    clear: (id) => {
      get().status.clearTimer(id)
      set(({ status }) => ({
        status: {
          ...status,
          stack: status.stack.filter((s) => s.id !== id),
        },
      }))
    },
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
    reset: () => {
      get().status.stack.forEach((s) => get().status.clear(s.id))
      set(({ status }) => ({ status: { ...status, stack: [] } }))
    },
  },
})

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}
