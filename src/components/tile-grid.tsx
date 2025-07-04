"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useDrag } from "@use-gesture/react"
import { datasets } from "@/data/datasets"
import { lessonPreviews } from "@/contents"
import { usePathname, useRouter } from "next/navigation"
import { useGlobalStore } from "@/store"
import { SectionIntro } from "./section-intro"
import { Footer } from "./footer"
import { SceneViewer } from "@/scene-views/scene-viewer"
import { getDsPath } from "@/data/dataset"
import { cameraSvg } from "@/scene-views/video"
import { useLast } from "@/utils/helpers"
import { useIsScreen } from "@/utils/screen"
import { useHasLesson } from "./lesson"
import type { ReactNode, CSSProperties } from "react"
import type { InitialState } from "@/utils/initial-state"
import type { DatasetDef } from "@/data"

export type Section = "learn" | "play"
const sections = ["learn", "play"] as const

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
}

const tiles: TileDef[] = [
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
  })),
]

function getTags(dsDef: DatasetDef) {
  const tags: ReactNode[] = []
  if (dsDef.camProps) tags.push(cameraSvg)
  tags.push(dsDef.isModelDs ? "model" : "dataset")
  return tags
}

export const TileGrid = () => {
  const active = usePathname()
  const hasActive = useHasActiveTile()
  const lastActive = useLast(hasActive ? active : undefined)
  const isDebug = useGlobalStore((s) => s.isDebug)
  const section = useSection()
  const is404 = useIs404()
  const hasLesson = useHasLesson()
  const isDesktop = useIsScreen("md") // TODO: better check for device capabilities?
  if (is404) return null
  return (
    <div
      className={`tile-grid [--gap:1rem] xl:[--gap:2rem] ${
        hasLesson ? "absolute" : ""
      }`}
      style={
        {
          "--tile-width": "320px",
          "--tile-height": "420px",
        } as CSSProperties
      }
    >
      <div
        className={`w-[var(--tile-width)] sm:w-[calc(2*var(--tile-width)+var(--gap))] lg:w-[calc(3*var(--tile-width)+2*var(--gap))] mx-auto flex flex-col min-h-[calc(100dvh-120px)] px-[var(--padding-main)] xs:px-0`}
      >
        <SectionIntro
          className={hasActive ? "hidden pointer-events-none" : ""}
        />
        <div
          className={`flex-grow grid grid-cols-[repeat(1,var(--tile-width))] sm:grid-cols-[repeat(2,var(--tile-width))] lg:grid-cols-[repeat(3,var(--tile-width))] justify-center gap-[var(--gap)] grid-flow-dense`}
        >
          {tiles // [...tiles, ...tiles, ...tiles]
            .filter(({ disabled }) => !disabled || isDebug)
            .filter(({ targetDevice, path }) =>
              targetDevice && path !== active
                ? isDesktop
                  ? targetDevice === "desktop"
                  : targetDevice === "mobile"
                : true
            )
            // .slice(0, 3)
            .map((tileProps, i) => {
              const isActive = tileProps.path === active
              const wasLastActive = tileProps.path === lastActive
              return (
                <Tile
                  key={tileProps.path}
                  isActive={isActive}
                  {...tileProps}
                  className={`${hasActive && !isActive ? "opacity-0" : ""} ${
                    !!section && tileProps.section !== section ? "hidden" : ""
                  } ${wasLastActive ? "z-5" : ""}`}
                >
                  <SceneViewer
                    isActive={isActive}
                    {...tileProps}
                    tileIdx={wasLastActive ? 99 : i}
                  />
                  {!isActive && <Tags {...tileProps} />}
                </Tile>
              )
            })}
        </div>
        <Footer className={hasActive ? "opacity-0 pointer-events-none" : ""} />
      </div>
    </div>
  )
}

interface TileProps {
  path: string
  children: ReactNode
  isActive?: boolean
  isFeatured?: boolean
  className?: string
}

function Tile(props: TileProps) {
  const { isActive, className, children, isFeatured } = props
  const ref = useRef<HTMLDivElement>(null)

  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const setOffsetFromWrapper = useCallback(() => {
    const rect = ref.current?.getBoundingClientRect()
    const { x, y } = rect ?? { x: 0, y: 0 }
    setOffset({ x, y })
  }, [])

  const router = useRouter()
  const bind = useDrag(({ tap, event }) => {
    // allows touch scroll + drag rotate for scene + tap to expand
    if (tap && !isActive) {
      if (event.target instanceof HTMLButtonElement) return
      setOffsetFromWrapper()
      useGlobalStore.setState({ scrollPos: window.scrollY })
      router.push(props.path, { scroll: true })
    }
  })

  const [localActive, setLocalActive] = useState(isActive)
  const [inTransition, setInTransition] = useState(false)
  useEffect(() => {
    if (!isActive) setOffsetFromWrapper()
    setLocalActive(!!isActive)
    setInTransition(true)
    setTimeout(() => setInTransition(false), getTileDuration())
  }, [isActive, setOffsetFromWrapper])

  return (
    <div
      ref={ref}
      className={`relative h-[var(--tile-height)] group/tile ${
        !isActive ? "cursor-pointer" : ""
      } ${props.isFeatured ? "sm:col-span-2" : ""} ${className}`}
      {...(!isActive ? bind() : {})}
      style={
        {
          "--offset-x": `${offset.x}px`,
          "--offset-y": `${offset.y}px`,
          "--tile-width": isFeatured ? "calc(640px+var(--gap))" : undefined,
        } as CSSProperties
      }
    >
      <div
        className={`tile-inner rounded-box overflow-hidden origin-center ${
          localActive
            ? "fixed inset-0 w-screen h-[100dvh] z-10"
            : "relative w-[var(--tile-width)] h-[var(--tile-height)]"
        } ${
          isActive === localActive
            ? "[transition-property:all,border-color] [transition-duration:var(--tile-duration),0s] ease-in-out"
            : isActive && !localActive
            ? "translate-x-[var(--offset-x)] translate-y-[var(--offset-y)]"
            : "-translate-x-[var(--offset-x)] -translate-y-[var(--offset-y)] z-5"
        } border-2 ${
          isActive || inTransition
            ? "border-transparent! border-0!"
            : "border-box group-hover/tile:border-accent"
        }`}
      >
        {children}
      </div>
    </div>
  )
}

const Tags = ({ tags, section }: { tags: ReactNode[]; section: Section }) => (
  <div
    className={`absolute ${
      section === "learn" ? "top-0" : "bottom-0"
    } right-0 pointer-events-none p-4 mb-4 flex flew-wrap gap-4 items-center justify-end`}
  >
    {(tags ?? []).map((tag, i) => (
      <span key={i} className="brightness-25">
        {tag}
      </span>
    ))}
  </div>
)

export function useHasActiveTile() {
  const pathname = usePathname()
  return tiles.some(({ path }) => path === pathname)
}

export function useSection() {
  // only for overview pages /learn and /play
  const pathname = usePathname()
  const splits = pathname.split("/")
  return splits.length === 2 ? splits[1] : ""
}

function useIs404() {
  const hasActive = useHasActiveTile()
  const section = useSection()
  const pathname = usePathname()
  return (
    pathname !== "/" &&
    !hasActive &&
    (!section || !sections.includes(section as Section))
  )
}

export function getTileDuration() {
  const s = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(
      "--tile-duration"
    )
  )
  const ms = s * 1000
  if (!ms) console.warn("--tile-duration not set!", ms)
  return ms
}
