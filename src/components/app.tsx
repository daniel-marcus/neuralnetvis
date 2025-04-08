"use client"

import { useEffect, type ReactNode } from "react"
import { useSearchParams } from "next/navigation"
import { useTfBackend } from "@/model/tf-backend"
import { useDebugCommands } from "@/utils/debug"
import { useGlobalStore } from "@/store"
import { Header } from "./header"
import { TileGrid } from "./tile-grid"
import { StatusBar } from "./status-bar"

export const App = ({ children }: { children?: ReactNode }) => {
  useTfBackend()
  useDebugCommands()
  useScreenshotBodyClass()
  return (
    <>
      <Header />
      <Portal />
      <TileGrid />
      {children}
      <StatusBar />
    </>
  )
}

function Portal() {
  const ref = useGlobalStore((s) => s.portalRef)
  return <div ref={ref} className="absolute z-20 pointer-events-none inset-0" />
}

function useScreenshotBodyClass() {
  const searchParams = useSearchParams()
  const isScreenshot = typeof searchParams.get("screenshot") === "string"
  useEffect(() => {
    if (isScreenshot) document.body.classList.add("screenshot")
    return () => document.body.classList.remove("screenshot")
  }, [isScreenshot])
}
