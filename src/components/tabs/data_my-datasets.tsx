import { DB_PREFIX } from "@/data/db"
import { setStatus, useStore } from "@/store"
import { deleteDB } from "idb"
import { useEffect, useState } from "react"

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
  return (
    <ul className="pl-4 border-l border-menu-border mb-4">
      {savedDatasets.map((d, i) => {
        const isCurrent = d === ds?.key
        return (
          <li
            key={i}
            className={`flex justify-between ${isCurrent ? "text-white" : ""}`}
          >
            <button
              className={isCurrent ? "disabled pointer-events-none" : ""}
              onClick={() => useStore.setState({ datasetKey: d })}
            >
              {d}
            </button>
            <div>
              <button className="pl-2" onClick={() => removeDataset(d)}>
                x
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
