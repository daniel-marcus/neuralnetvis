import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { Leva, LevaPanel, useCreateStore } from "leva"
import { LevaCustomTheme } from "leva/dist/declarations/src/styles"
import { StoreType } from "leva/dist/declarations/src/types"

const levaTheme: LevaCustomTheme = {
  colors: {
    elevation1: "rgba(24, 28, 32, 0.75)",
    elevation2: "transparent",
    accent1: "rgb(200,20,100)",
    accent2: "rgb(220,20,100)",
    accent3: "rgb(255,20,100)",
  },
  space: {
    sm: "0.875rem",
    md: "0.875rem",
    rowGap: "0.875rem",
  },
  sizes: {
    numberInputMinWidth: "70px",
    controlWidth: "246px",
    folderTitleHeight: "2rem",
  },
  fontSizes: { root: "0.875rem" },
}

const tabs = ["data", "model", "train", "about"]

interface LevaStores {
  dataStore: StoreType
  modelStore: StoreType
  trainStore: StoreType
}

const LevaStoresContext = createContext<LevaStores>({} as LevaStores)

export function withLevaStores<T extends object>(
  Component: React.ComponentType<T>
) {
  const WrappedComponent = (props: T) => {
    const dataStore = useCreateStore()
    const modelStore = useCreateStore()
    const trainStore = useCreateStore()
    return (
      <LevaStoresContext.Provider value={{ dataStore, modelStore, trainStore }}>
        <Component {...props} />
      </LevaStoresContext.Provider>
    )
  }
  return WrappedComponent
}

export function useLevaStores() {
  return useContext(LevaStoresContext)
}

export const Menu = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<string | null>("train")
  const stores = useContext(LevaStoresContext)
  const currStore = stores?.[(activeTab + "Store") as keyof LevaStores]
  const currTab = useMemo(
    () =>
      currStore ? (
        <LevaPanel
          key={currStore?.storeId ?? "empty"}
          store={currStore}
          fill
          hideCopyButton
          titleBar={false}
          theme={levaTheme}
        />
      ) : activeTab === "about" ? (
        <About />
      ) : null,
    [currStore, activeTab]
  )
  const lastTab = useRef(currTab)
  useEffect(() => {
    if (currTab) lastTab.current = currTab
  }, [currTab])
  return (
    <div className="fixed top-0 right-0 z-10 text-right pointer-events-none">
      <button
        className={`sm:hidden text-right px-3 py-2 sm:p-4 z-10 cursor-pointer text-white pointer-events-auto`}
        onClick={() => setMenuOpen((o) => !o)}
      >
        {menuOpen ? "x" : "menu"}
      </button>
      <div
        className={`${
          menuOpen ? "" : "translate-x-full"
        } sm:translate-x-0 transition-transform duration-300 ease-in-out`}
      >
        <div className="flex justify-end pointer-events-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`px-3 py-2 sm:p-4 cursor-pointer ${
                tab === activeTab ? "text-white" : "text-gray-text"
              }`}
              onClick={() => {
                setActiveTab((t) => (t === tab ? null : tab))
              }}
            >
              {tab}
            </button>
          ))}
        </div>
        <div
          className={`z-10 w-[375px] max-w-[100vw] ${
            !!currTab ? "" : "translate-x-full"
          } transition-transform duration-300 ease-in-out pointer-events-auto`}
        >
          {currTab ?? lastTab.current}
        </div>
      </div>
      <Leva hidden />
    </div>
  )
}

const About = () => (
  <div
    className="p-4 text-gray-text rounded-[10px] text-left text-sm"
    style={{
      backgroundColor: levaTheme.colors?.elevation1,
    }}
  >
    Hi, I am Daniel. How are you?
    <br />
    <br />
    Check out my{" "}
    <a
      className="text-white"
      target="_blank"
      href="https://danielmarcus.de/"
      style={{ color: levaTheme.colors?.accent2 }}
    >
      website
    </a>
    !
  </div>
)
