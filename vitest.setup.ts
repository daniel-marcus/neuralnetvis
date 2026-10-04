// @tensorflow/tfjs-node uses util.isNullOrUndefined etc., which were removed in Node 23
if (Number(process.versions.node.split(".")[0]) > 22) {
  throw new Error(`Tests require Node 22 (see .node-version), found ${process.version}`)
}

import "fake-indexeddb/auto"
import "@tensorflow/tfjs-node"
import { beforeAll, vi } from "vitest"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { loadAndSaveDsData } from "@/data/dataset"
import { mnist } from "@/data/datasets/mnist"

// fake fetch: read assets from local public folder to make tests run without dev server
vi.stubGlobal("fetch", async (url: string) => {
  const patchedPath = join(process.cwd(), "public", url.replace(/^\//, ""))
  const data = await readFile(patchedPath)
  const contentType = url.endsWith(".json") ? "application/json" : "application/octet-stream"
  return new Response(Uint8Array.from(data), {
    headers: {
      "Content-Length": data.length.toString(),
      "Content-Type": contentType,
    },
  })
})

beforeAll(async () => {
  // Putting mnist data into fake indexedDB ...
  await loadAndSaveDsData(mnist)
})
