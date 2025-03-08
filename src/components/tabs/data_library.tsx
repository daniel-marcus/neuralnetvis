import { useGlobalStore } from "@/store"
import { CollapsibleWithTitle } from "../ui-elements"
import { datasets } from "@/data/datasets"
import { setDsFromKey } from "@/data/dataset"

export const DatasetLibrary = () => {
  const currDatasetKey = useGlobalStore((s) => s.ds?.key)
  const isDebug = useGlobalStore((s) => s.isDebug)
  return (
    <CollapsibleWithTitle
      title="dataset library"
      variant="no-bg"
      border={false}
    >
      <div className="flex flex-col">
        {datasets
          .filter((d) => isDebug || !d.disabled)
          .map((d) => (
            <button
              key={d.name}
              className={`text-left py-2 has-menu-border hover:bg-menu-border ${
                currDatasetKey === d.key ? "text-white border-accent!" : ""
              }`}
              onClick={() => setDsFromKey(d.key)}
            >
              <strong>{d.name}</strong> ({d.task})<br />
              {d.description}
            </button>
          ))}
      </div>
    </CollapsibleWithTitle>
  )
}
