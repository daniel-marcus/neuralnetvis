"use client"

import React, { ReactNode, useEffect, useRef, useState } from "react"
import { datasets } from "@/data/datasets"
import { useDrag } from "@use-gesture/react"
import { lessonPreviews } from "@/contents"
import { usePathname, useRouter } from "next/navigation"
import { useHasLesson } from "./lesson"
import { useGlobalStore } from "@/store"
import { SceneViewer } from "./scene-viewer"

interface TileDef {
  path: string
  title: string
  dsKey?: string
  disabled?: boolean
}

const tiles: TileDef[] = [
  ...lessonPreviews,
  ...datasets.map((dsDef) => ({
    path: `/${dsDef.key}`,
    title: dsDef.name,
    dsKey: dsDef.key,
    disabled: dsDef.disabled,
  })),
]

export const TileGrid = () => {
  const active = usePathname()
  const router = useRouter()
  const lastActive = useLast(active)
  const hasLesson = useHasLesson()
  const hasActive = active !== "/"
  const isDebug = useGlobalStore((s) => s.isDebug)
  return (
    <div
      className={`${
        hasLesson ? "fixed top-0 left-0" : "relative"
      } mx-auto pt-[112px]`}
    >
      <div
        className="grid grid-cols-[repeat(1,var(--item-width))] sm:grid-cols-[repeat(2,var(--item-width))] lg:grid-cols-[repeat(3,var(--item-width))] justify-center gap-4 p-main"
        style={
          {
            "--item-width": "320px",
            "--item-height": "320px",
          } as React.CSSProperties
        }
      >
        {tiles
          .filter(({ disabled }) => !disabled || isDebug)
          .map(({ path, title, dsKey }) => {
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
              >
                <SceneViewer isActive={!!isActive} dsKey={dsKey} />
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
}

type OffsetState = { x?: number; y?: number }

function Tile({
  title,
  isActive,
  onClick,
  className,
  children,
  syncTrigger,
}: TileProps) {
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

  const bind = useDrag(({ tap }) => {
    if (tap) {
      onClick?.()
    }
  })

  return (
    <div
      ref={ref}
      className={`relative ${
        onClick ? "cursor-pointer" : ""
      } h-[var(--item-height)] touch-none`}
      {...bind()}
    >
      <div
        className={`fixed overflow-hidden top-0 left-0 origin-center flex items-center justify-center ${
          isScrolling ? "" : "transition-all duration-500"
        } ${
          isActive
            ? "w-screen! h-[100dvh]! z-10 "
            : "w-[var(--item-width)] h-[var(--item-height)] translate-x-[var(--offset-x)] translate-y-[var(--offset-y)]"
        } ${typeof offset.x === "undefined" ? "opacity-0" : ""} ${className}`}
        style={
          {
            "--offset-x": `${offset.x}px`,
            "--offset-y": `${offset.y}px`,
          } as React.CSSProperties
        }
      >
        {!isActive && (
          <div className="absolute top-0 left-0 w-full h-full p-main border-1 rounded-box border-box-bg">
            {title}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

function useLast<T>(value: T) {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref.current
}
