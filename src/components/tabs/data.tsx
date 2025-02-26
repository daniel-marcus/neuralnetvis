import { Box } from "@/components/ui-elements"
import { DatasetLibrary } from "./data_library"
import { MyDatasets } from "./data_my-datasets"
import { CreateNewDataset } from "./data_create-new"

export const Data = () => (
  <Box>
    <DatasetLibrary />
    <MyDatasets />
    <CreateNewDataset />
  </Box>
)
