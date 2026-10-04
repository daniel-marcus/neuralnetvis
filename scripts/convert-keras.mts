// Converts a Keras 3 .keras file to tfjs layers format (model.json + weights.bin), e.g. for public/models
// Usage: pnpm convert-keras <model.keras> <outDir>
//
// Same import as "my models" in the app, but under Node: @tensorflow/tfjs and @tensorflow/tfjs-layers resolve
// to their CJS bundles in Node, while the MultiHeadAttention layer extends the ESM classes. Loading the
// conversion with Vite's module runner and the ESM builds gives one copy of the layer classes, as in the browser.
import { createRequire } from "node:module"
import { resolve } from "node:path"
import { createServer, createServerModuleRunner } from "vite"
import type * as Converter from "./convert-keras/convert.ts"

const [kerasPath, outDir] = process.argv.slice(2)
if (!kerasPath || !outDir) {
  console.error("Usage: pnpm convert-keras <model.keras> <outDir>")
  process.exit(1)
}

// tfjs-core's Node platform calls require("util"), which the module runner doesn't provide (vitest does)
globalThis.require = createRequire(import.meta.url)

const server = await createServer({
  configFile: false,
  logLevel: "error",
  appType: "custom",
  server: { middlewareMode: true, hmr: false, ws: false },
  resolve: {
    tsconfigPaths: true,
    alias: [
      { find: /^@tensorflow\/tfjs$/, replacement: esm("@tensorflow/tfjs") },
      { find: /^@tensorflow\/tfjs-layers$/, replacement: esm("@tensorflow/tfjs-layers") },
      {
        find: /^seedrandom$/,
        replacement: resolve(import.meta.dirname, "convert-keras/seedrandom.ts"),
      },
    ],
  },
  ssr: { noExternal: [/@tensorflow/] }, // transformed by Vite, not loaded by Node (CJS)
})
const runner = createServerModuleRunner(server.environments.ssr, { hmr: false })
try {
  const converter: typeof Converter = await runner.import(
    resolve(import.meta.dirname, "convert-keras/convert.ts"),
  )
  const { name, numLayers, numParams } = await converter.convertKerasModel(kerasPath, outDir)
  console.log(`${name}: ${numLayers} layers, ${numParams.toLocaleString("en")} params -> ${outDir}`)
} finally {
  await runner.close()
  await server.close()
}

function esm(pkg: string) {
  return resolve(import.meta.dirname, "..", "node_modules", pkg, "dist/index.js")
}
