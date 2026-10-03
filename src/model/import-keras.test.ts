import { describe, it, expect } from "vitest"
import { parseModelObject } from "./import-keras"

// excerpt from the config.json of a Keras 3 model:
// x = layers.Embedding(10, 4)(inputs)
// x = layers.MultiHeadAttention(2, 2)(x, x, use_causal_mask=True)
// x = layers.Dropout(0.1)(x)
const kerasTensor = (layerName: string) => ({
  class_name: "__keras_tensor__",
  config: { shape: [null, 4, 4], dtype: "float32", keras_history: [layerName, 0, 0] },
})
const kerasLayers = [
  {
    class_name: "MultiHeadAttention",
    inbound_nodes: [
      {
        args: [kerasTensor("embedding"), kerasTensor("embedding")],
        kwargs: { use_causal_mask: true },
      },
    ],
  },
  {
    class_name: "Dropout",
    inbound_nodes: [{ args: [kerasTensor("multi_head_attention")], kwargs: { training: false } }],
  },
]

describe("parseModelObject", () => {
  const [mha, dropout] = parseModelObject(kerasLayers) as unknown as { inbound_nodes: unknown }[]

  it("passes use_causal_mask on to the tfjs layer", () => {
    const kwargs = { use_causal_mask: true }
    expect(mha.inbound_nodes).toEqual([
      [
        ["embedding", 0, 0, kwargs],
        ["embedding", 0, 0, kwargs],
      ],
    ])
  })

  it("drops other call kwargs", () => {
    // Dropout's training: false would disable dropout when training in the browser
    expect(dropout.inbound_nodes).toEqual([[["multi_head_attention", 0, 0, {}]]])
  })
})
