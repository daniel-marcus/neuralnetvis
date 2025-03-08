"use client"

import { useEffect, useState } from "react"
import {
  CollapsibleWithTitle,
  DraggableList,
  InlineButton,
  InputRow,
  Select,
} from "../ui-elements"
import { resetData, setDsFromDef } from "@/data/dataset"
import type { DatasetDef } from "@/data"
import { handPose } from "@/data/datasets/hand-pose"

type HandsNum = 1 | 2

const HANDS_OPTIONS = [
  { value: "1", label: "webcam: one hand" },
  { value: "2", label: "webcam: two hands" },
]

const DEFAULT_LABELS = {
  1: ["👍", "👌", "🤘", "✊", "✋", "👎", "🤞", "🖖"],
  2: ["🫶", "🙌", "🤘🤘", "🤜🤛", "👐", "👏"],
}

const MIN_LABELS = 2

export const CreateNewDataset = () => {
  const [name, setName] = useState<string>("my_handpose_ds")
  const [hands, setHands] = useState<HandsNum>(1)
  const [labels, setLabels] = useState<string[]>(
    DEFAULT_LABELS[hands].slice(0, 3)
  )
  useEffect(() => {
    setLabels(DEFAULT_LABELS[hands].slice(0, 3))
  }, [hands])
  async function handleCreate() {
    const dsDef = dsDefFromState(name, hands, labels)
    await resetData(dsDef.key, "train")
    await resetData(dsDef.key, "test")
    await setDsFromDef(dsDef)
  }
  return (
    <CollapsibleWithTitle title="create new dataset" variant="no-bg" collapsed>
      <div className="flex gap-2">
        <InlineButton variant="secondary" className="text-white" disabled>
          hand pose classification
        </InlineButton>
      </div>
      <InputRow label="name">
        <input
          type="string"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </InputRow>
      <InputRow label="input">
        <Select
          key={`select_hands_${hands}`}
          options={HANDS_OPTIONS}
          value={String(hands)}
          onChange={(val) => setHands(parseInt(val) as HandsNum)}
        />
      </InputRow>
      <InputRow label="labels">
        <DraggableList
          rowHeight={26}
          onOrderChange={(newOrder) => {
            const newLabels = newOrder.map((i) => labels[i])
            setLabels(newLabels)
          }}
        >
          {labels.map((l, i) => (
            <div key={i} className="flex gap-2">
              <div className="w-8 shrink-0">{i + 1}</div>
              <input
                className="w-full"
                type="string"
                value={l}
                onChange={(e) =>
                  setLabels([...labels.toSpliced(i, 1, e.target.value)])
                }
              />
              {labels.length > MIN_LABELS && (
                <button
                  className="pl-2"
                  onClick={() => setLabels([...labels.toSpliced(i, 1)])}
                >
                  x
                </button>
              )}
            </div>
          ))}
        </DraggableList>
        <InlineButton
          variant="secondary"
          className="mt-2"
          onClick={() => {
            const newLabel = DEFAULT_LABELS[hands][labels.length] ?? "edit me"
            setLabels([...labels, newLabel])
          }}
        >
          add
        </InlineButton>
      </InputRow>
      <div className="mt-4 flex justify-end">
        <InlineButton onClick={handleCreate}>create</InlineButton>
      </div>
    </CollapsibleWithTitle>
  )
}

function dsDefFromState(
  name: string,
  hands: number,
  outputLabels: string[]
): DatasetDef {
  return {
    ...handPose,
    key: name,
    name,
    version: new Date(),
    inputDims: [21, 3, hands],
    outputLabels,
  }
}
