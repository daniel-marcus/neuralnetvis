import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import tsConfig from "eslint-config-next/typescript"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...tsConfig,
  { settings: { react: { version: "19" } } }, // since esling-plugin-next doesn't support ESLint 10 yet
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
])

export default eslintConfig
