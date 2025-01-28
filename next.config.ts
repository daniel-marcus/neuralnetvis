import type { NextConfig } from "next"
import { version } from "./package.json"

const nextConfig: NextConfig = {
  /* config options here */
  // reactStrictMode: false,
  env: {
    APP_VERSION: version,
  },
}

export default nextConfig
