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
import { Title } from "@/contents/elements/head"
import { Footer } from "./footer"
import { SectionIntro } from "./section-intro"
import { getDsPath } from "@/data/dataset"
import { cameraSvg } from "./video"

export type Section = "learn" | "play"

interface TileDef {
  path: string
  title: string
  tags?: ReactNode[]
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
  const router = useRouter()
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
          "--item-width": "320px",
          "--item-height": "420px",
          "--gap": "2rem",
        } as React.CSSProperties
      }
    >
      <div className="w-[var(--item-width)] sm:w-[calc(2*var(--item-width)+var(--gap))] lg:w-[calc(3*var(--item-width)+2*var(--gap))] mx-auto flex flex-col min-h-[calc(100dvh-120px)] px-[var(--padding-main)] xs:px-0">
        <SectionIntro
          className={hasActive ? "opacity-0 pointer-events-none" : ""}
        />
        <div className="flex-grow grid grid-cols-[repeat(1,var(--item-width))] sm:grid-cols-[repeat(2,var(--item-width))] lg:grid-cols-[repeat(3,var(--item-width))] justify-center gap-[var(--gap)]">
          {tiles
            .filter(({ disabled }) => !disabled || isDebug)
            .map((tile) => {
              const isActive = tile.path === active
              return (
                <Tile
                  key={tile.path}
                  {...tile}
                  isActive={isActive}
                  onClick={!isActive ? () => router.push(tile.path) : undefined}
                  className={`${hasActive && !isActive ? "opacity-0" : ""} ${
                    !!section && tile.section !== section ? "hidden" : ""
                  } ${tile.path === lastActive ? "z-5" : ""}`}
                >
                  <SceneViewer
                    isActive={isActive}
                    dsKey={tile.dsKey}
                    initialState={tile.initialState}
                    section={tile.section}
                    shouldLoadFullDs={tile.shouldLoadFullDs}
                  />
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
  title: string
  tags?: ReactNode[]
  isActive?: boolean
  onClick?: () => void
  className?: string
  children?: ReactNode | ReactNode[]
  section: Section
  isFeatured?: boolean
}

function Tile({
  title,
  tags = [],
  isActive,
  onClick,
  className,
  children,
  section,
  isFeatured,
}: TileProps) {
  const ref = useRef<HTMLDivElement>(null)

  const bind = useDrag(({ tap }) => {
    if (tap) {
      onClick?.()
    }
  })

  const [localActive, setLocalActive] = useState(false)
  useEffect(() => {
    const { x, y } = ref.current?.getBoundingClientRect() ?? { x: 0, y: 0 }
    ref.current?.style.setProperty("--offset-x", `${x}px`)
    ref.current?.style.setProperty("--offset-y", `${y}px`)
    setLocalActive(!!isActive)
  }, [isActive])

  return (
    <div
      ref={ref}
      className={`relative ${
        onClick ? "cursor-pointer" : ""
      } h-[var(--item-height)] group/tile ${
        isFeatured ? "sm:col-span-2" : ""
      } ${className}`}
      {...bind()}
      style={
        (isFeatured
          ? { "--item-width": "calc(640px + var(--gap))" }
          : {}) as React.CSSProperties
      }
    >
      <div
        className={`rounded-box overflow-hidden origin-center flex items-center justify-center ${
          localActive
            ? "fixed inset-0 w-screen h-[100dvh] z-10"
            : "relative w-[var(--item-width)] h-[var(--item-height)]"
        } ${
          isActive === localActive
            ? "transition-all duration-500 ease-in-out"
            : isActive && !localActive
            ? "translate-x-[var(--offset-x)] translate-y-[var(--offset-y)]"
            : "-translate-x-[var(--offset-x)] -translate-y-[var(--offset-y)] z-5"
        }`}
      >
        {children}
        {!isActive && (
          <div
            className={`absolute top-0 left-0 w-full h-full p-4 rounded-box pointer-events-none flex ${
              section === "learn" ? "flex-col-reverse" : "flex-col"
            } justify-between border-2 border-box-bg group-hover/tile:border-accent transition-colors duration-100`} // bg-gradient-to-tr from-background to-transparent via-transparent
          >
            <Title className="pb-4 group-hover/tile:text-white" dynamic={false}>
              {title}
            </Title>
            <div className="mb-4 flex flew-wrap gap-4 items-center justify-end">
              {tags.map((tag, i) => (
                <span key={i} className="brightness-25">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

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
