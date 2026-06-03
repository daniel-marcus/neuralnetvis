import { usePathname } from "next/navigation"
import { datasets } from "@/data/datasets"
import { lessonPreviews } from "@/contents"
import { getDsPath } from "@/data/dataset"
import { cameraSvg } from "@/scene-views/video"
import type { ReactNode } from "react"
import type { InitialState } from "@/utils/initial-state"
import type { DatasetDef } from "@/data"

export type Section = "learn" | "play"

export interface TileDef {
  path: string
  title: string
  tags: ReactNode[]
  section: Section
  dsKey?: string
  isFeatured?: boolean
  disabled?: boolean
  initialState?: InitialState
  shouldLoadFullDs?: boolean
  isLargeModel?: boolean // don't expand hidden layers by default
  targetDevice?: DatasetDef["targetDevice"]
  hasDraw?: boolean
}

function getTags(dsDef: DatasetDef) {
  const tags: ReactNode[] = []
  if (dsDef.camProps) tags.push(cameraSvg)
  tags.push(dsDef.isModelDs ? "model" : "dataset")
  return tags
}

export const tiles: TileDef[] = [
  ...lessonPreviews.map((l) => ({
    ...l,
    section: "learn" as const,
    tags: ["lesson"],
    shouldLoadFullDs: true,
  })),
  ...datasets.map((dsDef) => ({
    path: getDsPath(dsDef),
    title: dsDef.name,
    isFeatured: dsDef.isFeatured,
    tags: getTags(dsDef),
    section: "play" as const,
    dsKey: dsDef.key,
    disabled: dsDef.disabled,
    isLargeModel: dsDef.model?.lazyLoadWeights,
    targetDevice: dsDef.targetDevice,
    hasDraw: !!dsDef.drawOptions,
  })),
]

export function useHasActiveTile() {
  const pathname = usePathname()
  return tiles.some(({ path }) => path === pathname)
}

export function getTileDuration() {
  const s = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--tile-duration"),
  )
  const ms = s * 1000
  if (!ms) console.warn("--tile-duration not set!", ms)
  return ms
}
