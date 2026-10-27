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
const BG = { r: 26, g: 18, b: 14, alpha: 1 }

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
      background_color: '#120e0b',
      theme_color: '#1a1210',
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

  // The adaptive background is a flat leather tone declared in
  // res/values/ic_launcher_background.xml (a PNG here would collide).

  // Branded splash screens: leather ground with the mark centred.
  const { readdir } = await import('node:fs/promises')
  const resDirs = await readdir(androidRes)
  for (const dir of resDirs.filter((d) => d.startsWith('drawable'))) {
    const file = join(androidRes, dir, 'splash.png')
    if (!(await exists(file))) continue
    const meta = await sharp(file).metadata()
    const w = meta.width ?? 480
    const h = meta.height ?? 320
    const side = Math.round(Math.min(w, h) * 0.34)
    const art = await sharp(source).resize(side, side, { fit: 'cover' }).png().toBuffer()
    await sharp({ create: { width: w, height: h, channels: 4, background: BG } })
      .composite([{ input: art, top: Math.round((h - side) / 2), left: Math.round((w - side) / 2) }])
      .png({ compressionLevel: 9 })
      .toFile(file)
  }

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

  // 1x1 home screen widget preview (95% transparent background, white footsteps + daily count).
  const widgetPreview = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 64 64">
    <defs>
      <filter id="ws" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="0.8" stdDeviation="1.1" flood-color="#000000" flood-opacity="0.45"/>
      </filter>
    </defs>
    <rect x="4" y="4" width="56" height="56" rx="16" fill="#000000" fill-opacity="0.05"/>
    <g filter="url(#ws)" fill="#ffffff">
      <g transform="translate(23.5, 11.5) scale(0.7083)">
        <path d="M 7.4 1.8 C 4.8 1.8 3.2 4.3 3.4 7.4 C 3.5 9.7 4.4 11.2 4.5 12.7 L 8.9 12.7 C 8.9 11.0 10.3 9.2 10.4 6.6 C 10.5 3.8 9.4 1.8 7.4 1.8 Z"/>
        <path d="M 4.6 14.3 L 8.8 14.3 L 8.8 15.3 C 8.8 16.9 7.9 18.0 6.7 18.0 C 5.5 18.0 4.6 16.9 4.6 15.3 Z"/>
        <path d="M 16.6 6.0 C 14.6 6.0 13.5 8.0 13.6 10.8 C 13.7 13.4 15.1 15.2 15.1 16.9 L 19.5 16.9 C 19.6 15.4 20.5 13.9 20.6 11.6 C 20.8 8.5 19.2 6.0 16.6 6.0 Z"/>
        <path d="M 15.2 18.5 L 19.4 18.5 L 19.4 19.5 C 19.4 21.1 18.5 22.2 17.3 22.2 C 16.1 22.2 15.2 21.1 15.2 19.5 Z"/>
      </g>
      <text x="32" y="43.5" font-family="Helvetica, Arial, sans-serif" font-size="11.5" font-weight="700" text-anchor="middle">6,420</text>
    </g>
  </svg>`)
  await sharp(widgetPreview).resize(192, 192).png().toFile(join(statusDir, 'widget_preview.png'))
  console.log('Android launcher + notification + widget icons written')
}

console.log('Icons generated in public/icons')
