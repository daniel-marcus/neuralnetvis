"use client"

import { Data } from "./data"
import { Info } from "./info"
import { Learn } from "./learn"
import { Model } from "./model"
import { Play } from "./play"
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

const _tabs: Tab[] = [
  { key: "learn", component: Learn },
  {
    key: "play",
    component: Play,
    children: [
      { key: "data", component: Data },
      { key: "model", component: Model },
      { key: "train", component: Train },
    ],
  },
  { key: "info", label: "i", component: Info },
]

function addParent(tab: Tab, parent?: Tab): Tab {
  const children = tab.children?.map((c) => addParent(c, tab))
  return { ...tab, parent, children }
}

export const tabs = _tabs.map((t) => addParent(t))
