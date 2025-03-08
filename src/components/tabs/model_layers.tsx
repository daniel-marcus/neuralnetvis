import { useRef, type ReactNode } from "react"
import { setLayerConfigs, useGlobalStore } from "@/store"
import * as Components from "@/components/ui-elements"
import type { LayerConfig, LayerConfigArray, LayerConfigMap } from "@/model"

const { InputRow, Slider, Select, InlineButton } = Components
const { CollapsibleWithTitle, DraggableList } = Components

function getInputComp<T extends keyof LayerConfigMap>(
  layerConfig: LayerConfig<T>,
  updateLayerConfig: <C extends keyof LayerConfigMap>(
    config: LayerConfig<C>["config"]
  ) => void,
  isLast: boolean
): ReactNode {
  const sharedSliderProps = { showValue: true, lazyUpdate: true }
  if (layerConfig.className === "InputLayer") {
    const config = layerConfig.config as LayerConfigMap["InputLayer"]
    const [, ...dims] = config.batchInputShape as number[]
    return <div className="text-right">{dims.join(" x ")}</div>
  } else if (layerConfig.className === "Dense") {
    const config = layerConfig.config as LayerConfigMap["Dense"]
    if (isLast) return <div className="text-right">{config.units}</div>
    return (
      <Slider
        {...sharedSliderProps}
        min={0}
        max={9} // 2^9 = 512
        value={Math.log2(config.units)}
        transform={(v) => 2 ** v}
        onChange={(units) => updateLayerConfig({ ...config, units })}
      />
    )
  } else if (layerConfig.className === "Conv2D") {
    const config = layerConfig.config as LayerConfigMap["Conv2D"]
    return (
      <Slider
        {...sharedSliderProps}
        min={0}
        max={6} // 2^6 = 64
        value={Math.log2(config.filters)}
        transform={(v) => 2 ** v}
        onChange={(filters) => updateLayerConfig({ ...config, filters })}
      />
    )
  } else if (layerConfig.className === "MaxPooling2D") {
    return null
  } else if (layerConfig.className === "Flatten") {
    return null
  } else if (layerConfig.className === "Dropout") {
    const config = layerConfig.config as LayerConfigMap["Dropout"]
    return (
      <Slider
        {...sharedSliderProps}
        min={0}
        max={0.95}
        step={0.05}
        value={config.rate}
        onChange={(rate) => updateLayerConfig({ ...config, rate })}
      />
    )
  } else {
    console.log("Unknown layer type", layerConfig)
  }
  return null
}

const defaultConfigMap: { [K in keyof LayerConfigMap]: LayerConfigMap[K] } = {
  Dense: { units: 64, activation: "relu" },
  Conv2D: { filters: 4, kernelSize: 3, activation: "relu" },
  MaxPooling2D: { poolSize: 2 },
  Flatten: {},
  Dropout: { rate: 0.2 },
  InputLayer: {}, // will be set from ds shape
}

function newDefaultLayer<T extends keyof LayerConfigMap>(
  className: T
): LayerConfig<T> {
  const layer = { className, config: { ...defaultConfigMap[className] } }
  return layer as LayerConfig<T>
}

