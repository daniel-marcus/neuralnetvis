"use client"

import { useState } from "react"
import Headroom from "react-headroom"
import { Logo } from "./logo"
import { TabMenu } from "./tab-menu"

export const Header = () => {
  const [showGradient, setShowGradient] = useState(false)
  return (
    <div
      className={`relative z-30 top-0 left-0 w-[100vw] pointer-events-none select-none`}
    >
      <Headroom
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
