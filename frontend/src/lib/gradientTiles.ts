/**
 * Locally-generated gradient tiles for decorative image-stream effects,
 * built from Claro's own Material-3 palette instead of hotlinking a
 * third-party CDN. Each is a small inline SVG data URI - no network
 * request, no external asset risk.
 */

const PAIRS: [string, string][] = [
    ['#0425be', '#2e44d4'], // primary -> primary-container
    ['#d0e1fb', '#2e44d4'], // secondary-container -> primary-container
    ['#545759', '#cacdcf'], // tertiary-container -> on-tertiary-container
    ['#2e44d4', '#d0e1fb'], // primary-container -> secondary-container
    ['#eaedff', '#0425be'], // surface-container -> primary
    ['#54647a', '#d0e1fb'], // on-secondary-container -> secondary-container
]

function gradientTileSvg(from: string, to: string, angle: number): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="216" height="300" viewBox="0 0 216 300">
  <defs>
    <linearGradient id="g" gradientTransform="rotate(${angle})">
      <stop offset="0%" stop-color="${from}" />
      <stop offset="100%" stop-color="${to}" />
    </linearGradient>
  </defs>
  <rect width="216" height="300" fill="url(#g)" />
</svg>`
    return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export const BRAND_GRADIENT_TILES = PAIRS.map(([from, to], i) => ({
    src: gradientTileSvg(from, to, 45 + i * 30),
    alt: '',
}))