export const LayerConfigControl = () => {
  const model = useGlobalStore((s) => s.model)
  const layerConfigs = (model?.getConfig().layers ??
    []) as unknown as LayerConfigArray
  const resetLayerConfigs = useGlobalStore((s) => s.resetLayerConfigs)

  const selectRef = useRef<HTMLSelectElement>(null)
  const handleAdd = () => {
    if (!selectRef.current) return
    const className = selectRef.current.value
    const newLayer = newDefaultLayer(className as keyof LayerConfigMap)
    // always insert Conv2D and MaxPooling2D before Flatten
    const flattenIdx =
      layerConfigs.findIndex((l) => l.className === "Flatten") ||
      layerConfigs.findIndex((l) => l.className === "Dense")
    const beforeOutputIdx = Math.max(layerConfigs.length - 1, 1)
    const newLayerConfigs =
      ["MaxPooling2D", "Conv2D"].includes(className) && flattenIdx > -1
        ? layerConfigs.toSpliced(flattenIdx, 0, newLayer)
        : layerConfigs.toSpliced(beforeOutputIdx, 0, newLayer)
    setLayerConfigs(newLayerConfigs)
  }
  const handleRemove = (i: number) => {
    setLayerConfigs(layerConfigs.filter((_, j) => j !== i))
  }
  const hasMutliDimInput =
    model?.layers[0].batchInputShape &&
    model?.layers[0].batchInputShape.length > 2
  const selectOptions = [
    {
      value: "empty",
      label: "add",
      disabled: true,
    },
    { value: "Dense" },
    { value: "Conv2D", disabled: !hasMutliDimInput },
    { value: "MaxPooling2D", disabled: !hasMutliDimInput },
    { value: "Dropout" },
  ]
  const toggleLayerVisibility = useGlobalStore(
    (s) => s.vis.toggleLayerVisibility
  )
  const invisibleLayers = useGlobalStore((s) => s.vis.invisibleLayers)
  return (
    <CollapsibleWithTitle title={"layers"}>
      <div className="flex flex-col gap-4">
        <DraggableList
          rowHeight={32}
          onOrderChange={(newOrder) => {
            const newLayerConfigs = newOrder.map((i) => layerConfigs[i])
            setLayerConfigs([...newLayerConfigs])
          }}
          checkValidChange={(newOrder) =>
            checkVaildOrder(newOrder, layerConfigs)
          }
        >
          {layerConfigs.map((layer, i) => {
            function updateLayerConfig<T extends keyof LayerConfigMap>(
              newConfig: LayerConfig<T>["config"]
            ) {
              layerConfigs[i].config = newConfig
              setLayerConfigs([...layerConfigs])
            }
            const isLast = i === layerConfigs.length - 1
            const inputComp = getInputComp(layer, updateLayerConfig, isLast)

            const isInvisible =
              invisibleLayers.includes(layer.config.name ?? "") ||
              layer.className === "Flatten"
            const mustBe =
              i === 0 ||
              i === layerConfigs.length - 1 ||
              layer.className === "Flatten"
            const label = (
              <div className="flex justify-between">
                <div className="flex">
                  <button
                    onClick={() => toggleLayerVisibility(layer.config.name!)}
                    className="pr-3"
                  >
                    {isInvisible ? "⍉" : "⌾"}
                  </button>
                  <div>
                    {layer.className
                      .replace("InputLayer", "Input")
                      .replace("MaxPooling2D", "MaxPool")
                      .replace("Flatten", "Flatten")}
                  </div>
                </div>
                {!mustBe && (
                  <button onClick={() => handleRemove(i)} className="px-2">
                    x
                  </button>
                )}
              </div>
            )
            return (
              <InputRow
                key={`${i}_${layer.className}`}
                label={label}
                className={isInvisible ? "opacity-50" : ""}
              >
                {inputComp}
              </InputRow>
            )
          })}
        </DraggableList>
        <InputRow
          label={
            <Select
              key={`select_${layerConfigs.length}`}
              ref={selectRef}
              options={selectOptions}
              onChange={handleAdd}
              value={selectOptions[0].value}
            />
          }
        >
          <div className="flex justify-end items-center gap-4">
            <InlineButton variant="secondary" onClick={resetLayerConfigs}>
              reset
            </InlineButton>
          </div>
        </InputRow>
      </div>
    </CollapsibleWithTitle>
  )
}

function checkVaildOrder(newOrder: number[], layerConfigs: LayerConfigArray) {
  const setStatus = useGlobalStore.getState().status.update
  const newLayerConfigs = newOrder.map((i) => layerConfigs[i])

  const flattenIdx = newLayerConfigs.findIndex((l) => l.className === "Flatten")
  const firstDenseIdx = newLayerConfigs.findIndex(
    (l) => l.className === "Dense"
  )
  const lastMultiDimIdx = newLayerConfigs.findLastIndex((l) =>
    ["Conv2D", "MaxPooling2D"].includes(l.className)
  )

  if (newOrder[0] !== 0) {
    setStatus("Input layer must be the first layer")
    return false
  } else if (newOrder.at(-1) !== layerConfigs.length - 1) {
    setStatus("Output layer must be the last layer")
    return false
  } else if (lastMultiDimIdx > 0 && flattenIdx < lastMultiDimIdx) {
    setStatus("Conv2D and MaxPooling2D must come before Flatten")
    return false
  } else if (firstDenseIdx > 0 && flattenIdx > firstDenseIdx) {
    setStatus("Dense must come after Flatten")
    return false
  }
  return true
}
