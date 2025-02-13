import { Box, CollapsibleWithTitle, MenuBtn } from "@/components/ui-elements"
import { useDatasetStore } from "@/data/data"
import { useDebugStore } from "@/utils/debug"
import { datasets } from "@/data/datasets"
import { MyDatasets } from "./data_my-datasets"

export const Data = () => {
  const currDatasetKey = useDatasetStore((s) => s.datasetKey)
  const setDatasetKey = useDatasetStore((s) => s.setDatasetKey)
  const isDebug = useDebugStore((s) => s.debug)
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
                onClick={() => setDatasetKey(d.key)}
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
