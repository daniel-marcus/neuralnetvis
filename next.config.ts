import type { NextConfig } from "next"
import { version } from "./package.json"

const nextConfig: NextConfig = {
  // reactStrictMode: false,
  output: "export",
  env: {
    APP_VERSION: version,
  },
}

export default nextConfig
