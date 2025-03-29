import TerserPlugin from "terser-webpack-plugin"
import type { NextConfig } from "next"
import { version } from "./package.json"

const nextConfig: NextConfig = {
  // reactStrictMode: false,
  output: "export",
  env: {
    APP_VERSION: version,
  },
  webpack(config, { isServer }) {
    if (!isServer) {
      config.optimization.minimizer = [
        new TerserPlugin({
          terserOptions: {
            compress: {
              typeofs: false, // Disable the `typeofs` transformation for tfjs-backend-wasm (see: https://github.com/tensorflow/tfjs/tree/master/tfjs-backend-wasm#js-minification)
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
  },
}

export default nextConfig
