import { useEffect, useMemo } from "react"
import * as tf from "@tensorflow/tfjs"
import { useStore } from "@/store"
import { normalizeWithSign } from "@/data/utils"
import { getHighlightColor } from "./colors"
import type { LayerStateful, Nid, HighlightProp } from "./types"

export function useNeuronSelect(layerProps: LayerStateful[]) {
  const highlightProp = useStore((s) => s.vis.highlightProp)
  const selectedNid = useStore((s) => s.getSelectedNid())
  const hoveredNid = useStore((s) => s.getHoveredNid())
  const setSelected = useStore((s) => s.setSelected)

  // TODO: refactor! + reset selected when model changes
  useEffect(() => {
    if (!selectedNid) return
    const selected = layerProps
      .flatMap((l) => l.neurons)
      .find(({ nid }) => nid === selectedNid)
    setSelected(selected ?? null)
    if (useStore.getState().isDebug) console.log(selected)
  }, [layerProps, selectedNid, setSelected])

  const selOrHovNid = selectedNid || hoveredNid

  const patchedLayerProps = useMemo(() => {
    if (!selOrHovNid) return layerProps
    const allNeuronsMap = new Map(
      layerProps.flatMap((l) => l.neurons).map((n) => [n.nid, n])
    )
    const selN = allNeuronsMap.get(selOrHovNid)
    if (!selN) return layerProps
    const selNInputs = (selN.inputNeurons?.map(
      (n) => allNeuronsMap.get(n.nid)?.activation
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
        const highlightValue = tempObj[highlightProp as HighlightProp]?.[idx]
        const color = getHighlightColor(highlightValue ?? 0)
        return { ...n, color }
      })
      return { ...l, neurons }
    })
  }, [layerProps, selOrHovNid, highlightProp])
  return patchedLayerProps
}

export function getWeightedInputs(
  neuronInput?: number[],
  neuronWeights?: number[]
) {
  if (!neuronInput || !neuronWeights) return undefined
  // TODO: check shapes
  const weightedInputs = tf.tidy(() => {
    const weightsTensor = tf.tensor1d(neuronWeights)
    const inputsTensor = tf.tensor1d(neuronInput)

    if (
      !weightsTensor.shape.every(
        (value, index) => value === inputsTensor.shape[index]
      )
    ) {
      console.log("Tensors have different shapes, skipping mul")
      return []
    }
    return tf.mul(weightsTensor, inputsTensor).arraySync() as number[]
  })
  return weightedInputs
}

export function useLocalSelected(layerIndex: number, groupIndex: number) {
  // returns values only if they are in the same group to avoid unnecessary re-renders
  const _selectedNid = useStore((s) => s.getSelectedNid())
  const _hoveredNid = useStore((s) => s.getHoveredNid())
  return {
    selectedNid: isInGroup(_selectedNid, layerIndex, groupIndex)
      ? _selectedNid
      : null,
    hoveredNid: isInGroup(_hoveredNid, layerIndex, groupIndex)
      ? _hoveredNid
      : null,
  }
}

function isInGroup(nid: Nid | null, layerIndex: number, groupIndex = 0) {
  return nid?.startsWith(`${layerIndex}_`) && nid.endsWith(`.${groupIndex}`)
}
