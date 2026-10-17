import { Box } from "@/components/ui-elements"
import { useCurrScene } from "@/store"
import { isLoraDs } from "@/model/lora/training"
import { MyModels } from "./model_my-models"
import { LoraAdapterControl } from "./model_lora"
import { LayerConfigControl } from "./model_layers"
import { VisConfigControl } from "./model_vis"

export const Model = () => {
  const isLora = useCurrScene((s) => isLoraDs(s.ds))
  return (
    <Box>
      <MyModels />
      {isLora && <LoraAdapterControl />}
      <LayerConfigControl />
      <VisConfigControl />
    </Box>
  )
}
