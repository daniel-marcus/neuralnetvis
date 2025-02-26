import { DB_PREFIX } from "@/data/db"
import { setStatus, useStore } from "@/store"
import { deleteDB } from "idb"
import { useEffect, useState } from "react"
import { CollapsibleWithTitle } from "../ui-elements"
import { datasets } from "@/data/datasets"

export const MyDatasets = () => {
  const ds = useStore((s) => s.ds)
  const [savedDatasets, setSavedDatasets] = useState<string[]>([])
  const updateDatasets = async () => {
    try {
      const databases = await indexedDB.databases()
      const dsNames = databases
        .filter((d) => d.name?.startsWith(DB_PREFIX))
        .map((d) => d.name?.replace(DB_PREFIX, ""))
        .filter(Boolean) as string[]
      setSavedDatasets(dsNames)
    } catch (error) {
      console.error("Error listing databases:", error)
    }
  }
  useEffect(() => {
    updateDatasets()
  }, [ds])
  const removeDataset = async (dsKey: string) => {
    const fullName = `${DB_PREFIX}${dsKey}`
    setStatus(`Removing dataset ${dsKey} ...`, -1)
    if (dsKey === ds?.key) {
      useStore.setState({ datasetKey: undefined })
    }
    await deleteDB(fullName)
    updateDatasets()
    setStatus("", null)
  }
  const resetDataset = async (dsKey: string) => {
    await removeDataset(dsKey)
    useStore.setState({ datasetKey: dsKey })
  }
  const handleSelect = async (dsKey: string) => {
    if (datasets.find((d) => d.key === dsKey)) {
      useStore.setState({ datasetKey: dsKey })
    } else {
      window.alert("TODO")
    }
  }
  return (
    <CollapsibleWithTitle title="my datasets" border={false} collapsed>
      <ul>
        {savedDatasets.map((d, i) => {
          const isCurrent = d === ds?.key
          return (
            <li
              key={i}
              className={`flex has-menu-border justify-between ${
                isCurrent ? "text-white border-accent!" : ""
              }`}
            >
              <button
                className={isCurrent ? "disabled pointer-events-none" : ""}
                onClick={() => handleSelect(d)}
              >
                {d}
              </button>
              <div>
                {isCurrent && ds.isUserGenerated && (
                  <button className="px-2" onClick={() => resetDataset(d)}>
                    reset
                  </button>
                )}
                <button className="pl-2" onClick={() => removeDataset(d)}>
                  x
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </CollapsibleWithTitle>
  )
}
