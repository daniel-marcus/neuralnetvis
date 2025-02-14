import { App } from "@/components/app"
import manifest from "./manifest.json"
import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: manifest.name,
  description: manifest.description,
  openGraph: {
    images: [{ url: "https://neuralnetvis.app/images/neuralnetvis-og.png" }],
  },
}

type LayoutProps = Readonly<{ children: React.ReactNode }>

export default function Layout({ children }: LayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
        <meta name="apple-mobile-web-app-title" content={manifest.name} />
      </head>
      <body className={`antialiased`}>
        <App>{children}</App>
      </body>
    </html>
  )
}
