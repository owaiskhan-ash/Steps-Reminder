/**
 * Generates every derived icon from `assets/icon.png`:
 *  - PWA/web icons in public/icons
 *  - Android launcher mipmaps (legacy, round, adaptive foreground)
 *  - Android status-bar notification icon (monochrome SC)
 *
 * Run with `npm run icons`. Safe to re-run.
 */
import { mkdir, access, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'

const ROOT = new URL('..', import.meta.url).pathname
const SRC = join(ROOT, 'assets/icon.png')
const PUBLIC_ICONS = join(ROOT, 'public/icons')
const BG = { r: 42, g: 26, b: 14, alpha: 1 }

const exists = async (p) => {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function png(buf, size, out) {
  await sharp(buf).resize(size, size, { fit: 'cover' }).png({ compressionLevel: 9 }).toFile(out)
}

async function roundIcon(buf, size, out) {
  const rounded = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`,
  )
  const base = await sharp(buf).resize(size, size, { fit: 'cover' }).png().toBuffer()
  const mask = await sharp(rounded).png().toBuffer()
  await sharp(base)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png({ compressionLevel: 9 })
    .toFile(out)
}

/* ------------------------------------------------------------------ web --- */
await mkdir(PUBLIC_ICONS, { recursive: true })
const source = await sharp(SRC).png().toBuffer()

for (const size of [64, 192, 320, 512]) {
  await png(source, size, join(PUBLIC_ICONS, `icon-${size}.png`))
}

// Maskable: same artwork inset on a solid background so nothing is clipped.
for (const size of [192, 512]) {
  const inner = Math.round(size * 0.8)
  const inset = Math.round((size - inner) / 2)
  const art = await sharp(source).resize(inner, inner, { fit: 'cover' }).png().toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: art, top: inset, left: inset }])
    .png({ compressionLevel: 9 })
    .toFile(join(PUBLIC_ICONS, `maskable-${size}.png`))
}

await png(source, 32, join(ROOT, 'public/favicon.png'))

await writeFile(
  join(ROOT, 'public/manifest.webmanifest'),
  JSON.stringify(
    {
      name: 'SC · Step Reminder',
      short_name: 'SC Steps',
      description: 'Set a daily step target, get a gentle reminder before the day slips away.',
      start_url: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#150f0a',
      theme_color: '#241a13',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-320.png', sizes: '320x320', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
        { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    null,
    2,
  ),
)

/* -------------------------------------------------------------- android --- */
const androidRes = join(ROOT, 'android/app/src/main/res')
const hasAndroid = await exists(androidRes)

if (hasAndroid) {
  const launcher = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }
  for (const [density, size] of Object.entries(launcher)) {
    const dir = join(androidRes, `mipmap-${density}`)
    await mkdir(dir, { recursive: true })
    await png(source, size, join(dir, 'ic_launcher.png'))
    await roundIcon(source, size, join(dir, 'ic_launcher_round.png'))

    // Adaptive icon foreground: 108dp canvas, artwork occupies the inner 72dp.
    const fgSize = Math.round((size * 108) / 48)
    const artSize = Math.round((size * 72) / 48)
    const art = await sharp(source)
      .resize(artSize, artSize, { fit: 'cover' })
      .png()
      .toBuffer()
    const pad = Math.round((fgSize - artSize) / 2)
    await sharp({ create: { width: fgSize, height: fgSize, channels: 4, background: { ...BG, alpha: 0 } } })
      .composite([{ input: art, top: pad, left: pad }])
      .png({ compressionLevel: 9 })
      .toFile(join(dir, 'ic_launcher_foreground.png'))
  }

  // Adaptive icon background layer: a flat leather tone.
  await sharp({ create: { width: 432, height: 432, channels: 4, background: { r: 60, g: 38, b: 20, alpha: 1 } } })
    .png()
    .toFile(join(androidRes, 'mipmap-xxxhdpi/ic_launcher_background.png'))

  // Status-bar icon must be a flat white silhouette on transparency.
  const statusDir = join(androidRes, 'drawable')
  await mkdir(statusDir, { recursive: true })
  const silhouette = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
    <g fill="#ffffff">
      <text x="30" y="63" font-family="Helvetica, Arial, sans-serif" font-size="52" font-weight="700" text-anchor="middle">S</text>
      <text x="68" y="63" font-family="Helvetica, Arial, sans-serif" font-size="40" font-weight="700" text-anchor="middle">C</text>
    </g>
  </svg>`)
  await sharp(silhouette).resize(96, 96).png().toFile(join(statusDir, 'ic_stat_sc.png'))
  console.log('Android launcher + notification icons written')
}

console.log('Icons generated in public/icons')
