import React, { useEffect, useRef, useState } from "react"
import { ControlPanel, ControlStores, useControlStores } from "./controls"
import { create } from "zustand"

type Tab = {
  key: string
  content?: (stores: ControlStores) => React.ReactElement
  isDefault?: boolean
  children?: Tab[]
  parent?: Tab // will be added in addParent
}

const _tabs: Tab[] = [
  {
    key: "learn",
    content: () => <Learn />,
  },
  {
    key: "play",
    children: [
      {
        key: "data",
        content: ({ dataStore }) => <ControlPanel store={dataStore} />,
      },
      {
        key: "model",
        content: ({ modelStore }) => <ControlPanel store={modelStore} />,
      },
      {
        key: "train",
        content: ({ trainStore }) => <ControlPanel store={trainStore} />,
        isDefault: true,
      },
    ],
  },
  {
    key: "info",
    content: () => <Info />,
    isDefault: true,
  },
]

function addParent(tab: Tab, parent?: Tab): Tab {
  const children = tab.children?.map((c) => addParent(c, tab))
  return { ...tab, parent, children }
}

const tabs = _tabs.map((t) => addParent(t))
const defaultTab = tabs.find((t) => t.isDefault)

export const useTabsStore = create<{
  activeTab: Tab | null
  clickTab: (tab: Tab | null) => void
  goHome: () => void
  goBack: () => void
  setTab: (key: string) => void
}>((set) => ({
  activeTab: defaultTab ?? null,
  clickTab: (tab) =>
    set(({ activeTab }) => {
      if (activeTab === tab) return { activeTab: tab?.parent ?? null }
      const defaultChild = tab?.children?.find((c) => c.isDefault)
      return { activeTab: defaultChild ?? tab }
    }),
  goHome: () => set({ activeTab: null }),
  goBack: () =>
    set(({ activeTab }) => {
      const { parent } = activeTab ?? {}
      const parentIsCategory = !parent?.content
      return { activeTab: parentIsCategory ? parent?.parent : parent }
    }),
  setTab: (key) => {
    const allTabs = tabs.flatMap((t) => [t, ...(t.children ?? [])])
    const tab = allTabs.find((t) => t.key === key)
    const defaultChild = tab?.children?.find((c) => c.isDefault)
    if (tab) set({ activeTab: defaultChild ?? tab })
  },
}))

export const Menu = () => {
  const { activeTab, goHome } = useTabsStore()
  const stores = useControlStores()
  const content = activeTab?.content ? activeTab.content(stores) : null
  const lastContent = useRef<React.ReactElement | null>(null)
  useEffect(() => {
    if (content) lastContent.current = content
  }, [content])
  return (
    <div className="fixed top-0 left-0 w-[100vw] z-10 flex justify-between items-start pointer-events-none select-none flex-wrap">
      <button
        className="p-[10px] sm:p-4 pointer-events-auto cursor-pointer"
        onClick={goHome}
      >
        NeuralNetVis
      </button>
      <div className="pointer-events-auto flex-1">
        <div className="flex justify-end items-center w-full ">
          <Tabs />
        </div>
        <div
          className={`absolute right-0 w-[380px] max-w-[100vw] ${
            activeTab?.content ? "" : "translate-x-full"
          } transition-transform duration-300 ease-in-out`}
        >
          {content || lastContent.current}
        </div>
      </div>
    </div>
  )
}

const Tabs = () => {
  const { activeTab, clickTab, goBack } = useTabsStore()
  function renderTabs(tabs: Tab[], parent?: Tab) {
    return tabs.map((t) => {
      const isActive = activeTab?.key === t.key
      const allChildren = t.children?.flatMap((c) => [c, ...(c.children ?? [])])
      const isParent =
        !!activeTab && allChildren?.some((c) => c.key === activeTab.key)
      const isSibling = activeTab?.parent?.key === parent?.key && !isActive
      const isChild = !!parent && parent.key === activeTab?.key
      const isCategory = !t.content
      const isShown =
        (isActive && !isCategory) ||
        isChild ||
        (isSibling && !activeTab?.children)
      const onClick = () => clickTab(t)
      return (
        <React.Fragment key={t.key}>
          <TabButton isActive={isActive} isShown={isShown} onClick={onClick}>
            {t.key}
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
        isShown={!!activeTab && (!activeTab.content || !!activeTab.parent)}
        onClick={goBack}
      >
        &lt;
      </TabButton>
      {renderTabs(tabs)}
    </>
  )
}

interface TabButtonProps {
  isActive?: boolean
  onClick?: () => void
  children?: React.ReactNode
  isShown?: boolean
}

const TabButton = ({
  isActive,
  isShown = true,
  onClick,
  children,
}: TabButtonProps) => (
  <button
    className={`p-[10px] sm:p-4 cursor-pointer ${
      isActive ? "text-white" : ""
    } ${isShown ? "" : "hidden"}`}
    onClick={onClick}
  >
    {children}
  </button>
)

function Box({
  children,
  className,
  padding,
}: {
  children: React.ReactNode
  className?: string
  padding?: boolean
}) {
  return (
    <div
      className={`${
        padding ? "p-4" : ""
      } bg-box-bg rounded-[10px] text-left text-sm ${className}`}
    >
      {children}
    </div>
  )
}

function Info() {
  const setTab = useTabsStore((s) => s.setTab)
  return (
    <Box padding>
      <p className="mb-4">
        Wrap your head around neural networks and watch machines learn!
      </p>
      <p className="mb-4">
        If you are new to the topic, you might want to start with the{" "}
        <Button onClick={() => setTab("learn")}>learn</Button> section.
      </p>
      <p className="mb-4">
        Otherwise, dive in, modify or train models, and{" "}
        <Button onClick={() => setTab("play")}>play</Button> with neural
        networks – all within your browser!
      </p>
      <p className="mb-4">--</p>
      <p>
        © 2025 by{" "}
        <a
          className="text-accent"
          target="_blank"
          href="https://danielmarcus.de/"
        >
          Daniel Marcus
        </a>
        , v{process.env.APP_VERSION}
      </p>
    </Box>
  )
}

const Button = ({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick?: () => void
}) => (
  <button
    className="px-2 h-[24px] bg-accent text-white rounded-[3px]"
    onClick={onClick}
  >
    {children}
  </button>
)

const Chapter = ({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick?: () => void
}) => (
  <button
    className="p-4 hover:bg-accent hover:text-white text-left rounded-[10px]"
    onClick={onClick}
  >
    &gt; {children}
  </button>
)

const Learn = () => {
  const [clicked, setClicked] = useState(false)
  const handleClick = () => setClicked(true)
  return (
    <Box className="flex flex-col">
      <Chapter onClick={handleClick}>How can networks learn?</Chapter>
      <Chapter onClick={handleClick}>Exploring the interface</Chapter>
      {clicked && (
        <p className="p-4 mt-4">
          <em>Coming soon ...</em>
        </p>
      )}
    </Box>
  )
}
