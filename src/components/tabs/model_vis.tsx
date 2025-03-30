import { useCurrScene, useGlobalStore } from "@/store"
import {
  Checkbox,
  CollapsibleWithTitle,
  InputRow,
  InputRowsWrapper,
  Select,
  Slider,
} from "@/components/ui-elements"
import type { HighlightProp } from "@/neuron-layers"

const SHIFT_PROPS = ["xShift", "yShift", "zShift"] as const

export const VisConfigControl = () => {
  const vis = useCurrScene((s) => s.vis)
  const { setConfig, getDefault, reset, ...config } = vis
  const model = useCurrScene((s) => s.model)
  const hasColorChannels =
    ((model?.layers[0].outputShape[3] as number) ?? 0) > 1
  const isDebug = useGlobalStore((s) => s.isDebug)
  return (
    <CollapsibleWithTitle title="visualization" collapsed>
      <InputRowsWrapper>
        {SHIFT_PROPS.map((prop) => {
          const value = config[prop]
          const isDefault = getDefault(prop) === value
          const axis = prop.slice(0, 1)
          return (
            <InputRow
              key={prop}
              label={prop}
              hint={`layer spacing along the ${axis} axis`}
              reset={isDefault ? undefined : () => reset(prop)}
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
        {isDebug && (
          <InputRow
            label={"nodeSpacing"}
            reset={
              config.neuronSpacing === getDefault("neuronSpacing")
                ? undefined
                : () => reset("neuronSpacing")
            }
            hint="spacing between neurons"
          >
            <Slider
              value={config.neuronSpacing}
              min={1}
              max={5}
              step={0.001}
              onChange={(neuronSpacing) => setConfig({ neuronSpacing })}
              showValue
            />
          </InputRow>
        )}
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
            key={`highlight_prop_${config.highlightProp}`}
            value={config.highlightProp ?? ""}
            options={[
              { value: "weights" as const, label: "show weights" },
              {
                value: "weightedInputs" as const,
                label: "show weighted inputs",
              },
            ]}
            onChange={(val) =>
              setConfig({ highlightProp: val as HighlightProp })
            }
          />
        </InputRow>
      </InputRowsWrapper>
    </CollapsibleWithTitle>
  )
}
