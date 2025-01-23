import { useMemo } from "react"
import { create } from "zustand"
import { normalizeWithSign } from "./normalization"
import { useControls } from "leva"
import { LayerDef } from "@/components/layer"
import * as tf from "@tensorflow/tfjs"
import { NodeId } from "@/components/neuron"

export const useSelectedNodes = create<{
  selectedNode: NodeId | null
  toggleNode: (nodeId: NodeId) => void
}>((set) => ({
  selectedNode: null,
  toggleNode: (nodeId) =>
    set(({ selectedNode }) => ({
      selectedNode: selectedNode === nodeId ? null : nodeId,
    })),
}))

export function useNodeSelect(layerProps: LayerDef[]) {
  const { highlightProp } = useControls("ui", {
    highlightProp: {
      label: "onSelect",
      options: {
        "show weights": "weights",
        "show weighted inputs": "weightedInputs",
      },
    } as const,
  })
  const selectedNode = useSelectedNodes((s) => s.selectedNode)
  const patchedLayerProps = useMemo(() => {
    if (!selectedNode) return layerProps
    const allNeurons = layerProps.flatMap((l) => l.neurons)
    const selN = allNeurons.find(({ nid }) => nid === selectedNode)
    if (!selN) return layerProps
    const weightedInputs = getWeightedInputs(selN.inputs, selN.weights)
    const tempObj = {
      weights: normalizeWithSign(selN.weights),
      weightedInputs: normalizeWithSign(weightedInputs),
    }
    return layerProps.map((l) => {
      return {
        ...l,
        neurons: l.neurons.map((n, j) => {
          const highlightValue =
            n.layerIndex === selN.layerIndex - 1
              ? tempObj[highlightProp]?.[j] // selN.normalizedWeights?.[j]
              : undefined
          return {
            ...n,
            highlightValue,
            isSelected: selN.nid === n.nid,
          }
        }),
      }
    })
  }, [layerProps, selectedNode, highlightProp])
  return patchedLayerProps
}

export function getWeightedInputs(
  neuronInput?: number[],
  neuronWeights?: number[]
) {
  if (!neuronInput || !neuronWeights) return undefined
  const weightedInputs = tf.tidy(() => {
    const weightsTensor = tf.tensor1d(neuronWeights)
    const inputsTensor = tf.tensor1d(neuronInput)
    return tf.mul(weightsTensor, inputsTensor).arraySync() as number[]
  })
  return weightedInputs
}
