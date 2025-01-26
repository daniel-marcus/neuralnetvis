import { create } from "zustand"
import * as tf from "@tensorflow/tfjs"
import { Neuron, Nid } from "@/components/neuron"
import { LayerDef } from "@/components/layer"
import { useMemo } from "react"
import { normalizeWithSign } from "./normalization"
import { DEBUG } from "./_debug"

export const useSelected = create<{
  selectedNid: Nid | null
  selectedNeuron: Neuron | null
  hovered: Neuron | null
  getHoveredNid: () => Nid | null
  toggleSelectedNeuron: (n: Neuron | null) => void
  toggleSelected: (Nid: Nid | null) => void
  toggleHovered: (n: Neuron | null) => void
}>((set, get) => ({
  selectedNid: null,
  hovered: null,
  selectedNeuron: null,
  toggleSelected: (nid) =>
    set(({ selectedNid }) => ({
      selectedNid: selectedNid === nid ? null : nid,
    })),
  toggleSelectedNeuron: (n) =>
    set(({ selectedNeuron }) => ({
      selectedNeuron:
        selectedNeuron && n?.nid === selectedNeuron.nid ? null : n,
    })),
  getHoveredNid: () => get().hovered?.nid ?? null,
  toggleHovered: (n) =>
    set(({ hovered }) => ({
      hovered: hovered && n?.nid === hovered.nid ? null : n,
    })),
}))

function isInGroup(nid: Nid | null, layerIndex: number, groupIndex = 0) {
  return nid?.startsWith(`${layerIndex}_`) && nid.endsWith(`.${groupIndex}`)
}

export function useLocalSelected(layerIndex: number, groupIndex: number) {
  // returns values only if they are in the same group avoid unnecessary re-renders
  const _selectedNid = useSelected((s) => s.selectedNid)
  const _hoveredNid = useSelected((s) => s.getHoveredNid())
  return {
    selectedNid: isInGroup(_selectedNid, layerIndex, groupIndex)
      ? _selectedNid
      : null,
    hoveredNid: isInGroup(_hoveredNid, layerIndex, groupIndex)
      ? _hoveredNid
      : null,
  }
}

export function useNeuronSelect(layerProps: LayerDef[]) {
  const highlightProp = "weights" // "weightedInputs"
  const selectedNid = useSelected((s) => s.selectedNid)
  const patchedLayerProps = useMemo(() => {
    if (!selectedNid) return layerProps
    const allNeurons = layerProps.flatMap((l) => l.neurons)
    const selN = allNeurons.find(({ nid }) => nid === selectedNid)
    if (!selN) return layerProps
    if (DEBUG) console.log("selected", selN)
    const isFlat = !!selN.inputs && selN.inputs.length === selN.weights?.length
    const weightedInputs = isFlat
      ? getWeightedInputs(selN.inputs, selN.weights)
      : [] // TODO
    const tempObj = {
      weights: normalizeWithSign(selN.weights),
      weightedInputs: normalizeWithSign(weightedInputs),
    }
    // TODO: manipulate only affected nodes directly
    return layerProps.map((l) => {
      return {
        ...l,
        neurons: l.neurons.map((n, j) => {
          if (selN.nid === n.nid) return { ...n, isSelected: true }
          if (n.layer?.visibleIndex !== (selN.layer?.visibleIndex ?? 0) - 1)
            return n
          let highlightValue: number | undefined
          if (isFlat) highlightValue = tempObj[highlightProp]?.[j]
          else {
            // Conv2D
            const inputNeurons = selN.inputNeurons ?? []
            if (!inputNeurons.find((inpn) => inpn.nid === n.nid)) return n
            const idx = inputNeurons.findIndex((inpn) => inpn.nid === n.nid)
            // const weight = selN.weights?.[idx] ?? 0
            // TODO ... calculate normalized weighted input ahead?
            const weightedInput = selN.weights?.[idx] ?? 0 * (n.activation ?? 0)
            highlightValue =
              highlightProp === "weights"
                ? tempObj[highlightProp]?.[idx]
                : weightedInput // TODO ...
          }
          return {
            ...n,
            highlightValue,
            isSelected: selN.nid === n.nid,
          }
        }),
      }
    })
  }, [layerProps, selectedNid, highlightProp])
  return patchedLayerProps
}

export function getWeightedInputs(
  neuronInput?: number[],
  neuronWeights?: number[]
) {
  if (!neuronInput || !neuronWeights) return undefined
  // TODO: Conv2D layer ...
  const weightedInputs = tf.tidy(() => {
    const weightsTensor = tf.tensor1d(neuronWeights)
    const inputsTensor = tf.tensor1d(neuronInput)
    return tf.mul(weightsTensor, inputsTensor).arraySync() as number[]
  })
  return weightedInputs
}
