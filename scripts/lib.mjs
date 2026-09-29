// Shared building blocks for every card on the profile.
//
// GitHub shows README images through <img>, so the SVGs cannot run scripts or
// load web fonts. Everything below is plain SVG + CSS keyframes + SMIL, which
// all major browsers animate inside <img>.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const C = {
  bg0: '#060913',
  bg1: '#0c1224',
  panel: '#0f172a',
  panel2: '#131c33',
  line: '#1f2a44',
  text: '#e6edf7',
  muted: '#94a3b8',
  dim: '#5b6b86',
  cyan: '#22d3ee',
  blue: '#60a5fa',
  violet: '#a78bfa',
  purple: '#8b5cf6',
  pink: '#f472b6',
  green: '#34d399',
  amber: '#fbbf24',
  red: '#f87171',
};

export const SANS = `'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif`;
export const MONO = `ui-monospace, 'SFMono-Regular', 'Cascadia Mono', Consolas, 'Liberation Mono', Menlo, monospace`;

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const r1 = (n) => Math.round(n * 10) / 10;
export const r3 = (n) => Math.round(n * 1000) / 1000;

// Deterministic PRNG: rebuilding without content changes must produce the same
// bytes, otherwise every scheduled run would commit noise.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Monospace text with an explicit x for every character. The viewer's system
// decides which monospace font is used, and their widths differ; pinning each
// glyph keeps the typing clip-paths aligned to whole characters on any OS.
export const MONO_ADV = 0.6;
export const monoWidth = (text, size) => Array.from(text).length * size * MONO_ADV;

export function monoXs(x0, text, size) {
  const adv = size * MONO_ADV;
  return Array.from(text, (_, i) => r1(x0 + i * adv)).join(' ');
}

// segments: [{ t: 'text', fill: '#fff', weight: 700 }]
export function monoLine(x0, y, segments, { size, cls = '', attrs = '' }) {
  const segs = typeof segments === 'string' ? [{ t: segments }] : segments;
  const full = segs.map((s) => s.t).join('');
  const spans = segs
    .map((s) => {
      const a = [s.fill && `fill="${s.fill}"`, s.weight && `font-weight="${s.weight}"`].filter(Boolean).join(' ');
      return a ? `<tspan ${a}>${esc(s.t)}</tspan>` : esc(s.t);
    })
    .join('');
  return `<text class="mono ${cls}" x="${monoXs(x0, full, size)}" y="${y}" font-size="${size}" xml:space="preserve" ${attrs}>${spans}</text>`;
}

// Turns a list of [seconds, value] steps into a discrete SMIL animation that
// holds each value until the next step.
export function discreteAnimate(attr, points, total, { repeat = true } = {}) {
  // SMIL ignores the whole animation unless keyTimes starts at exactly 0.
  if (points[0][0] > 0) points = [[0, points[0][1]], ...points];
  const keyTimes = points.map(([t]) => r3(Math.min(t / total, 1))).join(';');
  const values = points.map(([, v]) => v).join(';');
  const tail = repeat ? 'repeatCount="indefinite"' : 'fill="freeze"';
  return `<animate attributeName="${attr}" dur="${r3(total)}s" calcMode="discrete" keyTimes="${keyTimes}" values="${values}" ${tail}/>`;
}

// Rounded-rectangle outline as a path, with its exact length, so a dash can
// travel around the border without relying on pathLength support.
export function roundedRectPath(x, y, w, h, r) {
  const d = [
    `M${x + r},${y}`,
    `H${x + w - r}`,
    `A${r},${r} 0 0 1 ${x + w},${y + r}`,
    `V${y + h - r}`,
    `A${r},${r} 0 0 1 ${x + w - r},${y + h}`,
    `H${x + r}`,
    `A${r},${r} 0 0 1 ${x},${y + h - r}`,
    `V${y + r}`,
    `A${r},${r} 0 0 1 ${x + r},${y}`,
    'Z',
  ].join(' ');
  const length = 2 * (w - 2 * r) + 2 * (h - 2 * r) + 2 * Math.PI * r;
  return { d, length };
}

// The shared card chrome: dark gradient, dot grid, corner glows and two
// comets of light running around the border in opposite phase.
export function cardFrame(id, w, h, { r = 22, accentA = C.cyan, accentB = C.pink, speed = 9 } = {}) {
  const { d, length } = roundedRectPath(1, 1, w - 2, h - 2, r);
  const dash = r1(length * 0.16);
  const gap = r1(length - dash);
  const defs = `
  <linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${C.bg1}"/><stop offset="1" stop-color="${C.bg0}"/>
  </linearGradient>
  <radialGradient id="${id}-glowA" cx="0" cy="0" r="1">
    <stop offset="0" stop-color="${accentA}" stop-opacity=".18"/><stop offset="1" stop-color="${accentA}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="${id}-glowB" cx="1" cy="1" r="1">
    <stop offset="0" stop-color="${accentB}" stop-opacity=".14"/><stop offset="1" stop-color="${accentB}" stop-opacity="0"/>
  </radialGradient>
  <pattern id="${id}-dots" width="24" height="24" patternUnits="userSpaceOnUse">
    <circle cx="2" cy="2" r="1" fill="#ffffff" fill-opacity=".05"/>
  </pattern>
  <linearGradient id="${id}-beamA" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${w}" y2="${h}">
    <stop offset="0" stop-color="${accentA}"/><stop offset="1" stop-color="${accentB}"/>
  </linearGradient>
  <clipPath id="${id}-clip"><path d="${d}"/></clipPath>`;
  const back = `
  <path d="${d}" fill="url(#${id}-bg)"/>
  <g clip-path="url(#${id}-clip)">
    <rect width="${w}" height="${h}" fill="url(#${id}-dots)"/>
    <rect width="${w}" height="${h}" fill="url(#${id}-glowA)"/>
    <rect width="${w}" height="${h}" fill="url(#${id}-glowB)"/>
  </g>`;
  const border = `
  <path d="${d}" fill="none" stroke="${C.line}" stroke-width="1.5"/>
  <path class="${id}-beam" d="${d}" fill="none" stroke="url(#${id}-beamA)" stroke-width="2.5" stroke-linecap="round"
        stroke-dasharray="${dash} ${gap}" style="animation-delay:0s"/>
  <path class="${id}-beam" d="${d}" fill="none" stroke="url(#${id}-beamA)" stroke-width="2.5" stroke-linecap="round"
        stroke-dasharray="${dash} ${gap}" style="animation-delay:-${r1(speed / 2)}s" opacity=".7"/>`;
  const css = `
  .${id}-beam{stroke-dashoffset:0;animation:${id}-run ${speed}s linear infinite}
  @keyframes ${id}-run{to{stroke-dashoffset:-${r1(length)}}}`;
  return { defs, back, border, css };
}

export function svgDoc({ w, h, title, desc, css = '', defs = '', body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title desc">
<title id="title">${esc(title)}</title>
<desc id="desc">${esc(desc)}</desc>
<style>
.sans{font-family:${SANS}}
.mono{font-family:${MONO}}
${css.trim()}
@media (prefers-reduced-motion: reduce){*{animation:none!important}}
</style>
<defs>${defs}</defs>
${body.trim()}
</svg>
`;
}

export function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  console.log(`wrote ${path} (${(Buffer.byteLength(content) / 1024).toFixed(1)} KB)`);
}
