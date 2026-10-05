// Converts a font file to three.js typeface JSON (for FontLoader), e.g. for vector text in the 3d model
// Usage: pnpm font-to-typeface <font.woff|ttf|otf> <out.typeface.json>
//
// Only a subset of glyphs is included to keep the file small. Missing characters fall back to "?"
import { readFileSync, writeFileSync } from "node:fs"
import opentype from "opentype.js"

const [fontPath, outPath] = process.argv.slice(2)
if (!fontPath || !outPath) {
  console.error("Usage: pnpm font-to-typeface <font.woff|ttf|otf> <out.typeface.json>")
  process.exit(1)
}

const UNICODE_RANGES: [number, number][] = [
  [0x0000, 0x017f], // Basic Latin, Latin-1 Supplement, Latin Extended-A
  [0x2000, 0x21ff], // General Punctuation (… ·), Super/Subscripts, Currency, Letterlike, Number Forms, Arrows (↵)
  [0x25a0, 0x25ff], // Geometric Shapes (◀)
  [0xfffd, 0xfffd], // replacement character
]
const inRanges = (u: number) => UNICODE_RANGES.some(([start, end]) => u >= start && u <= end)

const buf = readFileSync(fontPath)
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
const r = Math.round

const glyphs: Record<string, { ha: number; x_min: number; x_max: number; o: string }> = {}
for (let i = 0; i < font.glyphs.length; i++) {
  const glyph = font.glyphs.get(i)
  for (const unicode of (glyph.unicodes ?? []).filter(inRanges)) {
    // FontLoader expects the end point before the control points
    const o = glyph.path.commands
      .map((c) => {
        if (c.type === "M") return `m ${r(c.x)} ${r(c.y)}`
        if (c.type === "L") return `l ${r(c.x)} ${r(c.y)}`
        if (c.type === "Q") return `q ${r(c.x)} ${r(c.y)} ${r(c.x1)} ${r(c.y1)}`
        if (c.type === "C")
          return `b ${r(c.x)} ${r(c.y)} ${r(c.x1)} ${r(c.y1)} ${r(c.x2)} ${r(c.y2)}`
        return "" // Z: FontLoader closes the paths itself
      })
      .filter(Boolean)
      .join(" ")
    const { x1, x2 } = glyph.getBoundingBox()
    glyphs[String.fromCodePoint(unicode)] = {
      ha: r(glyph.advanceWidth ?? 0),
      x_min: r(x1),
      x_max: r(x2),
      o,
    }
  }
}

const { head, post } = font.tables
const typeface = {
  glyphs,
  familyName: font.getEnglishName("fontFamily"),
  resolution: font.unitsPerEm,
  ascender: font.ascender,
  descender: font.descender,
  underlinePosition: post.underlinePosition,
  underlineThickness: post.underlineThickness,
  boundingBox: { xMin: head.xMin, yMin: head.yMin, xMax: head.xMax, yMax: head.yMax },
}
writeFileSync(outPath, JSON.stringify(typeface))
console.log(`${Object.keys(glyphs).length} glyphs → ${outPath}`)
