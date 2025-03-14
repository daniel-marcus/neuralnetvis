"use client"

import { Data } from "./data"
import { Model } from "./model"
import { Train } from "./train"

export type Tab = {
  key: string
  slug?: string
  label?: string
  component?: () => React.ReactElement
  isDefault?: boolean
  children?: Tab[]
  parent?: Tab // will be added in addParent
}

const _rootTabs: Tab[] = [
  { key: "learn", slug: "learn" },
  { key: "play", slug: "play" },
]

const _playTabs: Tab[] = [
  { key: "data", component: Data },
  { key: "model", component: Model },
  { key: "train", component: Train },
]

function addParent(tab: Tab, parent?: Tab): Tab {
  const children = tab.children?.map((c) => addParent(c, tab))
  return { ...tab, parent, children }
}

export const rootTabs = _rootTabs.map((t) => addParent(t))
export const playTabs = _playTabs.map((t) => addParent(t))
