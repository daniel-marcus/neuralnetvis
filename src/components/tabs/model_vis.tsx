import { useStore } from "@/store"
import {
  Checkbox,
  CollapsibleWithTitle,
  InputRow,
  Select,
  Slider,
} from "@/components/ui-elements"
import type { HighlightProp } from "@/neuron-layers"

const SHIFT_PROPS = ["xShift", "yShift", "zShift"] as const

export const VisConfigControl = () => {
  const vis = useStore((s) => s.vis)
  const { setConfig, getDefault, reset, ...config } = vis
  const model = useStore((s) => s.model)
  const hasColorChannels =
    ((model?.layers[0].outputShape[3] as number) ?? 0) > 1
  return (
    <CollapsibleWithTitle title="visualization" variant="no-bg" collapsed>
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
        const axis = prop.slice(0, 1)
        return (
          <InputRow
            key={prop}
            label={label}
            hint={`layer spacing along the ${axis} axis`}
          >
            <Slider
              value={value}
              min={-30}
              max={30}
              onChange={(v) => setConfig({ [prop]: v })}
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
      <InputRow
        label="showLines"
        hint="show (strongest) connections between neurons"
      >
        <Checkbox
          checked={config.showLines}
          onChange={(showLines) => setConfig({ showLines })}
        />
      </InputRow>
      {hasColorChannels && (
        <InputRow label="splitColors" hint="show color channels separately">
          <Checkbox
            checked={config.splitColors}
            onChange={(splitColors) => setConfig({ splitColors })}
          />
        </InputRow>
      )}
      <InputRow
        label="onSelect"
        hint="What should be shown when you hover or click on a neuron?"
      >
        <Select
          value={config.highlightProp ?? ""}
          options={[
            { value: "weights" as const, label: "show weights" },
            { value: "weightedInputs" as const, label: "show weighted inp." },
          ]}
          onChange={(val) => setConfig({ highlightProp: val as HighlightProp })}
        />
      </InputRow>
    </CollapsibleWithTitle>
  )
}
