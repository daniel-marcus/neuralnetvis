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

export type Section = "learn" | "play"

interface TileDef {
  path: string
  title: string
  section: Section
  dsKey?: string
  disabled?: boolean
  initialState?: InitialState
  shouldLoadFullDs?: boolean
}

const tiles: TileDef[] = [
  ...lessonPreviews.map((l) => ({
    ...l,
    section: "learn" as const,
    shouldLoadFullDs: true,
  })),
  ...datasets.map((dsDef) => ({
    path: `/play/${dsDef.key}`,
    title: dsDef.name,
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
      className={`top-[120px] left-0 w-screen ${
        hasLesson ? "fixed" : "absolute"
      }`}
      style={
        {
          "--item-width": "320px",
          "--item-height": "320px",
          "--gap": "1rem",
        } as React.CSSProperties
      }
    >
      <div className="w-[var(--item-width)] sm:w-[calc(2*var(--item-width)+var(--gap))] lg:w-[calc(3*var(--item-width)+2*var(--gap))] mx-auto flex flex-col min-h-[calc(100dvh-120px)]">
        <SectionIntro
          className={hasActive ? "opacity-0 pointer-events-none" : ""}
        />
        <div className="flex-grow grid grid-cols-[repeat(1,var(--item-width))] sm:grid-cols-[repeat(2,var(--item-width))] lg:grid-cols-[repeat(3,var(--item-width))] justify-center gap-[var(--gap)] p-main">
          {tiles
            .filter(({ disabled }) => !disabled || isDebug)
            .map((tile) => {
              const { path, title, dsKey, initialState } = tile
              const isActive = path === active
              return (
                <Tile
                  key={path}
                  title={title}
                  isActive={isActive}
                  onClick={!isActive ? () => router.push(path) : undefined}
                  className={`${hasActive && !isActive ? "opacity-0" : ""} ${
                    !!section && tile.section !== section ? "hidden" : ""
                  } ${path === lastActive ? "z-5" : ""}`}
                  syncTrigger={hasLesson}
                  section={tile.section}
                >
                  <SceneViewer
                    isActive={!!isActive}
                    dsKey={dsKey}
                    initialState={initialState}
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
  isActive?: boolean
  onClick?: () => void
  className?: string
  children?: ReactNode | ReactNode[]
  syncTrigger: boolean
  section: Section
}

function Tile({
  title,
  isActive,
  onClick,
  className,
  children,
  // syncTrigger,
  section,
}: TileProps) {
  // const [ref, offset, isScrolling] = useOffsetSync(syncTrigger)

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

  const isFeatured = false

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
          ? { "--item-width": "calc(var(--item-height) * 2 + var(--gap))" }
          : {}) as React.CSSProperties
      }
    >
      <div
        className={`rounded-box overflow-hidden origin-center flex items-center justify-center ${
          localActive
            ? "fixed inset-0 w-screen h-[100dvh] z-10"
            : "w-[var(--item-width)] h-[var(--item-height)]"
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
            className={`absolute top-0 left-0 w-full h-[calc(100%)] p-main rounded-box  pointer-events-none flex flex-col justify-between border-1 border-box-bg`} // bg-gradient-to-tr from-background to-transparent via-transparent
          >
            {section === "learn" ? (
              <>
                <div></div>
                <Title
                  className="pb-4 group-hover/tile:text-white"
                  dynamic={false}
                >
                  {title}
                </Title>
              </>
            ) : (
              <>
                <div>
                  <span className="group-hover/tile:text-white">{title}</span>
                </div>
              </>
            )}
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
