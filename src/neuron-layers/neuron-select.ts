import { useMemo } from "react"
import * as tf from "@tensorflow/tfjs"
import { useStore } from "@/store"
import { checkShapeMatch, normalizeWithSign } from "@/data/utils"
import { getHighlightColor } from "./colors"
import type { LayerStateful, Nid } from "./types"
import { updateGroups } from "./layers-stateful"

export function useNeuronSelect(
  isActive: boolean,
  layerProps: LayerStateful[]
) {
  const highlightProp = useStore((s) => s.vis.highlightProp)
  const allNeurons = useStore((s) => s.allNeurons)
  const selectedNid = useStore((s) => s.selectedNid)
  const hoveredNid = useStore((s) => s.hoveredNid)
  const selOrHovNid = hoveredNid || selectedNid

  const patchedLayerProps = useMemo(() => {
    if (!isActive || !selOrHovNid || !highlightProp) return layerProps
    const selN = allNeurons.get(selOrHovNid)
    if (!selN) return layerProps
    const selNInputs = (selN.inputNeurons?.map(
      (n) => allNeurons.get(n.nid)?.activation
    ) ?? []) as number[]
    const weightedInputs = getWeightedInputs(selNInputs, selN.weights)
    const tempObj = {
      weights: normalizeWithSign(selN.weights),
      weightedInputs: normalizeWithSign(weightedInputs),
    }

    if (!selN.inputNids) return layerProps
    const inputNidMap = new Map(selN.inputNids.map((nid, idx) => [nid, idx]))

    return layerProps.map((l) => {
      if (l.visibleIdx !== selN.layer.visibleIdx - 1) return l
      const neurons = l.neurons.map((n) => {
        const idx = inputNidMap.get(n.nid)
        if (typeof idx === "undefined") return n
        const highlightValue = tempObj[highlightProp]?.[idx]
        const color = getHighlightColor(highlightValue ?? 0)
        return { ...n, color }
      })
      const _updatedLayer = { ...l, neurons }
      const updatedLayer = updateGroups(_updatedLayer)
      return updatedLayer
    })
  }, [isActive, layerProps, selOrHovNid, highlightProp, allNeurons])
  return patchedLayerProps
}

export function useHovered() {
  const hoveredNid = useStore((s) => s.hoveredNid)
  return useNeuron(hoveredNid)
}

export function useSelected() {
  const selectedNid = useStore((s) => s.selectedNid)
  return useNeuron(selectedNid)
}

function useNeuron(nid?: Nid) {
  const allNeurons = useStore((s) => s.allNeurons)
  return useMemo(
    () => (nid ? allNeurons.get(nid) : undefined),
    [allNeurons, nid]
  )
}

export function getWeightedInputs(
  neuronInput?: number[],
  neuronWeights?: number[]
) {
  if (!neuronInput || !neuronWeights) return undefined
  const weightedInputs = tf.tidy(() => {
    const weightsTensor = tf.tensor1d(neuronWeights)
    const inputsTensor = tf.tensor1d(neuronInput)

    if (!checkShapeMatch(weightsTensor.shape, inputsTensor.shape)) {
      console.log("Tensors have different shapes, skipping mul")
      return []
    }
    return tf.mul(weightsTensor, inputsTensor).arraySync() as number[]
  })
  return weightedInputs
}

export function useLocalSelected(layerIndex: number, groupIndex: number) {
  // returns values only if they are in the same group to avoid unnecessary re-renders
  const _selectedNid = useStore((s) => s.selectedNid)
  const _hoveredNid = useStore((s) => s.hoveredNid)
  const result = {
    selectedNid:
      _selectedNid && isInGroup(_selectedNid, layerIndex, groupIndex)
        ? _selectedNid
        : null,
    hoveredNid:
      _hoveredNid && isInGroup(_hoveredNid, layerIndex, groupIndex)
        ? _hoveredNid
        : null,
  }
  return result
}

function isInGroup(nid: Nid | null, layerIndex: number, groupIndex = 0) {
  return nid?.startsWith(`${layerIndex}_`) && nid.endsWith(`.${groupIndex}`)
}
