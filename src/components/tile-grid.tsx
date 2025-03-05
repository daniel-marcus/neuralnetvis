"use client"

import React, { useEffect, useRef, useState } from "react"
import { datasets } from "@/data/datasets"
import { Canvas } from "@react-three/fiber"
import { SceneInner } from "@/scene"
import { useStore } from "@/store"
import { useDrag } from "@use-gesture/react"

export const TileGrid = () => {
  const active = useStore((s) => s.activeTile)
  const toggleActive = useStore((s) => s.toggleActiveTile)
  const lastActive = useLast(active)
  return (
    <div className="relative mx-auto pt-[112px]">
      <div
        className="grid grid-cols-[repeat(1,var(--item-width))] sm:grid-cols-[repeat(2,var(--item-width))] lg:grid-cols-[repeat(3,var(--item-width))] justify-center gap-4 p-main"
        style={
          {
            "--item-width": "320px",
            "--item-height": "320px",
          } as React.CSSProperties
        }
      >
        {datasets.map((dsDef, i) => {
          const isActive = dsDef.key === active
          return (
            <Tile
              key={i}
              title={dsDef.name}
              isActive={isActive}
              onClick={
                !isActive
                  ? () => {
                      toggleActive(dsDef.key)
                      // setDsFromKey(dsDef.key)
                    }
                  : undefined
              }
              className={`${!!active && !isActive ? "opacity-0" : ""} ${
                lastActive === dsDef.key ? "z-5" : ""
              }`}
            />
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
}

type OffsetState = { x?: number; y?: number }

function Tile({ title, isActive, onClick, className }: TileProps) {
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
  }, [])

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
        className={`fixed overflow-hidden top-0 left-0 bg-background origin-center flex items-center justify-center ${
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
        <Canvas
          frameloop="demand"
          resize={{ debounce: 0 }}
          className={`absolute w-screen! h-[100dvh]!`}
        >
          <SceneInner isActive={!!isActive} />
        </Canvas>
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
