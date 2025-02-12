import { useDatasetStore } from "@/data/datasets"
import { useVisConfigStore } from "@/lib/vis-config"
import {
  Checkbox,
  ControlPanel,
  InputRow,
  Select,
  Slider,
} from "@/ui-components"

const SHIFT_PROPS = ["xShift", "yShift", "zShift"] as const

export const VisConfigControl = () => {
  const { setVisConfig, getDefault, reset, ...config } = useVisConfigStore()
  const ds = useDatasetStore((s) => s.ds)
  const hasColorChannels = (ds?.train.shapeX[3] ?? 0) > 1
  return (
    <ControlPanel title="visualization" variant="no-bg" collapsed>
      {SHIFT_PROPS.map((prop) => {
        const value = config[prop]
        const isDefault = getDefault(prop) === value
        const label = isDefault ? (
          prop
        ) : (
          <div className="flex justify-between">
            <div>{prop}</div>
            <button onClick={() => reset(prop)} className="px-2">
              ↺
            </button>
          </div>
        )
        return (
          <InputRow key={prop} label={label}>
            <Slider
              value={value}
              min={-30}
              max={30}
              onChange={(v) => setVisConfig({ [prop]: v })}
              showValue
              markers={[0]}
            />
          </InputRow>
        )
      })}
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
