import { createContext, useContext } from "react"
import { LevaPanel, useCreateStore } from "leva"
import { StoreType } from "leva/dist/declarations/src/types"
import { LevaCustomTheme } from "leva/dist/declarations/src/styles"

export interface ControlStores {
  dataStore: StoreType
  modelStore: StoreType
  trainStore: StoreType
}

const ControlStoresContext = createContext<ControlStores>({} as ControlStores)

export function useControlStores() {
  return useContext(ControlStoresContext)
}

export function withControlStores<T extends object>(
  Component: React.ComponentType<T>
) {
  const WrappedComponent = (props: T) => {
    const dataStore = useCreateStore()
    const modelStore = useCreateStore()
    const trainStore = useCreateStore()
    return (
      <ControlStoresContext.Provider
        value={{ dataStore, modelStore, trainStore }}
      >
        <Component {...props} />
      </ControlStoresContext.Provider>
    )
  }
  return WrappedComponent
}

export const controlTheme: LevaCustomTheme = {
  colors: {
    elevation1: "var(--color-box-bg)",
    elevation2: "transparent",
    accent1: "rgb(200,20,100)",
    accent2: "var(--color-accent)",
    accent3: "rgb(255,20,100)",
    toolTipBackground: "white",
    toolTipText: "black",
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

export const ControlPanel = ({ store }: { store: StoreType }) => (
  <LevaPanel
    store={store}
    key={store.storeId}
    fill
    hideCopyButton
    titleBar={false}
    theme={controlTheme}
  />
)
