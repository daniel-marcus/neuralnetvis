"use client"

import npyjs from "npyjs"
import JSZip from "jszip"
import { setStatus } from "@/store"
import { isSafe } from "./types"

const n = new npyjs()

async function parseNpz(arrayBuffer: ArrayBuffer) {
  // TODO: skip JZip if file is npy
  const zip = await JSZip.loadAsync(arrayBuffer)
  const file = Object.values(zip.files)[0]
  if (!file) throw new Error("No files in zip")
  if (!file.name.endsWith(".npy")) throw new Error("No npy file in zip")
  const data = await file.async("arraybuffer")
  const parsed = n.parse(data)
  if (!isSafe(parsed))
    throw new Error("BigUint64Array/BigInt64Array not supported")
  return parsed
}

export async function fetchMutlipleNpzWithProgress(
  paths: string[],
  silent?: boolean
) {
  const STATUS_ID = `fetch_npz`
  const allTotalBytes: number[] = []
  const allLoadedBytes: number[] = []
  const onProgress: OnProgressCb = ({ path, loadedBytes, totalBytes }) => {
    const index = paths.indexOf(path)
    allTotalBytes[index] = totalBytes
    allLoadedBytes[index] = loadedBytes
    const totalLoadedBytes = allLoadedBytes.reduce((a, b) => a + b, 0)
    const totalTotalBytes = allTotalBytes.reduce((a, b) => a + b, 0)
    const percent = totalLoadedBytes / totalTotalBytes
    if (!silent) setStatus("Loading dataset ...", percent, { id: STATUS_ID })
  }
  const allPromises = paths.map(
    (path) => fetchWithProgress(path, onProgress).then((r) => r.arrayBuffer()) // , { cache: "force-cache" }
  )
  const allFiles = await Promise.all(allPromises)
  if (!silent) setStatus("Parsing dataset ...", -1, { id: STATUS_ID })
  const allParsed = await Promise.all(allFiles.map(parseNpz))
  if (!silent) setStatus("Dataset loaded", null, { id: STATUS_ID })
  return allParsed
}

type OnProgressCb = (arg: {
  path: string
  percent: number
  loadedBytes: number
  totalBytes: number
}) => void

async function fetchWithProgress(
  path: string,
  onProgress?: OnProgressCb,
  opts?: RequestInit
) {
  const response = await fetch(path, opts)
  const contentLength = response.headers.get("Content-Length")
  if (!contentLength || !response.body) {
    console.error("Content-Length header or body not available.")
    return response
  }
  const totalBytes = parseInt(contentLength, 10)
  onProgress?.({ path, loadedBytes: 0, totalBytes, percent: 0 })
  const reader = response.body.getReader()
  let loadedBytes = 0
  const stream = new ReadableStream({
    async start(controller) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        loadedBytes += value.length
        const percent = loadedBytes / totalBytes
        onProgress?.({ path, loadedBytes, totalBytes, percent })
        controller.enqueue(value)
      }
      controller.close()
      reader.releaseLock()
    },
  })
  const newResponse = new Response(stream)
  return newResponse
}
