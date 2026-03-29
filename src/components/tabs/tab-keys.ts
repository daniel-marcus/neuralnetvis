import type { ReactElement } from "react"

export type Tab = {
  key: string
  slug?: string
  label?: string
  component?: () => ReactElement
  isDefault?: boolean
  children?: Tab[]
  parent?: Tab
}

const _rootTabs: Tab[] = [
  { key: "learn", slug: "learn" },
  { key: "play", slug: "play" },
]

const _playTabs: Tab[] = [{ key: "data" }, { key: "model" }, { key: "train" }]

function addParent(tab: Tab, parent?: Tab): Tab {
  const children = tab.children?.map((c) => addParent(c, tab))
  return { ...tab, parent, children }
}

export const rootTabs = _rootTabs.map((t) => addParent(t))
export const playTabs = _playTabs.map((t) => addParent(t))
