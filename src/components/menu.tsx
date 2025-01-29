import React, { useEffect, useRef, useState } from "react"
import { ControlPanel, ControlStores, useControlStores } from "./controls"

type Tab = {
  key: string
  content?: (stores: ControlStores) => React.ReactElement
  isDefault?: boolean
  children?: Tab[]
}

const _tabs: Tab[] = [
  {
    key: "learn",
    content: () => <Box>Some contents here</Box>,
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
    key: "about",
    content: () => <About />,
    isDefault: true,
  },
]

interface TabWithParent extends Tab {
  parent: Tab | null
  children?: TabWithParent[]
}

function addParent(tab: Tab, parent: Tab | null): TabWithParent {
  const children = tab.children?.map((c) => addParent(c, tab))
  return { ...tab, parent, children }
}

const tabs = _tabs.map((t) => addParent(t, null))

export const Menu = () => {
  const defaultTab = tabs.find((t) => t.isDefault)
  const [activeTab, setActiveTab] = useState<TabWithParent | null>(
    defaultTab ?? null
  )
  const stores = useControlStores()
  const content = activeTab?.content ? activeTab.content(stores) : null
  const lastContent = useRef<React.ReactElement | null>(null)
  useEffect(() => {
    if (content) lastContent.current = content
  }, [content])
  return (
    <div className="fixed top-0 left-0 w-[100vw] z-10 flex justify-between items-start  pointer-events-none select-none flex-wrap">
      <button
        className="p-3 sm:p-4 pointer-events-auto cursor-pointer"
        onClick={() => setActiveTab(null)}
      >
        Neural Net Vis
      </button>
      <div className="pointer-events-auto flex-1">
        <div className="flex justify-end items-center w-full ">
          <Tabs tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />
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

interface TabsProps {
  tabs: TabWithParent[]
  activeTab: TabWithParent | null
  setActiveTab: React.Dispatch<React.SetStateAction<TabWithParent | null>>
}

const Tabs = ({ tabs, activeTab, setActiveTab }: TabsProps) => {
  function renderTabs(tabs: TabWithParent[], parent?: TabWithParent) {
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
      const onTabClick = () => {
        const defaultChild = !activeTab && t.children?.find((c) => c.isDefault)
        setActiveTab((a) => (a === t ? parent ?? null : defaultChild || t))
      }
      return (
        <React.Fragment key={t.key}>
          <TabButton isActive={isActive} isShown={isShown} onClick={onTabClick}>
            {t.key}
          </TabButton>
          {!!t.children && (isActive || isParent) && (
            <>{renderTabs(t.children, t)}</>
          )}
        </React.Fragment>
      )
    })
  }
  const goBack = () => {
    const allTabs = tabs.flatMap((t) => [t, ...(t.children ?? [])])
    const parent = allTabs.find((t) => t.children?.includes(activeTab!))
    const grandParent = allTabs.find((t) => t.children?.includes(parent!))
    const dest = activeTab?.content ? grandParent ?? null : parent ?? null
    setActiveTab(dest)
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
    className={`p-3 sm:p-4 cursor-pointer ${isActive ? "text-white" : ""} ${
      isShown ? "" : "hidden"
    }`}
    onClick={onClick}
  >
    {children}
  </button>
)

function Box({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-4 bg-box-bg rounded-[10px] text-left text-sm">
      {children}
    </div>
  )
}

function About() {
  return (
    <Box>
      Hi, I am Daniel. How are you?
      <br />
      <br />
      Check out my{" "}
      <a
        className="text-accent"
        target="_blank"
        href="https://danielmarcus.de/"
      >
        website
      </a>
      !
      <br />
      <br />v{process.env.APP_VERSION}
    </Box>
  )
}
