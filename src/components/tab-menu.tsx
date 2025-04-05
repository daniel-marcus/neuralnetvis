import { Fragment, useMemo, useEffect, createElement } from "react"
import { rootTabs, playTabs, type Tab } from "@/components/tabs"
import { useGlobalStore } from "@/store"
import { usePathname } from "next/navigation"
import Link from "next/link"
import type { ReactNode } from "react"

export function useIsPlayMode() {
  const pathname = usePathname()
  return pathname.startsWith("/play/")
}

export const TabMenu = () => {
  const currTab = useGlobalStore((s) => s.tab)
  const content = currTab?.component ? createElement(currTab.component) : null
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
    <div className="pointer-events-auto screenshot:hidden">
      <div className="flex justify-end items-center w-full relative z-10 overflow-hidden">
        <TabButton
          isShown={!!currTab && (!!currTab.children || !!currTab.parent)}
          onClick={() => setTab(backKey ?? null)}
        >
          &lt;
        </TabButton>
        {renderTabs(tabs)}
      </div>
      <div
        className={`overflow-hidden pb-8 pointer-events-none absolute right-0 w-[25rem] max-w-[100vw]`}
      >
        <div
          className={`${
            tabIsShown
              ? ""
              : "-translate-y-full sm:translate-y-0 sm:translate-x-full"
          } transition-transform duration-300 ease-in-out max-h-[calc(100dvh-var(--header-height))] overflow-y-auto`}
        >
          {content}
        </div>
      </div>
    </div>
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
