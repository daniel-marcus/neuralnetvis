import { createRef, useEffect } from "react"
import * as tf from "@tensorflow/tfjs"
import { useSceneStore } from "@/store"
import { getMeshParams } from "./layout"
import { getLayerDef } from "@/model/layers"
import type { InstancedMesh } from "three"
import type { Layer } from "@tensorflow/tfjs-layers/dist/exports_layers"
import type { LayerPos, NeuronLayer, LayerType } from "./types"

// returns an array of all visible layers
export function useLayers() {
  const model = useSceneStore((s) => s.model)
  const ds = useSceneStore((s) => s.ds)
  const layers = useSceneStore((s) => s.allLayers)
  const setLayers = useSceneStore((s) => s.setAllLayers)
  useEffect(() => {
    if (!model) return
    const visibleIdxMap = getVisibleIdxMap(model)
    const newLayers =
      model.layers.reduce((acc, tfLayer, layerIndex) => {
        const visibleIdx = visibleIdxMap.get(layerIndex) ?? -1
        if (shouldSkip(visibleIdx, visibleIdxMap.size)) return acc

        const className = tfLayer.getClassName() as LayerType
        const layerPos = getLayerPos(layerIndex, model)

        const prevLayer = acc.find((l) => l.visibleIdx === visibleIdx - 1)

        const units = getUnits(tfLayer)
        const meshParams =
          ["BatchNormalization", "RandomRotation"].includes(className) &&
          !!prevLayer
            ? prevLayer.meshParams
            : getMeshParams(tfLayer, layerPos, units)
        const numBiases = (tfLayer.getConfig().filters as number) ?? units
        const outputShape = tfLayer.outputShape as number[]

        const hasColorChannels = layerPos === "input" && outputShape[3] === 3

        const layerMeshRef = createRef<InstancedMesh>()
        const groupCount = (tfLayer.outputShape?.[3] as number | undefined) ?? 1
        const groupMeshRefs = Array.from({ length: groupCount }).map(() =>
          createRef<InstancedMesh>()
        )

        const layer: NeuronLayer = {
          lid: `${tfLayer.name}_${units}`,
          index: layerIndex,
          visibleIdx,
          layerType: className,
          layerPos,
          tfLayer,
          prevLayer,
          numNeurons: units,
          numBiases,
          meshRefs: hasColorChannels ? groupMeshRefs : [layerMeshRef],
          meshParams,
          hasLabels:
            (layerPos === "input" && !!ds?.inputLabels?.length) ||
            (layerPos === "output" && !!ds?.outputLabels?.length),
          hasColorChannels,
          rgbColors: new Float32Array(units), //  * 3),
          rgbaColors: new Uint32Array(units),
        }
        return [...acc, layer]
      }, [] as NeuronLayer[]) ?? []
    setLayers(newLayers)
    return () => setLayers([])
  }, [model, ds, setLayers])
  return layers
}

const MAX_VISIBLE_LAYERS = 100

// avoid browser crash with too large models
function shouldSkip(visibleIdx: number, totalVisibleLayers: number) {
  if (visibleIdx === -1) return true
  if (visibleIdx === totalVisibleLayers - 1) return false // always include output layer
  const result = visibleIdx > MAX_VISIBLE_LAYERS
  if (result) {
    const msg = `Max visible layers exceeded. Skipping layer ${visibleIdx}/${totalVisibleLayers}`
    console.log(msg)
  }
  return result
}

export function isVisible(layer: Layer) {
  const className = layer.getClassName()
  const layerDef = getLayerDef(className)
  return !layerDef?.isInvisible
}

const getVisibleIdxMap = (model: tf.LayersModel) => {
  return model.layers.reduce(
    (map, layer, i) => (isVisible(layer) ? map.set(i, map.size) : map),
    new Map<number, number>()
  )
}

export function getUnits(layer: Layer) {
  const [, ...dims] = layer.outputShape as number[]
  return dims.reduce((a, b) => a * b, 1)
}

function getLayerPos(layerIndex: number, model: tf.LayersModel): LayerPos {
  if (layerIndex === 0) return "input"
  else if (layerIndex === model.layers.length - 1) return "output"
  else return "hidden"
}
