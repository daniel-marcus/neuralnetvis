"use client"

import { createElement, useState, Fragment, type ReactNode } from "react"
import Link from "next/link"
import Headroom from "react-headroom"
import { useStore } from "@/store"
import { useIsScreen } from "@/utils/screen"
import { useHasLesson } from "./lesson"
import { Logo } from "./logo"
import { tabs, type Tab } from "@/components/tabs"
import { usePathname } from "next/navigation"
import { setInitialState } from "@/utils/initial-state"

export const Menu = () => {
  const currTab = useStore((s) => s.tab)
  const setTab = useStore((s) => s.setTab)
  const isShown = useStore((s) => s.tabIsShown)
  const content = currTab?.component ? createElement(currTab.component) : null
  const isScreenXl = useIsScreen("xl")
  const hasLesson = useHasLesson()
  const [showGradient, setShowGradient] = useState(false)
  const pathname = usePathname()
  return (
    <div
      className={`${
        !hasLesson ? "fixed" : "relative xl:stick"
      } z-20 top-0 left-0 w-[100vw] pointer-events-none select-none`}
    >
      <Headroom
        disable={!hasLesson || isScreenXl}
        onPin={() => setShowGradient(true)}
        onUnpin={() => setShowGradient(false)}
        onUnfix={() => setShowGradient(false)}
      >
        <div className={`flex justify-between items-start`}>
          <div
            className={`${
              !hasLesson || !showGradient ? "hidden" : ""
            } xl:hidden absolute h-[30vh] inset-0 bg-gradient-to-b from-background
           to-transparent z-[-1]`}
          />
          <Link
            href={pathname === "/menu" ? "/menu" : "/"}
            className={`pointer-events-auto`}
            scroll={hasLesson ? true : false}
            onClick={() => {
              setTab(null)
              setInitialState()
            }}
          >
            <Logo />
          </Link>
          <div className="pointer-events-auto">
            <div className="flex justify-end items-center w-full relative z-10 overflow-hidden">
              <Tabs />
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

const Tabs = () => {
  const currTab = useStore((s) => s.tab)
  const setTab = useStore((s) => s.setTab)
  const toggleTab = useStore((s) => s.toggleTab)
  const tabIsShown = useStore((s) => s.tabIsShown)

  function renderTabs(tabs: Tab[], parent?: Tab) {
    return tabs.map((t) => {
      const isActive = currTab?.key === t.key
      const allChildren = t.children?.flatMap((c) => [c, ...(c.children ?? [])])
      const isParent =
        !!currTab && allChildren?.some((c) => c.key === currTab.key)
      const isSibling = currTab?.parent?.key === parent?.key && !isActive
      const isChild = !!parent && parent.key === currTab?.key
      const isCategory = !t.component
      const isShown =
        (isActive && !isCategory && !currTab?.children) ||
        isChild ||
        (isSibling && !currTab?.children)
      const handleClick = () => toggleTab(t.key)
      return (
        <Fragment key={t.key}>
          <TabButton
            isActive={isActive && tabIsShown}
            isShown={isShown}
            onClick={handleClick}
          >
            {t.label ?? t.key}
          </TabButton>
          {!!t.children && (isActive || isParent) && (
            <>{renderTabs(t.children, t)}</>
          )}
        </Fragment>
      )
    })
  }
  const backKey = tabIsShown
    ? currTab?.parent?.key
    : currTab?.parent?.parent?.key
  return (
    <>
      <TabButton
        isShown={!!currTab && (!!currTab.children || !!currTab.parent)}
        onClick={() => setTab(backKey ?? null)}
      >
        &lt;
      </TabButton>
      {renderTabs(tabs)}
    </>
  )
}

interface TabButtonProps {
  href?: string
  isActive?: boolean
  onClick?: () => void
  children?: ReactNode
  isShown?: boolean
}

const TabButton = ({
  href,
  isActive,
  isShown = true,
  children,
  onClick,
}: TabButtonProps) => {
  const Component = href ? Link : "button"
  return (
    <Component
      href={href as string}
      className={`p-main cursor-pointer ${
        isActive ? "text-white" : ""
      } hover:text-white ${
        isShown ? "" : "hidden"
      } transition-colors duration-100`}
      onClick={onClick}
    >
      {children}
    </Component>
  )
}
