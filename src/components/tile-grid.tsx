"use client"

import React, { ReactNode, useEffect, useRef, useState } from "react"
import { datasets } from "@/data/datasets"
import { useDrag } from "@use-gesture/react"
import { lessonPreviews } from "@/contents"
import { usePathname, useRouter } from "next/navigation"
import { useHasLesson } from "./lesson"
import { useGlobalStore } from "@/store"
import { SceneViewer } from "./scene-viewer"
import { InitialState } from "@/utils/initial-state"
import { Footer } from "./footer"
import { SectionIntro } from "./section-intro"
import { getDsPath } from "@/data/dataset"
import { cameraSvg } from "./video"

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
}

const tiles: TileDef[] = [
  ...lessonPreviews.map((l) => ({
    ...l,
    // isFeatured: true,
    section: "learn" as const,
    tags: ["lesson"],
    shouldLoadFullDs: true,
  })),
  ...datasets.map((dsDef) => ({
    path: getDsPath(dsDef),
    title: dsDef.name,
    tags: dsDef.hasCam ? [cameraSvg, "dataset"] : ["dataset"],
    section: "play" as const,
    dsKey: dsDef.key,
    disabled: dsDef.disabled,
  })),
]

export const TileGrid = () => {
  const active = usePathname()
  const lastActive = useLast(active)
  const hasLesson = useHasLesson()
  const hasActive = useHasActiveTile()
  const isDebug = useGlobalStore((s) => s.isDebug)
  const section = useSection()
  return (
    <div
      className={`top-[var(--logo-height)] left-0 w-screen ${
        hasLesson ? "fixed" : "absolute"
      }`}
      style={
        {
          "--tile-width": "320px",
          "--tile-height": "420px",
          "--gap": "2rem",
          "--tile-duration": "0.5s",
        } as React.CSSProperties
      }
    >
      <div className="w-[var(--tile-width)] sm:w-[calc(2*var(--tile-width)+var(--gap))] lg:w-[calc(3*var(--tile-width)+2*var(--gap))] mx-auto flex flex-col min-h-[calc(100dvh-120px)] px-[var(--padding-main)] xs:px-0">
        <SectionIntro
          className={hasActive ? "opacity-0 pointer-events-none" : ""}
        />
        <div className="flex-grow grid grid-cols-[repeat(1,var(--tile-width))] sm:grid-cols-[repeat(2,var(--tile-width))] lg:grid-cols-[repeat(3,var(--tile-width))] justify-center gap-[var(--gap)]">
          {tiles
            .filter(({ disabled }) => !disabled || isDebug)
            .map((tileProps) => {
              const isActive = tileProps.path === active
              return (
                <Tile
                  key={tileProps.path}
                  isActive={isActive}
                  {...tileProps}
                  className={`${hasActive && !isActive ? "opacity-0" : ""} ${
                    !!section && tileProps.section !== section ? "hidden" : ""
                  } ${tileProps.path === lastActive ? "z-5" : ""}`}
                >
                  <SceneViewer isActive={isActive} {...tileProps} />
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

  const router = useRouter()
  const bind = useDrag(({ tap }) => {
    // allows touch scroll + drag rotate for scene + tap to expand
    if (tap && !isActive) router.push(props.path)
  })

  const [localActive, setLocalActive] = useState(false)
  useEffect(() => {
    const { x, y } = ref.current?.getBoundingClientRect() ?? { x: 0, y: 0 }
    ref.current?.style.setProperty("--offset-x", `${x}px`)
    ref.current?.style.setProperty("--offset-y", `${y}px`)
    setLocalActive(!!isActive)
  }, [isActive])

  const style = isFeatured ? { "--tile-width": "calc(640px+var(--gap))" } : {}

  return (
    <div
      ref={ref}
      className={`relative h-[var(--tile-height)] group/tile ${
        !isActive ? "cursor-pointer" : ""
      } ${props.isFeatured ? "sm:col-span-2" : ""} ${className}`}
      {...bind()}
      style={style as React.CSSProperties}
    >
      <div
        className={`rounded-box bg-background overflow-hidden origin-center flex items-center justify-center ${
          localActive
            ? "fixed inset-0 w-screen h-[100dvh] z-10 border-transparent!"
            : "relative w-[var(--tile-width)] h-[var(--tile-height)]"
        } ${
          isActive === localActive
            ? "[transition-property:all,border-color] [transition-duration:var(--tile-duration),0s] ease-in-out"
            : isActive && !localActive
            ? "translate-x-[var(--offset-x)] translate-y-[var(--offset-y)]"
            : "-translate-x-[var(--offset-x)] -translate-y-[var(--offset-y)] z-5"
        } border-2 border-box-bg ${
          isActive ? "border-transparent!" : "group-hover/tile:border-accent"
        } `}
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
  const pathname = usePathname()
  const splits = pathname.split("/")
  return splits.length === 2 ? splits[1] : ""
}

function useLast<T>(value: T) {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref.current
}
