import { LayerProps } from "@/components/sequential"
import { useMemo } from "react"
import { create } from "zustand"
import { minMax } from "./normalization"
import { useControls } from "leva"

export type NodeId = string // layerIndex_nodeIndex

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

export function useNodeSelect(layerProps: LayerProps[]) {
  const { highlightProp } = useControls("model", {
    highlightProp: {
      label: "onSelect",
      options: {
        "show weights": "normalizedWeights",
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
    const tempObj = {
      normalizedWeights: selN.normalizedWeights,
      weightedInputs: minMax(selN.weightedInputs),
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
