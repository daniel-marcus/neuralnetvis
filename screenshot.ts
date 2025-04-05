import fs from "fs"
import path from "path"
import puppeteer from "puppeteer"

const PORT = 3000

const WIDTH = 1200
const HEIGHT = 630

const DOCROOT = "out/"
const SCREENSHOT_FOLDER = "public/images/og"
const paths = ["", ...getPaths()].filter((p) => !["index", "404"].includes(p))

console.log(paths)

async function run() {
  fs.rmSync(SCREENSHOT_FOLDER, { recursive: true, force: true })
  fs.mkdirSync(SCREENSHOT_FOLDER)

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: WIDTH, height: HEIGHT, deviceScaleFactor: 2 },
    args: ["--enable-gpu"],
  })
  const page = await browser.newPage()

  for (const p of paths) {
    await page.goto(`http://localhost:${PORT}/${p}?screenshot`)
    const title = await page.title()
    console.log(title)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const path = `${SCREENSHOT_FOLDER}/${pathToFileName(p) || "default"}.png`
    await page.screenshot({ path, type: "png" })
  }
  await browser.close()
}

run()

function getPaths(dir = DOCROOT): string[] {
  const files = fs.readdirSync(dir, { withFileTypes: true })
  let htmlFiles: string[] = []
  for (const file of files) {
    const fullPath = path.join(dir, file.name)
    if (file.isDirectory()) {
      htmlFiles = [...htmlFiles, ...getPaths(fullPath)]
    } else if (file.isFile() && path.extname(file.name) === ".html") {
      const relativePath = path
        .relative(DOCROOT, fullPath)
        .replace(/\.html$/, "")
      htmlFiles.push(relativePath)
    }
  }
  return htmlFiles
}

function pathToFileName(path: string): string {
  return path.replace(/^\//, "").replace(/\//g, "_")
}
