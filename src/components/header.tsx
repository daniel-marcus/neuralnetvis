"use client"

import { useState } from "react"
import Headroom from "react-headroom"
import { useIsScreen } from "@/utils/screen"
import { useHasLesson } from "./lesson"
import { Logo } from "./logo"
import { TabMenu, useIsPlayMode } from "./tab-menu"

export const Header = () => {
  const isScreenXl = useIsScreen("xl")
  const hasLesson = useHasLesson()
  const [showGradient, setShowGradient] = useState(false)
  const isPlayMode = useIsPlayMode()
  return (
    <div
      className={`${
        isPlayMode
          ? "fixed"
          : hasLesson
          ? "relative xl:sticky"
          : "relative xl:fixed"
      } z-30 top-0 left-0 w-[100vw] pointer-events-none select-none`}
    >
      <Headroom
        disable={isPlayMode || isScreenXl}
        onPin={() => setShowGradient(true)}
        onUnpin={() => setShowGradient(false)}
        onUnfix={() => setShowGradient(false)}
      >
        <div className={`flex justify-between items-start`}>
          <div
            className={`${
              !showGradient ? "hidden" : ""
            } xl:hidden absolute h-[30vh] inset-0 bg-gradient-to-b from-background
           to-transparent z-[-1]`}
          />
          <Logo />
          <TabMenu />
        </div>
      </Headroom>
    </div>
  )
}
