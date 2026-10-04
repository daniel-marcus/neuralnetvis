// seedrandom (CJS) for tfjs' ESM builds in the module runner: Node's ESM import of the CJS module has no
// named exports (seedrandom.alea), so load it with require from tfjs' dependencies and re-export
import { realpathSync } from "node:fs"
import { createRequire } from "node:module"
import { resolve } from "node:path"

// real path: seedrandom is a dependency of the pnpm package, not hoisted to node_modules
const tfjsDir = realpathSync(resolve(import.meta.dirname, "../../node_modules/@tensorflow/tfjs"))
const require = createRequire(resolve(tfjsDir, "package.json"))
const seedrandom = require("seedrandom")

export default seedrandom
export const { alea, xor128, xorwow, xorshift7, xor4096, tychei } = seedrandom
