import { useDatasetStore } from "@/data/datasets"
import { useVisConfigStore } from "@/lib/vis-config"
import {
  Checkbox,
  ControlPanel,
  InputRow,
  Select,
  Slider,
} from "@/ui-components"

export const VisConfigControl = () => {
  const { setVisConfig, ...config } = useVisConfigStore()
  const ds = useDatasetStore((s) => s.ds)
  const hasColorChannels = (ds?.train.shapeX[3] ?? 0) > 1
  return (
    <ControlPanel title="visualization" variant="no-bg" collapsed>
      <InputRow label="xShift">
        <Slider
          value={config.xShift}
          min={-30}
          max={30}
          onChange={(xShift) => setVisConfig({ xShift })}
          showValue
        />
      </InputRow>
      <InputRow label="yShift">
        <Slider
          value={config.yShift}
          min={-30}
          max={30}
          onChange={(yShift) => setVisConfig({ yShift })}
          showValue
        />
      </InputRow>
      <InputRow label="zShift">
        <Slider
          value={config.zShift}
          min={-30}
          max={30}
          onChange={(zShift) => setVisConfig({ zShift })}
          showValue
        />
      </InputRow>
      {/* <InputRow label="nodeSpacing">
        <Slider
          value={config.neuronSpacing}
          min={1}
          max={5}
          step={0.001}
          onChange={(neuronSpacing) => setVisConfig({ neuronSpacing })}
          showValue
        />
      </InputRow> */}
      <InputRow label="showLines">
        <Checkbox
          checked={config.showLines}
          onChange={(showLines) => setVisConfig({ showLines })}
        />
      </InputRow>
      {hasColorChannels && (
        <InputRow label="splitColors">
          <Checkbox
            checked={config.splitColors}
            onChange={(splitColors) => setVisConfig({ splitColors })}
          />
        </InputRow>
      )}
      <InputRow label="onSelect">
        <Select
          value={config.highlightProp}
          options={[
            { value: "weights", label: "show weights" },
            { value: "weightedInputs", label: "show weighted inputs" },
          ]}
          onChange={(highlightProp) => setVisConfig({ highlightProp })}
        />
      </InputRow>
    </ControlPanel>
  )
}
