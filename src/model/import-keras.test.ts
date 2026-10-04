import { describe, it, expect } from "vitest"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import * as tf from "@tensorflow/tfjs"
import { adaptReversibleEmbedding, importKerasModel, parseModelObject } from "./import-keras"
// register the custom layers of the fixture. Not via ./layers: under Node, multi-head-attention.ts loads a 2nd copy
// of tfjs-layers (ESM) that replaces the registered Dense class (see multi-head-attention.test.ts)
import "./layers/position-embedding"
import "./layers/reversible-embedding"

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

const kerasTensorAt = (layerName: string, nodeIdx: number) => ({
  class_name: "__keras_tensor__",
  config: { shape: [null, 4, 4], dtype: "float32", keras_history: [layerName, nodeIdx, 0] },
})

describe("parseModelObject with a shared layer", () => {
  // ReversibleEmbedding (tied weights): emb = tok(inputs), ..., logits = tok(x, reverse=True)
  const [tok, softmax] = parseModelObject([
    {
      class_name: "ReversibleEmbedding",
      inbound_nodes: [
        { args: [kerasTensorAt("input_layer", 0)], kwargs: {} },
        { args: [kerasTensorAt("layer_normalization", 0)], kwargs: { reverse: true } },
      ],
    },
    {
      class_name: "Activation",
      inbound_nodes: [{ args: [kerasTensorAt("reversible_embedding", 1)], kwargs: {} }],
    },
  ]) as unknown as { inbound_nodes: unknown }[]

  it("keeps all calls of the layer", () => {
    expect(tok.inbound_nodes).toEqual([
      [["input_layer", 0, 0, {}]],
      [["layer_normalization", 0, 0, {}]],
    ])
  })

  it("keeps the node index of the inbound layer", () => {
    expect(softmax.inbound_nodes).toEqual([[["reversible_embedding", 1, 0, {}]]])
  })
})

// tied model: emb = tok(inputs), ..., logits = tok(x, reverse=True)
const modelJson = () => ({
  config: {
    layers: [
      {
        class_name: "InputLayer",
        name: "input_layer",
        config: { batch_input_shape: [null, null] },
      },
      { class_name: "ReversibleEmbedding", name: "reversible_embedding", config: {} },
      {
        class_name: "PositionEmbedding",
        name: "position_embedding",
        config: { sequence_length: 32 },
      },
    ],
    output_layers: [["reversible_embedding", 1, 0]],
  },
})

describe("adaptReversibleEmbedding", () => {
  it("fixes the variable sequence length", () => {
    const { config } = adaptReversibleEmbedding(modelJson())
    expect(config.layers[0].config.batch_input_shape).toEqual([null, 32])
  })

  it("adds a softmax after the reverse call", () => {
    const { config } = adaptReversibleEmbedding(modelJson())
    expect(config.layers.at(-1)).toMatchObject({
      class_name: "Activation",
      config: { activation: "softmax" },
      inbound_nodes: [[["reversible_embedding", 1, 0, {}]]],
    })
    expect(config.output_layers).toEqual([["softmax", 0, 0]])
  })

  it("leaves other models unchanged", () => {
    const other = {
      config: { layers: [{ class_name: "Dense" }], output_layers: [["dense", 0, 0]] },
    }
    expect(adaptReversibleEmbedding(structuredClone(other))).toEqual(other)
  })
})

describe("importKerasModel with tied embeddings", () => {
  // fixture: tiny model like build_model(tied=True) in ml-notebooks/tweets.py, saved with Keras 3.15
  // (vocab 12, dim 8, variable sequence length), expected = softmax of the Keras logits.
  // Without MultiHeadAttention, which can't be imported under Node (see multi-head-attention.test.ts)
  const fixtures = join(__dirname, "__fixtures__")

  it("predicts the same probabilities as Keras", async () => {
    const buffer = await readFile(join(fixtures, "tied-embedding.keras"))
    const expected = JSON.parse(
      await readFile(join(fixtures, "tied-embedding.expected.json"), "utf8"),
    )
    const model = await importKerasModel(new File([buffer], "tied-embedding.keras"))
    expect(model).toBeDefined()
    expect(model!.layers[0].batchInputShape).toEqual([null, 6])
    expect(model!.layers.at(-1)!.getClassName()).toBe("Activation")
    expect(model!.countParams()).toBe(456) // tied: the embedding weights exist only once
    // shape of the 1st call (embeddings), used for the visualization
    expect(model!.getLayer("reversible_embedding").outputShape).toEqual([null, 6, 8])

    const probs = model!.predict(tf.tensor2d(expected.x, undefined, "int32")) as tf.Tensor
    expect(probs.shape).toEqual([2, 6, 12])
    const maxDiff = probs.sub(tf.tensor(expected.probs)).abs().max().dataSync()[0]
    expect(maxDiff).toBeLessThan(1e-4)
  })
})
