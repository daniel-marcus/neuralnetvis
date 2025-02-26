import type { StateCreator } from "zustand"
import { tabs, type Tab } from "@/components/tabs"

const allTabs = tabs.flatMap((t) => [t, ...(t.children ?? [])])
const tabMap = new Map(allTabs.map((t) => [t.key, t]))

export interface TabsSlice {
  tabIsShown: boolean
  tab: Tab | null
  setTab: (key: string | null) => void
  toggleTab: (key: string) => void
}

export const createTabsSlice: StateCreator<TabsSlice> = (set) => ({
  tabIsShown: true,
  tab: null,
  toggleTab: (key) =>
    set(({ tab, tabIsShown }) => {
      if (tab?.key === key) return { tab, tabIsShown: !tabIsShown }
      return {
        tab: key ? tabMap.get(key) ?? null : null,
        tabIsShown: true,
      }
    }),
  setTab: (key) =>
    set({ tab: key ? tabMap.get(key) ?? null : null, tabIsShown: true }),
})
