"use client"

import { createElement, useState } from "react"
import Link from "next/link"
import Headroom from "react-headroom"
import { useGlobalStore } from "@/store"
import { useIsScreen } from "@/utils/screen"
import { useHasLesson } from "./lesson"
import { Logo } from "./logo"
import { TabMenu, useIsPlayMode } from "./tab-menu"

export const Header = () => {
  const currTab = useGlobalStore((s) => s.tab)
  const isShown = useGlobalStore((s) => s.tabIsShown)
  const content = currTab?.component ? createElement(currTab.component) : null
  const isScreenXl = useIsScreen("xl")
  const hasLesson = useHasLesson()
  const [showGradient, setShowGradient] = useState(false)
  const isPlayMode = useIsPlayMode()
  return (
    <div //
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
          <Link
            href={"/"}
            prefetch={false}
            className={`pointer-events-auto`}
            scroll={hasLesson ? true : false}
            // onClick={() => setTab(null)}
          >
            <Logo />
          </Link>
          <div className="pointer-events-auto">
            <div className="flex justify-end items-center w-full relative z-10 overflow-hidden">
              <TabMenu />
            </div>
            <div
              className={`overflow-hidden pb-8 pointer-events-none absolute right-0 w-[25rem] max-w-[100vw]`}
            >
              <div
                className={`${
                  isShown
                    ? ""
                    : "-translate-y-full sm:translate-y-0 sm:translate-x-full"
                } transition-transform duration-300 ease-in-out max-h-[calc(100dvh-var(--header-height))] overflow-y-auto`}
              >
                {content}
              </div>
            </div>
          </div>
        </div>
      </Headroom>
    </div>
  )
}
