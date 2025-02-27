import { DB_PREFIX } from "@/data/db"
import { setStatus, useStore } from "@/store"
import { deleteDB } from "idb"
import { useEffect, useState } from "react"
import { CollapsibleWithTitle } from "../ui-elements"
import { datasets } from "@/data/datasets"
import { resetData, setDsFromDb, setDsFromKey } from "@/data/dataset"

export const MyDatasets = () => {
  const ds = useStore((s) => s.ds)
  const totalSamples = useStore((s) => s.totalSamples())
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
      useStore.setState({ ds: undefined })
    }
    await deleteDB(fullName)
    updateDatasets()
    setStatus("", null)
  }
  const handleSelect = async (dsKey: string) => {
    if (datasets.find((d) => d.key === dsKey)) {
      setDsFromKey(dsKey)
    } else {
      setDsFromDb(dsKey)
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
                {isCurrent && ds.isUserGenerated && !!totalSamples && (
                  <button
                    className="px-2"
                    onClick={() => {
                      resetData(ds.key, "train")
                      resetData(ds.key, "test")
                    }}
                  >
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
