import { Box, CollapsibleWithTitle, MenuBtn } from "@/components/ui-elements"
import { datasets } from "@/data/datasets"
import { MyDatasets } from "./data_my-datasets"
import { useStore } from "@/store"

export const Data = () => {
  const currDatasetKey = useStore((s) => s.datasetKey)
  const isDebug = useStore((s) => s.isDebug)
  return (
    <Box>
      <div className="flex flex-col gap-2">
        <CollapsibleWithTitle title="my datasets" collapsed>
          <MyDatasets />
        </CollapsibleWithTitle>
        <div className="flex flex-col">
          {datasets
            .filter((d) => isDebug || !d.disabled)
            .map((d) => (
              <MenuBtn
                key={d.name}
                isActive={currDatasetKey === d.key}
                onClick={() => useStore.setState({ datasetKey: d.key })}
              >
                <strong>{d.name}</strong> ({d.task})<br />
                {d.description}
              </MenuBtn>
            ))}
        </div>
      </div>
    </Box>
  )
}
