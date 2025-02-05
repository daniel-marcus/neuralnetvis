"use client"

import React, { useEffect, useLayoutEffect, useRef, useState } from "react"
import { create } from "zustand"
import Link from "next/link"
import { Info } from "@/tabs/info"
import { Data } from "@/tabs/data"
import { Learn } from "@/tabs/learn"
import { Play } from "@/tabs/play"
import { Model } from "@/tabs/model"
import { Train } from "@/tabs/train"
import { Logo } from "./logo"
import Headroom from "react-headroom"
import { useIsScreen } from "@/lib/utils"
import { useLessonStore } from "./lesson"

type Tab = {
  key: string
  slug?: string // Tabs without slug will be buttons only
  label?: string
  content?: () => React.ReactElement // TODO: just ReactElement
  isDefault?: boolean
  children?: Tab[]
  parent?: Tab // will be added in addParent
}

const _tabs: Tab[] = [
  {
    key: "learn",
    // slug: "learn",
    content: () => <Learn />,
  },
  {
    key: "play",
    // slug: "play",
    content: () => <Play />,
    children: [
      {
        key: "data",
        // slug: "data",
        content: () => <Data />,
      },
      {
        key: "model",
        // slug: "model",
        content: () => <Model />,
      },
      {
        key: "train",
        // slug: "train",
        content: () => <Train />,
      },
    ],
  },
  {
    key: "info",
    label: "i",
    content: () => <Info />,
    // isDefault: true,
  },
]

function addParent(tab: Tab, parent?: Tab): Tab {
  const children = tab.children?.map((c) => addParent(c, tab))
  return { ...tab, parent, children }
}

const tabs = _tabs.map((t) => addParent(t))

interface TabStore {
  isFirstLoad: boolean
  isShown: boolean
  setIsShown: (isShown: boolean) => void
  currTab: Tab | null
  setTabBySlugs: (
    slugs: string[] | null | undefined,
    shouldShow?: boolean
  ) => void
  setTabByKey: (key: string | null) => void
}

export const useTabStore = create<TabStore>((set) => ({
  isFirstLoad: true,
  currTab: null,
  isShown: true,
  setIsShown: (isShown) => set({ isShown }),
  setTabBySlugs: (slugs, shouldShow) => {
    if (typeof slugs === "undefined")
      return set(({ isFirstLoad }) => ({
        currTab: isFirstLoad ? tabs.find((t) => t.isDefault) ?? null : null,
        isFirstLoad: false,
      }))
    if (slugs === null) return set({ currTab: null })
    const tab = getTab(slugs, tabs)
    if (tab)
      set(({ isShown }) => ({ currTab: tab, isShown: shouldShow ?? isShown }))
  },
  setTabByKey: (key: string | null) => {
    // careful with duplicate keys
    if (key === null) return set({ currTab: null })
    const allTabs = tabs.flatMap((t) => [t, ...(t.children ?? [])])
    const tab = allTabs.find((t) => t.key === key)
    if (tab) set({ currTab: tab })
  },
}))

function getTab(slugs: string[], tabs: Tab[]): Tab | null {
  const [slug, ...rest] = slugs
  const tab = tabs.find((t) => t.slug === slug || t.key === slug)
  if (!tab) return null
  if (!rest.length) return tab
  return getTab(rest, tab.children ?? [])
}

export const TabSetter = ({
  slugs,
}: {
  slugs: string[] | null | undefined
}) => {
  const setTabBySlugs = useTabStore((s) => s.setTabBySlugs)
  useLayoutEffect(() => {
    setTabBySlugs(slugs)
  }, [slugs, setTabBySlugs])
  return null
}

export const Menu = () => {
  const { currTab, isShown } = useTabStore()
  const content = currTab?.content && isShown ? currTab.content() : null
  const lastContent = useRef<React.ReactElement | null>(null)
  const setTabBySlugs = useTabStore((s) => s.setTabBySlugs)
  useEffect(() => {
    if (content) lastContent.current = content
  }, [content])
  const isScreenXl = useIsScreen("xl")
  const hasLesson = !!useLessonStore((s) => s.currLesson)
  const [showGradient, setShowGradient] = useState(false)
  return (
    <div
      className={`${
        hasLesson ? "relative xl:sticky" : "fixed"
      } xl:z-[10] top-0 left-0 w-[100vw] pointer-events-none select-none text-base`}
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
            href="/"
            className={`pointer-events-auto`}
            onClick={() => setTabBySlugs(null)}
          >
            <Logo />
          </Link>
          <div className="pointer-events-auto">
            <div className="flex justify-end items-center w-full relative z-10 overflow-hidden">
              <Tabs />
            </div>
            <div
              className={`overflow-hidden pointer-events-none absolute right-0 w-[380px] max-w-[100vw]`}
            >
              <div
                className={`${
                  !!content
                    ? ""
                    : "-translate-y-full sm:translate-y-0 sm:translate-x-full"
                } transition-transform duration-300 ease-in-out`}
              >
                {content || lastContent.current}
              </div>
            </div>
          </div>
        </div>
      </Headroom>
    </div>
  )
}

const Tabs = () => {
  const {
    currTab,
    setTabByKey,
    isShown: isTabShown,
    setIsShown,
  } = useTabStore()

  function getPath(tab: Tab): string {
    if (!tab.parent) return `/${tab.slug}`
    return `${getPath(tab.parent)}/${tab.slug}`
  }

  function renderTabs(tabs: Tab[], parent?: Tab) {
    return tabs.map((t) => {
      const isActive = currTab?.key === t.key
      const allChildren = t.children?.flatMap((c) => [c, ...(c.children ?? [])])
      const isParent =
        !!currTab && allChildren?.some((c) => c.key === currTab.key)
      const isSibling = currTab?.parent?.key === parent?.key && !isActive
      const isChild = !!parent && parent.key === currTab?.key
      const isCategory = !t.content
      const isShown =
        (isActive && !isCategory && !currTab?.children) ||
        isChild ||
        (isSibling && !currTab?.children)
      const path = getPath(t)
      const onClickAll = () => {
        setIsShown(isActive ? false : true)
      }
      const onClickBtnOnly = () => {
        if (isActive) setIsShown(!isTabShown)
        else {
          setTabByKey(t.key)
          setIsShown(true)
        }
        // setTabBySlugs([t.key], !isActive || !isTabShown)
      }
      const href = t.slug
        ? isActive
          ? parent
            ? getPath(parent)
            : "/"
          : path
        : undefined
      return (
        <React.Fragment key={t.key}>
          <TabButton
            href={href}
            isActive={isActive && isTabShown}
            isShown={isShown}
            onClick={!t.slug ? onClickBtnOnly : onClickAll}
          >
            {t.label ?? t.key}
          </TabButton>
          {!!t.children && (isActive || isParent) && (
            <>{renderTabs(t.children, t)}</>
          )}
        </React.Fragment>
      )
    })
  }
  const backKey = isTabShown
    ? currTab?.parent?.key
    : currTab?.parent?.parent?.key
  return (
    <>
      <TabButton
        // href={currTab?.parent ? getPath(currTab.parent) : "/"}
        isShown={!!currTab && (!!currTab.children || !!currTab.parent)}
        onClick={() => setTabByKey(backKey ?? null)}
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
  children?: React.ReactNode
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
