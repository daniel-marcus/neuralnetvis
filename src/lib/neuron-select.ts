import { create } from "zustand"
import * as tf from "@tensorflow/tfjs"
import { Neuron, Nid } from "@/lib/neuron"
import { LayerStateful } from "@/three/layer"
import { useEffect, useMemo } from "react"
import { normalizeWithSign } from "./normalization"
import { debug } from "./debug"
import { HighlightProp, useVisConfigStore } from "./vis-config"

interface SelectedStore {
  hovered: Neuron | null
  selected: Neuron | null
  getHoveredNid: () => Nid | null
  getSelectedNid: () => Nid | null
  toggleHovered: (n: Neuron | null) => void
  toggleSelected: (n: Neuron | null) => void
  setSelected: (n: Neuron | null) => void
  hasHoveredOrSelected: () => boolean
  // TODO: make all neuron accessible by nid?
}

export const useSelected = create<SelectedStore>((set, get) => ({
  hovered: null,
  selected: null,
  getHoveredNid: () => get().hovered?.nid ?? null,
  getSelectedNid: () => get().selected?.nid ?? null,
  toggleSelected: (n) =>
    set(({ selected }) => ({
      selected: selected && n?.nid === selected.nid ? null : n,
    })),
  setSelected: (n) => set({ selected: n }),
  toggleHovered: (n) =>
    set(({ hovered }) => ({
      hovered: hovered && n?.nid === hovered.nid ? null : n,
    })),
  hasHoveredOrSelected: () => Boolean(get().hovered || get().selected),
}))

function isInGroup(nid: Nid | null, layerIndex: number, groupIndex = 0) {
  return nid?.startsWith(`${layerIndex}_`) && nid.endsWith(`.${groupIndex}`)
}

export function useLocalSelected(layerIndex: number, groupIndex: number) {
  // returns values only if they are in the same group to avoid unnecessary re-renders
  const _selectedNid = useSelected((s) => s.getSelectedNid())
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

export function useNeuronSelect(layerProps: LayerStateful[]) {
  const highlightProp = useVisConfigStore((s) => s.highlightProp)
  const selectedNid = useSelected((s) => s.getSelectedNid())
  const hoveredNid = useSelected((s) => s.getHoveredNid())
  const setSelected = useSelected((s) => s.setSelected)

  // TODO: refactor! + reset selected when model changes
  useEffect(() => {
    if (!selectedNid) return
    const selected = layerProps
      .flatMap((l) => l.neurons)
      .find(({ nid }) => nid === selectedNid)
    setSelected(selected ?? null)
  }, [layerProps, selectedNid, setSelected])

  const selOrHovNid = selectedNid || hoveredNid

  const patchedLayerProps = useMemo(() => {
    if (!selOrHovNid) return layerProps
    const allNeurons = layerProps.flatMap((l) => l.neurons)
    const selN = allNeurons.find(({ nid }) => nid === selOrHovNid)
    if (!selN) return layerProps
    const weightedInputs = getWeightedInputs(selN.inputs, selN.weights)
    const tempObj = {
      weights: normalizeWithSign(selN.weights),
      weightedInputs: normalizeWithSign(weightedInputs),
    }

    if (debug()) console.log("selected", selN, tempObj)

    // TODO: manipulate only affected nodes directly for faster updates when hovering?
    return layerProps.map((l) => {
      const patchdNeurons = l.neurons.map((n) => {
        if (n.layerIndex !== (selN.layer.prevVisibleLayer?.index ?? 0)) return n

        const inputNids = selN.inputNids ?? []
        if (!inputNids.find((nid) => nid === n.nid)) return n

        const idx = inputNids.indexOf(n.nid)
        const highlightValue = tempObj[highlightProp as HighlightProp]?.[idx]
        return {
          ...n,
          highlightValue,
        }
      })
      return {
        ...l,
        neurons: patchdNeurons,
        neuronsMap: new Map(patchdNeurons.map((n) => [n.nid, n])),
      }
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
