"use client"

import {
  createElement,
  useState,
  Fragment,
  type ReactNode,
  useMemo,
  useEffect,
} from "react"
import Link from "next/link"
import Headroom from "react-headroom"
import { useGlobalStore } from "@/store"
import { useIsScreen } from "@/utils/screen"
import { useHasLesson } from "./lesson"
import { Logo } from "./logo"
import { rootTabs, playTabs, type Tab } from "@/components/tabs"
import { usePathname } from "next/navigation"
import { useHasActiveTile } from "./tile-grid"

export const Menu = () => {
  const currTab = useGlobalStore((s) => s.tab)
  const setTab = useGlobalStore((s) => s.setTab)
  const isShown = useGlobalStore((s) => s.tabIsShown)
  const content = currTab?.component ? createElement(currTab.component) : null
  const isScreenXl = useIsScreen("xl")
  const hasLesson = useHasLesson()
  const [showGradient, setShowGradient] = useState(false)
  const isPlayMode = useIsPlayMode()
  const hasActiveTile = useHasActiveTile()
  return (
    <div //
      className={`${
        isPlayMode ? "fixed" : "relative xl:stick"
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
              !hasActiveTile || !showGradient ? "hidden" : ""
            } xl:hidden absolute h-[30vh] inset-0 bg-gradient-to-b from-background
           to-transparent z-[-1]`}
          />
          <Link
            href={"/"}
            className={`pointer-events-auto`}
            scroll={hasLesson ? true : false}
            onClick={() => {
              setTab(null)
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

export function useIsPlayMode() {
  const pathname = usePathname()
  return pathname.startsWith("/play/")
}

const Tabs = () => {
  const currTab = useGlobalStore((s) => s.tab)
  const setTab = useGlobalStore((s) => s.setTab)
  const toggleTab = useGlobalStore((s) => s.toggleTab)
  const tabIsShown = useGlobalStore((s) => s.tabIsShown)

  const isPlayMode = useIsPlayMode()
  const tabs = useMemo(() => (isPlayMode ? playTabs : rootTabs), [isPlayMode])
  useEffect(() => {
    setTab(null)
  }, [isPlayMode, setTab])
  const pathname = usePathname()

  function renderTabs(tabs: Tab[], parent?: Tab) {
    return tabs.map((t) => {
      const isActive = currTab?.key === t.key || pathname === `/${t.slug}`
      const allChildren = t.children?.flatMap((c) => [c, ...(c.children ?? [])])
      const isParent =
        !!currTab && allChildren?.some((c) => c.key === currTab.key)
      const isSibling = currTab?.parent?.key === parent?.key && !isActive
      const isChild = !!parent && parent.key === currTab?.key
      const isShown =
        (isActive && !currTab?.children) ||
        isChild ||
        (isSibling && !currTab?.children)
      return (
        <Fragment key={t.key}>
          <TabButton
            href={t.slug ? (isActive ? "/" : `/${t.slug}`) : undefined}
            isActive={isActive && (tabIsShown || !t.component)}
            isShown={isShown}
            onClick={t.slug ? undefined : () => toggleTab(t.key)}
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
