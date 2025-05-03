import { useRef, type ReactNode } from "react"
import { setLayerConfigs, useCurrScene, useGlobalStore } from "@/store"
import * as Components from "@/components/ui-elements"
import { getLayerDef, layerDefMap } from "@/model/layers"
import { isVisible } from "@/neuron-layers/layers"
import type {
  LayerConfig,
  LayerConfigArray,
  LayerConfigMap,
} from "@/model/layers/types"

const { InputRow, Slider, Select, Button } = Components
const { CollapsibleWithTitle, DraggableList } = Components

function getInputComp<T extends keyof LayerConfigMap>(
  layerConfig: LayerConfig<T>,
  updateLayerConfig: <C extends keyof LayerConfigMap>(
    config: LayerConfig<C>["config"]
  ) => void,
  isLast: boolean
): ReactNode {
  const sharedSliderProps = { showValue: true, lazyUpdate: true }
  const { className } = layerConfig

  const layerDef = getLayerDef(className)
  const config = layerConfig.config as LayerConfigMap[typeof className]
  // TODO: allow multiple options + other inputTypes
  const option = layerDef?.options?.[0]

  if (className === "InputLayer") {
    const config = layerConfig.config as LayerConfigMap["InputLayer"]
    const [, ...dims] = config.batchInputShape as number[]
    return <div className="text-right">{dims.join(" x ")}</div>
  } else if (className === "Dense" && isLast)
    return (
      <div className="text-right">
        {(config as LayerConfigMap["Dense"]).units!}
      </div>
    )
  else if (option && option.inputType === "slider") {
    const { name, min, max, step } = option
    const { transformFromSliderVal, transformToSliderVal } = option
    const sliderVal =
      transformToSliderVal?.(config[name] as number) ?? (config[name] as number)
    return (
      <Slider
        {...sharedSliderProps}
        min={min}
        max={max}
        step={step}
        value={sliderVal}
        onChange={(val) => updateLayerConfig({ ...config, [option.name]: val })}
        transform={transformFromSliderVal}
      />
    )
  } else return null
}

function newDefaultLayer<T extends keyof LayerConfigMap>(
  className: T
): LayerConfig<T> {
  const config = getLayerDef(className)?.defaultConfig ?? {}
  const layer = { className, config }
  return layer as LayerConfig<T>
}

export const LayerConfigControl = () => {
  const model = useCurrScene((s) => s.model)
  const layerConfigs = (model?.getConfig().layers ??
    []) as unknown as LayerConfigArray
  const resetLayerConfigs = useCurrScene((s) => s.resetLayerConfigs)

  const selectRef = useRef<HTMLSelectElement>(null)
  const handleAdd = () => {
    if (!selectRef.current) return
    const className = selectRef.current.value as keyof LayerConfigMap
    const newLayer = newDefaultLayer(className)

    const flattenIdx =
      layerConfigs.findIndex((l) => l.className === "Flatten") ||
      layerConfigs.findIndex((l) => l.className === "Dense")
    const beforeOutputIdx = Math.max(layerConfigs.length - 1, 1)

    const layerDef = getLayerDef(className)

    const insertIdx =
      className === "RandomRotation"
        ? 1 // insert RandomRotation after InputLayer
        : layerDef?.needsMultiDim && flattenIdx > -1
        ? flattenIdx // always insert Conv2D and MaxPooling2D before Flatten
        : beforeOutputIdx // default
    const newLayerConfigs = layerConfigs.toSpliced(insertIdx, 0, newLayer)
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
    }, // TODO: disabled / filter condition in LayerDef?
    ...Object.keys(layerDefMap)
      .filter((key) => getLayerDef(key)?.isUserAddable)
      .map((key) => ({
        value: key,
        disabled: getLayerDef(key)?.needsMultiDim && !hasMutliDimInput,
      })),
  ]
  const invisibleLayers = useCurrScene((s) => s.vis.invisibleLayers)
  if (!model) return null
  return (
    <CollapsibleWithTitle title={"layers"} className="bg-box-solid">
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
              !isVisible(model.layers[i])
            const mustBe =
              i === 0 ||
              i === layerConfigs.length - 1 ||
              layer.className === "Flatten"
            const label = (
              <div className="flex justify-between">
                <div className="flex truncate">
                  <div className="truncate">
                    {layer.className
                      .replace("InputLayer", "Input")
                      .replace("MaxPooling2D", "MaxPool")}
                  </div>
                </div>
                {!mustBe && (
                  <button
                    onClick={() => handleRemove(i)}
                    className="px-2 active:text-white"
                  >
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
            <Button variant="secondary" onClick={resetLayerConfigs}>
              reset
            </Button>
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
    ["Conv2D", "MaxPooling2D", "RandomRotation"].includes(l.className)
  )

  if (newOrder[0] !== 0) {
    setStatus("Input layer must be the first layer")
    return false
  } else if (newOrder.at(-1) !== layerConfigs.length - 1) {
    setStatus("Output layer must be the last layer")
    return false
  } else if (lastMultiDimIdx > 0 && flattenIdx < lastMultiDimIdx) {
    setStatus(
      "Conv2D, MaxPooling2D, and RandomRotation must come before Flatten"
    )
    return false
  } else if (firstDenseIdx > 0 && flattenIdx > firstDenseIdx) {
    setStatus("Dense must come after Flatten")
    return false
  }
  return true
}
