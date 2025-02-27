import { useEffect, useState } from "react"
import {
  CollapsibleWithTitle,
  InlineButton,
  InputRow,
  Select,
  Slider,
} from "../ui-elements"
import { DatasetDef } from "@/data"
import { setDsFromDsDef } from "@/data/dataset"

type HandsNum = 1 | 2

const HANDS_OPTIONS = [
  { value: 1, label: "webcam: one hand" },
  { value: 2, label: "webcam: two hands" },
]

const DEFAULT_LABELS = {
  1: ["👍", "👌", "🤘", "✊", "✋", "👎", "🤞", "🖖"],
  2: ["🫶", "🙌", "🤜🤛", "👐", "👏"],
}

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
    await setDsFromDsDef(dsDef)
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
          options={HANDS_OPTIONS}
          value={hands}
          onChange={(val) => setHands(parseInt(val) as HandsNum)}
        />
      </InputRow>
      <InputRow label="categories">
        <Slider
          showValue
          min={2}
          max={DEFAULT_LABELS[hands].length}
          value={labels.length}
          onChange={(numCategories) => {
            setLabels(DEFAULT_LABELS[hands].slice(0, numCategories))
          }}
        />
      </InputRow>
      <InputRow label="labels">
        {labels.map((l, i) => (
          <div key={i} className="flex gap-2">
            <div className="w-8 shrink-0">{i + 1}:</div>
            <input
              type="string"
              value={l}
              onChange={(e) => {
                const newVal = e.target.value
                const newLabels = [...labels.toSpliced(i, 1, newVal)]
                setLabels(newLabels)
              }}
            />
          </div>
        ))}
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
  labels: string[]
): DatasetDef {
  return {
    key: name,
    name,
    version: new Date(),
    task: "classification",
    description: `Handpose dataset with ${hands} hand(s) and ${labels.length} categories`,
    // aboutUrl: "https://neuralnetvis.app",
    aboutUrl:
      "https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker",
    input: {
      labels: handPoseLabels(),
    },
    output: { labels },
    loadData: async () => {
      const emptyX = new Float32Array()
      const emptyY = new Uint8Array()
      return {
        xTrain: { data: emptyX, shape: [0, 21, 3, hands] },
        yTrain: { data: emptyY, shape: [0, 21, 3, hands] },
        xTest: { data: emptyX, shape: [0, 21, 3, hands] },
        yTest: { data: emptyY, shape: [0, 21, 3, hands] },
      }
    },
    storeBatchSize: 20,
    isUserGenerated: true,
    hasCam: true,
  }
}

function handPoseLabels() {
  return [
    "wrist",
    "thumb_cmc",
    "thumb_mcp",
    "thumb_ip",
    "thumb_tip",
    "index_finger_mcp",
    "index_finger_pip",
    "index_finger_dip",
    "index_finger_tip",
    "middle_finger_mcp",
    "middle_finger_pip",
    "middle_finger_dip",
    "middle_finger_tip",
    "ring_finger_mcp",
    "ring_finger_pip",
    "ring_finger_dip",
    "ring_finger_tip",
    "pinky_mcp",
    "pinky_pip",
    "pinky_dip",
    "pinky_tip",
  ]
}
