// import TerserPlugin from "terser-webpack-plugin"
import { version } from "./package.json"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactStrictMode: false,
  output: "export",
  env: {
    APP_VERSION: version,
  },
}

export default nextConfig
