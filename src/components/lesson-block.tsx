"use client"

import { ReactNode, useCallback, useEffect } from "react"
import { useController } from "./controller"
import { useInView } from "@/lib/in-view"

export interface BlockProps {
  children: ReactNode
}

export function Block({ children }: BlockProps) {
  const { dataStore, three } = useController()
  const [ref, inView] = useInView({ rootMargin: "-50% 0px" })

  const calculateScrolledPercentage = useCallback(() => {
    if (!ref.current) return 0
    const rect = ref.current.getBoundingClientRect()
    const windowHeight = window.innerHeight
    const middleY = windowHeight / 2

    if (rect.bottom <= middleY) return 1
    if (rect.top >= middleY) return 0
    return Math.round(((middleY - rect.top) / rect.height) * 1000) / 1000
  }, [ref])

  useEffect(() => {
    if (!inView) return
    const onScroll = () => {
      const percent = calculateScrolledPercentage()
      const newI = Math.round(percent * 100)
      dataStore.setValueAtPath("i", newI, false)

      if (!three) return
      const camera = three.camera
      function rotate(percent: number) {
        const angle = percent * Math.PI * 2 // Full rotation
        const radius = Math.sqrt(22.5 * 22.5 + 35 * 35) // Distance from origin
        camera.position.x = Math.sin(angle) * radius
        camera.position.z = Math.cos(angle) * radius
        camera.lookAt(0, 0, 0)
      }
      rotate(percent)
    }
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [inView, calculateScrolledPercentage, dataStore, three])

  return (
    <div
      ref={ref}
      className={`pb-[50dvh] ${
        inView ? "opacity-100 " : "opacity-50"
      } transition-opacity duration-100`}
    >
      {children}
    </div>
  )
}
