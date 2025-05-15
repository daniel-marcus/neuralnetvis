"use client"

import { useTfBackend } from "@/model/tf-backend"
import { useGPUDevice } from "@/utils/webgpu"
import { useDebugCommands, useScreenshotBodyClass } from "@/utils/debug"
import { Header } from "./header"
import { TileGrid } from "./tile-grid"
import { StatusBar } from "./status-bar"
import { LessonOverlayPortal } from "./lesson"

export const App = ({ children }: { children?: React.ReactNode }) => {
  useTfBackend()
  useGPUDevice()
  useDebugCommands()
  useScreenshotBodyClass()
  return (
    <>
      <Header />
      <LessonOverlayPortal />
      <TileGrid />
      {children}
      <StatusBar />
    </>
  )
}
