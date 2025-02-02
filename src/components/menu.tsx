"use client"

import React, { useCallback, useEffect, useRef } from "react"
import { ControlPanel, ControlStores, useControlStores } from "./controls"
import { create } from "zustand"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Info } from "@/tabs/info"
import { Data } from "@/tabs/data"
import { Learn } from "@/tabs/learn"

type Tab = {
  key: string
  slug?: string // Tabs without slug will be buttons only
  label?: string
  content?: (stores: ControlStores) => React.ReactElement
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
    content: () => (
      <Box padding={false}>
        <p className="p-4">Welcome to the playground!</p>
        <div className="flex flex-col">
          <MenuBtn href="/play/data">Choose dataset</MenuBtn>
          <MenuBtn href="/play/model">Configure model </MenuBtn>
          <MenuBtn href="/play/train">Train model</MenuBtn>
        </div>
      </Box>
    ),
    children: [
      {
        key: "data",
        slug: "data",
        content: () => <Data />,
      },
      {
        key: "model",
        slug: "model",
        content: ({ modelStore }) => <ControlPanel store={modelStore} />,
      },
      {
        key: "train",
        slug: "train",
        content: ({ trainConfigStore }) => (
          <ControlPanel store={trainConfigStore} />
        ),
      },
    ],
  },
  {
    key: "info",
    label: "i",
    content: () => <Info />,
    isDefault: true,
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
  const stores = useControlStores()
  const content = currTab?.content && isShown ? currTab.content(stores) : null
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

export function Box({
  children,
  className,
  padding,
  hasBg = true,
}: {
  children: React.ReactNode
  className?: string
  padding?: boolean
  hasBg?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const setIsShown = useTabStore((s) => s.setIsShown)
  const pathname = usePathname()
  const router = useRouter()
  const closeTab = useCallback(() => {
    const parentPath = pathname.split("/").slice(0, -1).join("/") || "/"
    setIsShown(false)
    router.push(parentPath)
  }, [setIsShown, pathname, router])
  useSwipeClose(ref, closeTab)
  return (
    <div
      ref={ref}
      className={`${padding ? "p-4" : ""} ${
        hasBg ? "bg-box-bg" : ""
      } rounded-[10px] text-left text-sm shadow-sm _backdrop-blur-xs translate-y-[var(--translate-y)] transition-translate duration-50 ease-in-out ${className}`}
    >
      {children}
    </div>
  )
}

const DELTA_THRESHOLD = -70 // swipe up
const VELOCITY_THRESHOLD = 0.5

function useSwipeClose(
  ref: React.RefObject<HTMLDivElement | null>,
  onClose: () => void
) {
  const offsetY = useRef(0)
  useEffect(() => {
    if (!ref.current) return
    const el = ref.current
    let startX: number | null = null
    let startY: number | null = null
    let deltaY = 0
    let startTime = 0
    let hasFired = false
    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      deltaY = 0
      startTime = Date.now()
    }
    const handleTouchMove = (e: TouchEvent) => {
      e.stopPropagation()
      e.preventDefault()
      if (startX === null || startY === null) return
      const deltaX = e.touches[0].clientX - startX
      deltaY = e.touches[0].clientY - startY
      const isVertial = Math.abs(deltaY) > Math.abs(deltaX)
      if (isVertial) {
        const newOffset = offsetY.current + deltaY
        el.style.setProperty("transition-duration", "0s")
        el.style.setProperty("--translate-y", `${Math.min(newOffset, 0)}px`)
        const velocity = Math.abs(deltaY) / (Date.now() - startTime)
        if (deltaY < DELTA_THRESHOLD && velocity > VELOCITY_THRESHOLD) {
          if (!hasFired) onClose()
          hasFired = true
        }
      }
    }
    const handleTouchEnd = () => {
      el.style.setProperty("transition-duration", null)
      if (hasFired) {
        offsetY.current = 0
        hasFired = false
        setTimeout(() => el?.style.setProperty("--translate-y", "0"), 300)
      } else {
        const newOffset = offsetY.current + deltaY
        offsetY.current = Math.min(newOffset, 0)
        el.style.setProperty("--translate-y", `${offsetY.current}px`)
      }
      startX = null
      startY = null
    }
    el.addEventListener("touchstart", handleTouchStart)
    el.addEventListener("touchmove", handleTouchMove)
    el.addEventListener("touchend", handleTouchEnd)
    return () => {
      el.removeEventListener("touchstart", handleTouchStart)
      el.removeEventListener("touchmove", handleTouchMove)
      el.removeEventListener("touchend", handleTouchEnd)
    }
  }, [ref, onClose])
}

export const InlineButton = ({
  href,
  children,
  onClick,
}: {
  href: string
  children: React.ReactNode
  onClick?: () => void
}) => (
  <Link
    href={href}
    className="px-2 h-[24px] bg-accent text-white rounded-[3px]"
    onClick={onClick}
  >
    {children}
  </Link>
)

interface MenuBtnProps {
  href?: string
  children: React.ReactNode
  isActive?: boolean
  onClick?: () => void
}

// TODO: rename, move to separate file
export const MenuBtn = ({
  href,
  children,
  isActive,
  onClick,
}: MenuBtnProps) => {
  const Component = href ? Link : "button"
  return (
    <Component
      href={href as string}
      className={`p-4 ${
        isActive ? "bg-amber-200 text-black" : ""
      } hover:bg-accent-hover hover:text-white text-left rounded-[10px] flex justify-start items-start`}
      onClick={onClick}
    >
      <div className="pr-2">&gt; </div>
      <div>{children}</div>
    </Component>
  )
}
