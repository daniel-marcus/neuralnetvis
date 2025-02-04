"use client"

import React, { useEffect, useRef } from "react"
import { create } from "zustand"
import Link from "next/link"
import { Info } from "@/tabs/info"
import { Data } from "@/tabs/data"
import { Learn } from "@/tabs/learn"
import { Play } from "@/tabs/play"
import { Model } from "@/tabs/model"
import { Train } from "@/tabs/train"

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
    slug: "play",
    content: () => <Play />,
    children: [
      {
        key: "data",
        slug: "data",
        content: () => <Data />,
      },
      {
        key: "model",
        slug: "model",
        content: () => <Model />,
      },
      {
        key: "train",
        slug: "train",
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
  useEffect(() => {
    setTabBySlugs(slugs)
  }, [slugs, setTabBySlugs])
  return null
}

export const Menu = () => {
  const { currTab, isShown } = useTabStore()
  const content = currTab?.content && isShown ? currTab.content() : null
  const lastContent = useRef<React.ReactElement | null>(null)
  useEffect(() => {
    if (content) lastContent.current = content
  }, [content])
  return (
    <div className="fixed top-0 left-0 w-[100vw] z-20 flex justify-between items-start pointer-events-none select-none flex-wrap text-sm xs:text-base">
      <Link
        href="/"
        className="p-main pointer-events-auto cursor-pointer bg-background relative z-10"
      >
        NeuralNetVis
      </Link>
      <div className="pointer-events-auto flex-1">
        <div className="flex justify-end items-center w-full bg-background relative z-10">
          <Tabs />
        </div>
        <div
          className={`absolute right-0 w-[380px] max-w-[100vw] ${
            !!content
              ? ""
              : "-translate-y-full sm:translate-y-0 sm:translate-x-full pointer-events-none"
          } transition-transform duration-300 ease-in-out`}
        >
          {content || lastContent.current}
        </div>
      </div>
    </div>
  )
}

const Tabs = () => {
  const {
    currTab,
    setTabBySlugs,
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
        !!currTab && allChildren?.some((c) => c.slug === currTab.slug)
      const isSibling = currTab?.parent?.slug === parent?.slug && !isActive
      const isChild = !!parent && parent.slug === currTab?.slug
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
        setTabBySlugs([t.key], !isActive || !isTabShown)
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
  return (
    <>
      <TabButton
        href={currTab?.parent ? getPath(currTab.parent) : "/"}
        isShown={!!currTab && (!!currTab.children || !!currTab.parent)}
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
      className={`p-main cursor-pointer ${isActive ? "text-white" : ""} ${
        isShown ? "" : "hidden"
      }`}
      onClick={onClick}
    >
      {children}
    </Component>
  )
}
