import type { DatasetDef } from "@/data/types"

const hands = 1
const outputLabels = ["👍", "👌", "🤘"]

export const handPose: DatasetDef = {
  key: "hand-pose",
  name: "hand pose",
  version: new Date("2025-03-06"),
  task: "classification",
  description: `Handpose dataset with ${hands} hand(s) and ${outputLabels.length} categories`,
  aboutUrl:
    "https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker",
  inputDims: [21, 3, hands],
  inputLabels: handPoseLabels(),
  // preprocessFunc: "normalizeHandLandmarks",
  outputLabels,
  storeBatchSize: 20,
  isUserGenerated: true,
  hasCam: true,
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
