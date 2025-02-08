import { Box, ControlPanel, InputRow, Slider, Checkbox } from "@/ui-components"
import { useVisConfigStore } from "@/lib/vis-config"
import { useDatasetStore } from "@/data/datasets"
import { MyModels } from "./model_my-models"
import { LayerConfigControl } from "./model_layers"

export const Model = () => (
  <Box>
    <MyModels />
    <LayerConfigControl />
    <VisConfigControl />
  </Box>
)

const VisConfigControl = () => {
  const { setVisConfig, ...config } = useVisConfigStore()
  const ds = useDatasetStore((s) => s.ds)
  const hasColorChannels = (ds?.train.shapeX[3] ?? 0) > 1
  return (
    <ControlPanel title="visualization" variant="no-bg" collapsed>
      <InputRow label="layerSpacing">
        <Slider
          value={config.layerSpacing}
          min={1}
          max={30}
          onChange={(val) => setVisConfig({ layerSpacing: val })}
        />
      </InputRow>
      <InputRow label="nodeSpacing">
        <Slider
          value={config.neuronSpacing}
          min={1}
          max={5}
          step={0.001}
          onChange={(val) => setVisConfig({ neuronSpacing: val })}
        />
      </InputRow>
      <InputRow label="showLines">
        <Checkbox
          checked={config.showLines}
          onChange={(val) => setVisConfig({ showLines: val })}
        />
      </InputRow>
      {hasColorChannels && (
        <InputRow label="splitColors">
          <Checkbox
            checked={config.splitColors}
            onChange={(val) => setVisConfig({ splitColors: val })}
          />
        </InputRow>
      )}
    </ControlPanel>
  )
}
