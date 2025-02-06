import {
  HiddenLayerConfig,
  HiddenLayerConfigArray,
  LayerConfigMap,
  useModelStore,
} from "@/lib/model"
import { ControlPanel, InputRow, Select, Slider } from "@/ui-components"
import { useRef } from "react"

function getSliderProps<T extends keyof LayerConfigMap>(
  layerConfig: HiddenLayerConfig<T>
) {
  if (layerConfig.className === "Dense") {
    const config = layerConfig.config as LayerConfigMap["Dense"]
    return {
      min: 1,
      max: 256,
      value: config.units,
      // label: "Units",
    }
  } else if (layerConfig.className === "Conv2D") {
    const config = layerConfig.config as LayerConfigMap["Conv2D"]
    return {
      min: 1,
      max: 32,
      value: config.filters,
      // label: "Filters",
    }
  } else if (layerConfig.className === "MaxPooling2D") {
    return null
  } else if (layerConfig.className === "Flatten") {
    return null
  } else if (layerConfig.className === "Dropout") {
    const config = layerConfig.config as LayerConfigMap["Dropout"]
    return {
      min: 0,
      max: 0.95,
      step: 0.05,
      value: config.rate,
      // label: "Rate",
    }
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
}

function newDefaultLayer<T extends keyof LayerConfigMap>(
  className: T
): HiddenLayerConfig<T> {
  const layer = { className, config: { ...defaultConfigMap[className] } }
  return layer as HiddenLayerConfig<T>
}

export const LayerConfigControl = () => {
  const model = useModelStore((s) => s.model)
  const layerConfigs = (model?.getConfig().layers ??
    []) as unknown as HiddenLayerConfigArray
  const _hiddenLayers = layerConfigs.slice(1, -1)
  const hiddenLayers = _hiddenLayers.filter((l) => l.className !== "Flatten")
  const setHiddenLayers = useModelStore((s) => s.setHiddenLayers)

  const handleLayerChange = (i: number, val: number) => {
    const layer = hiddenLayers[i]
    if (layer.className === "Dense") {
      ;(layer.config as LayerConfigMap["Dense"]).units = val
    } else if (layer.className === "Conv2D") {
      ;(layer.config as LayerConfigMap["Conv2D"]).filters = val
    } else if (layer.className === "Dropout") {
      ;(layer.config as LayerConfigMap["Dropout"]).rate = val
    } else {
      console.log("unhandled layer type", layer)
    }
    setHiddenLayers([...hiddenLayers])
  }
  const selectRef = useRef<HTMLSelectElement>(null)
  const handleAdd = () => {
    if (!selectRef.current) return
    const className = selectRef.current.value
    const newLayer = newDefaultLayer(className as keyof LayerConfigMap)
    // always insert Conv2D and MaxPooling2D before Dense (which comes with Flatten)
    const firstDenseIdx = hiddenLayers.findIndex((l) => l.className === "Dense")
    const newHiddenLayers =
      ["MaxPooling2D", "Conv2D"].includes(className) && firstDenseIdx > -1
        ? hiddenLayers.toSpliced(firstDenseIdx, 0, newLayer)
        : [...hiddenLayers, newLayer]
    setHiddenLayers(newHiddenLayers)
  }
  const handleRemove = (i: number) => {
    setHiddenLayers(hiddenLayers.filter((_, j) => j !== i))
  }
  const hasMutliDimInput =
    model?.layers[0].batchInputShape &&
    model?.layers[0].batchInputShape.length > 2
  const selectOptions = [
    {
      value: "",
      label: "add",
      disabled: true,
    },
    { value: "Dense" },
    { value: "Conv2D", disabled: !hasMutliDimInput },
    { value: "MaxPooling2D", disabled: !hasMutliDimInput },
    { value: "Dropout" },
  ]
  return (
    <ControlPanel title={"hidden layers"}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {hiddenLayers.map((layer, i) => {
            const sliderProps = getSliderProps(layer)
            const label = (
              <div className="flex justify-between">
                <div>
                  {layer.className
                    .replace("MaxPooling", "MaxPool")
                    .replace("Flatten", "(Flatten)")}
                </div>
                <button onClick={() => handleRemove(i)} className="px-2">
                  x
                </button>
              </div>
            )
            return (
              <InputRow key={i} label={label}>
                {sliderProps !== null && (
                  <Slider
                    {...sliderProps}
                    onChange={(val) => handleLayerChange(i, val)}
                    showValue={true}
                    lazyUpdate={true}
                  />
                )}
              </InputRow>
            )
          })}
        </div>
        <InputRow
          label={
            <Select
              ref={selectRef}
              options={selectOptions}
              onChange={handleAdd}
              value={""}
            />
          }
        >
          <div className="flex justify-start items-center gap-4"></div>
        </InputRow>
      </div>
    </ControlPanel>
  )
}
