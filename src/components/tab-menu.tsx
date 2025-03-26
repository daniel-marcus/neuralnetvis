import { Fragment, type ReactNode, useMemo, useEffect } from "react"
import { rootTabs, playTabs, type Tab } from "@/components/tabs"
import { useGlobalStore } from "@/store"
import { usePathname } from "next/navigation"
import Link from "next/link"

export function useIsPlayMode() {
  const pathname = usePathname()
  return pathname.startsWith("/play/")
}

export const TabMenu = () => {
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
