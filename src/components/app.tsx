"use client"

import { Footer, Gradient, Menu } from "@/components"
import { useDataset, useSample } from "@/data"
import { useModel, useTraining } from "@/model"
import { useDebugCommands } from "@/utils/debug"
import { Scene } from "@/scene"
import type { ReactNode } from "react"
import { VideoTest } from "./video-test"

export const App = ({ children }: { children?: ReactNode }) => {
  const ds = useDataset()
  const model = useModel(ds)
  useTraining(model, ds)
  useSample(ds)
  useDebugCommands()
  return (
    <div>
      <Scene />
      <Footer />
      <Gradient />
      <Menu />
      <VideoTest />
      {children}
    </div>
  )
}
