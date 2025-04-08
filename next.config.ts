import withBundleAnalyzer from "@next/bundle-analyzer"
import { version } from "./package.json"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // reactStrictMode: false,
  output: "export",
  env: {
    APP_VERSION: version,
  },
  /*
  // Disable `typeofs` transformation for multi-threaded tfjs-backend-wasm (see: https://github.com/tensorflow/tfjs/tree/master/tfjs-backend-wasm#js-minification)
  webpack(config, { isServer }) {
    if (!isServer) {
      config.optimization.minimizer = [
        new TerserPlugin({
          terserOptions: {
            compress: {
              typeofs: false,
            },
          },
        }),
      ]
    }
    return config
  },
  experimental: {
    turbo: {
      minify: false,
    },
  }, */
}

const config =
  process.env.ANALYZE === "true" ? withBundleAnalyzer()(nextConfig) : nextConfig

export default config
