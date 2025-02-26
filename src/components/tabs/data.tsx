import { Box, CollapsibleWithTitle } from "@/components/ui-elements"
import { datasets } from "@/data/datasets"
import { MyDatasets } from "./data_my-datasets"
import { useStore } from "@/store"

export const Data = () => {
  const currDatasetKey = useStore((s) => s.datasetKey)
  const isDebug = useStore((s) => s.isDebug)
  return (
    <Box>
      <MyDatasets />
      <CollapsibleWithTitle title="dataset library" border={false}>
        <div className="flex flex-col">
          {datasets
            .filter((d) => isDebug || !d.disabled)
            .map((d) => (
              <button
                key={d.name}
                className={`text-left py-2 has-menu-border hover:bg-menu-border ${
                  currDatasetKey === d.key ? "text-white border-accent!" : ""
                }`}
                onClick={() => useStore.setState({ datasetKey: d.key })}
              >
                <strong>{d.name}</strong> ({d.task})<br />
                {d.description}
              </button>
            ))}
        </div>
      </CollapsibleWithTitle>
      {/* <div className="p-4 flex justify-end">
        <InlineButton>create new</InlineButton>
      </div> */}
    </Box>
  )
}
