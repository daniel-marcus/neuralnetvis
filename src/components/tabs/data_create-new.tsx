"use client"

import { useEffect, useState } from "react"
import {
  CollapsibleWithTitle,
  DraggableList,
  Button,
  InputRow,
  InputRowsWrapper,
  Select,
  TextInput,
} from "../ui-elements"
import { getDsFromDef, getDsPath, resetData } from "@/data/dataset"
import type { DatasetDef } from "@/data"
import { handPose } from "@/data/datasets/hand-pose"
import { useCurrScene, useGlobalStore } from "@/store"
import { useRouter } from "next/navigation"

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
  const router = useRouter()
  const ds = useCurrScene((s) => s.ds)
  const setDs = useCurrScene((s) => s.setDs)
  const toggleTab = useGlobalStore((s) => s.toggleTab)
  async function handleCreate() {
    const dsDef = dsDefFromState(name, hands, labels)
    await resetData(dsDef.key, "train")
    await resetData(dsDef.key, "test")
    const newDs = await getDsFromDef(dsDef) // creates meta data in db
    toggleTab("data")
    if (ds?.key === dsDef.key) {
      setDs(newDs)
    } else {
      router.push(getDsPath(dsDef))
    }
  }
  return (
    <CollapsibleWithTitle title="create new dataset" className="bg-box-solid">
      <InputRowsWrapper>
        <Select
          options={[{ value: "handpose", label: "hand pose classification" }]}
        />
        <InputRow label="name">
          <TextInput value={name} onChange={setName} />
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
            rowHeight={32}
            onOrderChange={(newOrder) => {
              const newLabels = newOrder.map((i) => labels[i])
              setLabels(newLabels)
            }}
          >
            {labels.map((l, i) => (
              <div key={i} className="flex gap-2">
                <div className="w-4 shrink-0">{i + 1}</div>
                <TextInput
                  // className="w-full"
                  value={l}
                  onChange={(val) =>
                    setLabels([...labels.toSpliced(i, 1, val)])
                  }
                />
                {labels.length > MIN_LABELS && (
                  <button
                    className="px-2 active:text-white"
                    onClick={() => setLabels([...labels.toSpliced(i, 1)])}
                  >
                    x
                  </button>
                )}
              </div>
            ))}
          </DraggableList>
          <Button
            variant="secondary"
            className="mt-2"
            onClick={() => {
              const newLabel = DEFAULT_LABELS[hands][labels.length] ?? "edit me"
              setLabels([...labels, newLabel])
            }}
          >
            add
          </Button>
        </InputRow>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleCreate}>create</Button>
        </div>
      </InputRowsWrapper>
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
    model: undefined, // start with new untrained model
    key: name,
    parentKey: handPose.key,
    name,
    description: "Start video to record samples",
    /* description: `Your dataset with ${hands} hand${hands > 1 ? "s" : ""} and ${
      outputLabels.length
    } categories`, */
    version: new Date(),
    inputDims: [21, 3, hands],
    outputLabels,
    isUserGenerated: true,
  }
}
