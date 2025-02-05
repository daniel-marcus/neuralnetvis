import type { Metadata } from "next"
import "./globals.css"
import { App } from "@/components/app"
import { siteMeta } from "../../metadata"

export const metadata: Metadata = {
  title: siteMeta.title,
  description: siteMeta.description,
  openGraph: {
    images: [{ url: siteMeta.defaultOgImg }],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
        <meta name="apple-mobile-web-app-title" content={siteMeta.title} />
      </head>
      <body className={`antialiased`}>
        <App>{children}</App>
      </body>
    </html>
  )
}
