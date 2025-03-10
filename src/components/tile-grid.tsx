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

export type SceneType = "lesson" | "dataset"

interface TileDef {
  path: string
  title: string
  sceneType: SceneType
  dsKey?: string
  disabled?: boolean
  initialState?: InitialState
  shouldLoadFullDs?: boolean
}

const tiles: TileDef[] = [
  ...lessonPreviews.map((l) => ({
    ...l,
    sceneType: "lesson" as const,
    shouldLoadFullDs: true,
  })),
  ...datasets.map((dsDef) => ({
    path: `/${dsDef.key}`,
    title: dsDef.name,
    sceneType: "dataset" as const,
    dsKey: dsDef.key,
    disabled: dsDef.disabled,
  })),
]

export function useHasActiveTile() {
  const pathname = usePathname()
  return tiles.some(({ path }) => path === pathname)
}

export const TileGrid = () => {
  const active = usePathname()
  const router = useRouter()
  const lastActive = useLast(active)
  const hasLesson = useHasLesson()
  const hasActive = useHasActiveTile()
  const isDebug = useGlobalStore((s) => s.isDebug)
  return (
    <div
      className={`${
        hasLesson ? "fixed top-0 left-0" : "relative"
      } mx-auto pt-0 pb-6 w-[var(--item-width)] sm:w-[calc(2*var(--item-width)+var(--gap))] lg:w-[calc(3*var(--item-width)+2*var(--gap))]`}
      style={
        {
          "--item-width": "320px",
          "--item-height": "320px",
          "--gap": "1rem",
        } as React.CSSProperties
      }
    >
      <div className="grid grid-cols-[repeat(1,var(--item-width))] sm:grid-cols-[repeat(2,var(--item-width))] lg:grid-cols-[repeat(3,var(--item-width))] justify-center gap-[var(--gap)] p-main">
        {tiles
          .filter(({ disabled }) => !disabled || isDebug)
          .map((tile) => {
            const { path, title, dsKey, initialState, sceneType } = tile
            const isActive = path === active
            return (
              <Tile
                key={path}
                title={title}
                isActive={isActive}
                onClick={!isActive ? () => router.push(path) : undefined}
                className={`${hasActive && !isActive ? "opacity-0" : ""} ${
                  lastActive === path ? "z-5" : ""
                }`}
                syncTrigger={hasLesson}
                sceneType={sceneType}
              >
                <SceneViewer
                  isActive={!!isActive}
                  dsKey={dsKey}
                  initialState={initialState}
                  sceneType={sceneType}
                  shouldLoadFullDs={tile.shouldLoadFullDs}
                />
              </Tile>
            )
          })}
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
  sceneType: SceneType
}

function Tile({
  title,
  isActive,
  onClick,
  className,
  children,
  syncTrigger,
  sceneType,
}: TileProps) {
  const [ref, offset, isScrolling] = useOffsetSync(syncTrigger)
  const bind = useDrag(({ tap }) => {
    if (tap) onClick?.()
  })

  return (
    <div
      ref={ref}
      className={`relative ${
        onClick ? "cursor-pointer" : ""
      } h-[var(--item-height)] group/tile`}
      {...bind()}
    >
      <div
        className={`fixed rounded-box overflow-hidden top-0 left-0 origin-center flex items-center justify-center ${
          isScrolling ? "" : "transition-all duration-500"
        } ${
          isActive
            ? "w-screen! h-[100dvh]! z-10"
            : "w-[var(--item-width)] h-[var(--item-height)] translate-x-[var(--offset-x)] translate-y-[var(--offset-y)]"
        } ${typeof offset.x === "undefined" ? "opacity-0" : ""} ${className}`}
        style={
          {
            "--offset-x": `${offset.x}px`,
            "--offset-y": `${offset.y}px`,
          } as React.CSSProperties
        }
      >
        {children}
        {!isActive && (
          <div
            className={`absolute top-0 left-0 w-full h-[calc(100%)] p-main border-1 rounded-box border-box-bg pointer-events-none flex flex-col justify-between`} // bg-gradient-to-tr from-background to-transparent via-transparent
          >
            {sceneType === "lesson" ? (
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

type OffsetState = { x?: number; y?: number }

function useOffsetSync(syncTrigger: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [isScrolling, setIsScrolling] = useState(false)
  const [offset, setOffset] = useState<OffsetState>({})
  useEffect(() => {
    let scrollTimer: NodeJS.Timeout
    function syncOffset() {
      if (ref.current) {
        setIsScrolling(true)
        clearTimeout(scrollTimer)
        scrollTimer = setTimeout(() => {
          setIsScrolling(false)
        }, 150)
        const { x, y } = ref.current.getBoundingClientRect()
        setOffset({ x, y })
      }
    }
    syncOffset()
    window.addEventListener("resize", syncOffset)
    window.addEventListener("scroll", syncOffset)
    return () => {
      window.removeEventListener("resize", syncOffset)
      window.removeEventListener("scroll", syncOffset)
    }
  }, [syncTrigger])
  return [ref, offset, isScrolling] as const
}

function useLast<T>(value: T) {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref.current
}
