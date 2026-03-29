"use client"

import { Data } from "./data"
import { Model } from "./model"
import { Train } from "./train"
import { rootTabs as _rootTabs, playTabs as _playTabs } from "./tab-keys"

export type { Tab } from "./tab-keys"

export const rootTabs = _rootTabs

const componentMap: Record<string, () => React.ReactElement> = {
  data: Data,
  model: Model,
  train: Train,
}

export const playTabs = _playTabs.map((t) => ({
  ...t,
  component: componentMap[t.key],
}))
