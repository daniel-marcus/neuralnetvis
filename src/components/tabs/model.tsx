import { Box } from "@/components/ui-elements"
import { MyModels } from "./model_my-models"
import { LayerConfigControl } from "./model_layers"
import { VisConfigControl } from "./model_vis"

export const Model = () => (
  <Box>
    <MyModels />
    <LayerConfigControl />
    <VisConfigControl />
  </Box>
)
