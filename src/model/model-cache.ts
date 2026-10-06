import * as tf from "@tensorflow/tfjs"
import { withProgress, type OnProgressCb } from "@/data/npy-loader"
import type { ModelDef } from "./models"

// Pretrained models: the downloaded files (model.json + weights) are stored as they are in the Cache Storage.
// model.save() to IndexedDB was very slow for large models (all weights read back from the GPU and written as
// a single value, e.g. 500 MB for GPT-2)
const CACHE_NAME = "nnv-models"

async function openCache() {
  try {
    // not available in insecure contexts (http:// except localhost)
    return typeof caches === "undefined" ? undefined : await caches.open(CACHE_NAME)
  } catch {
    return undefined
  }
}

function getCacheKey(url: string, version: string) {
  const key = new URL(url, location.href)
  key.searchParams.set("v", version)
  return key.href
}

// fetchFunc for tf.io.http: from the cache if available, otherwise download and store in the cache.
// onProgress: bytes of all weight files (from network or cache), model.json is not counted
export async function getCachedFetch(version: string, onProgress?: (percent: number) => void) {
  const cache = await openCache()
  const loaded: Record<string, number> = {}
  const total: Record<string, number> = {}
  const cb: OnProgressCb = ({ path, loadedBytes, totalBytes }) => {
    loaded[path] = loadedBytes
    total[path] = totalBytes
    onProgress?.(sum(loaded) / sum(total))
  }
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString()
    const key = getCacheKey(url, version)
    let response = await cache?.match(key)
    if (!response) {
      response = await fetch(url, init)
      if (cache && response.ok) {
        // not awaited: the body is read for the cache and for tfjs at the same time
        cache.put(key, response.clone()).catch((e) => console.warn("Failed to cache", url, e))
      }
    }
    const isWeights = !new URL(url, location.href).pathname.endsWith(".json")
    return isWeights ? withProgress(response, url, cb) : response
  }
}

const sum = (bytes: Record<string, number>) => Object.values(bytes).reduce((a, b) => a + b, 0)

// all files of the model in the cache (model.json + all weight files)
export async function isModelCached({ path, version, safetensors }: ModelDef) {
  const cache = await openCache()
  const modelJson = await cache?.match(getCacheKey(path, version))
  if (!cache || !modelJson) return false
  const { weightsManifest = [] } = (await modelJson.json()) as tf.io.ModelJSON
  const modelUrl = new URL(path, location.href)
  const weightUrls = safetensors
    ? [safetensors.url]
    : weightsManifest.flatMap((group) => group.paths).map((p) => new URL(p, modelUrl).href)
  const hits = await Promise.all(weightUrls.map((url) => cache.match(getCacheKey(url, version))))
  return hits.every(Boolean)
}

// removes the files of other versions of the model (same directory or safetensors file, other ?v=)
export async function removeOldVersions({ path, version, safetensors }: ModelDef) {
  const cache = await openCache()
  if (!cache) return
  const modelDir = new URL(".", new URL(path, location.href)).href
  const safetensorsUrl = safetensors && withoutVersion(new URL(safetensors.url))
  for (const request of await cache.keys()) {
    const url = new URL(request.url)
    const isModelFile = url.href.startsWith(modelDir) || withoutVersion(url) === safetensorsUrl
    if (isModelFile && url.searchParams.get("v") !== version) await cache.delete(request)
  }
}

function withoutVersion(url: URL) {
  const u = new URL(url)
  u.searchParams.delete("v")
  return u.href
}

// models that were cached with model.save() in IndexedDB before (user models are not prefixed with nnv_)
let legacyRemoved = false
export async function removeLegacyCache() {
  if (legacyRemoved) return
  legacyRemoved = true
  try {
    const allModels = await tf.io.listModels()
    const legacy = Object.keys(allModels).filter((k) => k.startsWith("indexeddb://nnv_"))
    for (const dbPath of legacy) await tf.io.removeModel(dbPath)
  } catch (e) {
    console.warn("Failed to remove legacy model cache", e)
  }
}
