// A tiny 3D toolkit for the profile cards.
//
// GitHub shows the cards through <img>, where no script runs, so nothing can
// be rendered live. Instead every object is rotated and projected here, at
// build time, and the SVG only replays the precomputed frames: SMIL morphs
// path data between frames, and CSS keyframes move dots along their orbits.

import { r1 } from './lib.mjs';

export const TAU = Math.PI * 2;
const r2 = (n) => Math.round(n * 100) / 100;

// Right-handed camera space: x to the right, y down the screen, z toward the viewer.
export function rotX([x, y, z], t) {
  const c = Math.cos(t);
  const s = Math.sin(t);
  // Positive t tips the top of an object toward the viewer (we look down on it).
  return [x, y * c + z * s, -y * s + z * c];
}

export function rotY([x, y, z], t) {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [x * c + z * s, y, -x * s + z * c];
}

export function rotZ([x, y, z], t) {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [x * c - y * s, x * s + y * c, z];
}

export function project([x, y, z], cx, cy, f = 900) {
  const k = f / (f - z);
  return { x: cx + x * k, y: cy + y * k, z, k };
}

// Colour helpers for shading faces and fading things with depth.
export function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p, s) => (p >> s) & 255;
  const c = [16, 8, 0].map((s) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t));
  return `#${((1 << 24) | (c[0] << 16) | (c[1] << 8) | c[2]).toString(16).slice(1)}`;
}
export const shade = (hex, t) => (t >= 0 ? mix(hex, '#ffffff', t) : mix(hex, '#000000', -t));

// A looping SMIL animation over precomputed frames. The first frame is
// repeated at the end so the loop has no visible seam.
export function loop(attr, frames, dur, extra = '') {
  return `<animate attributeName="${attr}" dur="${dur}s" repeatCount="indefinite" values="${[...frames, frames[0]].join(';')}" ${extra}/>`;
}

const pathOf = (pts, close = false) =>
  pts.map((p, i) => `${i ? 'L' : 'M'}${r1(p.x)},${r1(p.y)}`).join('') + (close ? 'Z' : '');

// Projects a mesh for every frame. pose(vertex, u) returns the vertex in camera
// space for loop progress u in [0, 1).
function frames(mesh, { count, pose, cx, cy, f }) {
  return Array.from({ length: count }, (_, i) => mesh.vertices.map((v) => project(pose(v, i / count), cx, cy, f)));
}

// CSS keyframes from per-frame declarations, looping back to the first frame.
//
// Performance note: SMIL animations of presentation attributes such as
// stroke-opacity or cx make Chrome recalculate style for the whole document
// on every frame (measured: ~95% of the main thread for one icosahedron),
// while SMIL on `d` and CSS animations of transform and opacity stay cheap.
// So geometry morphs through SMIL and everything else goes through CSS.
export function keyframes(name, decls, dur) {
  const n = decls.length;
  const steps = [...decls, decls[0]].map((d, i) => `${r2((100 * i) / n)}%{${d}}`).join('');
  return `@keyframes ${name}{${steps}}.${name}{animation:${name} ${dur}s linear infinite}\n`;
}

const dotFrame = (p, s, o) => `transform:translate(${r1(p.x)}px,${r1(p.y)}px) scale(${s});opacity:${o}`;

// Glowing wireframe: every edge morphs through the frames and fades as it
// moves away from the viewer, which is what sells the depth. Returns { svg, css }.
export function wireframe(mesh, opts) {
  const { id, count = 48, dur = 16, stroke, width = 1.6, near = 1, far = 0.18, dots = 0, dotFill } = opts;
  const P = frames(mesh, { count, ...opts });
  const zs = P.flat().map((p) => p.z);
  const zmin = Math.min(...zs);
  const zmax = Math.max(...zs);
  const depth = (z) => (z - zmin) / (zmax - zmin || 1);
  let svg = '';
  let css = '';
  mesh.edges.forEach(([a, b], i) => {
    const d = P.map((f) => pathOf([f[a], f[b]]));
    const o = P.map((f) => r2(far + (near - far) * depth((f[a].z + f[b].z) / 2) ** 1.4));
    const color = typeof stroke === 'function' ? stroke(i) : stroke;
    css += keyframes(`${id}e${i}`, o.map((v) => `opacity:${v}`), dur);
    svg += `<path class="${id}e${i}" d="${d[0]}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" style="opacity:${o[0]}">${loop('d', d, dur)}</path>`;
  });
  if (dots) {
    mesh.vertices.forEach((_, v) => {
      const decls = P.map((f) => dotFrame(f[v], r2(0.55 + 0.7 * depth(f[v].z)), r2(0.25 + 0.75 * depth(f[v].z))));
      const fill = typeof dotFill === 'function' ? dotFill(v) : dotFill;
      css += keyframes(`${id}v${v}`, decls, dur);
      svg += `<circle class="${id}v${v}" r="${dots}" fill="${fill}" style="${decls[0]}"/>`;
    });
  }
  return { svg, css };
}

// Solid faces drawn in a fixed back-to-front order. Only valid when the pose
// keeps that order true for every frame (for example a gentle swing rather
// than a full turn), which the caller is responsible for.
export function solid(mesh, opts) {
  const { count = 32, dur = 12, faces } = opts;
  const P = frames(mesh, { count, ...opts });
  return faces
    .map(({ idx, fill, stroke = 'none', width = 1, opacity = 1 }) => {
      const d = P.map((f) => pathOf(idx.map((i) => f[i]), true));
      return `<path d="${d[0]}" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round">${loop('d', d, dur)}</path>`;
    })
    .join('');
}

// Traces a point on the mesh (by vertex index) so a 2D decoration can ride on
// a 3D object. Returns CSS for a class named `name` that moves the element.
export function track(name, mesh, vertex, opts) {
  const P = frames(mesh, { count: opts.count ?? 32, ...opts });
  return keyframes(name, P.map((f) => `transform:translate(${r1(f[vertex].x)}px,${r1(f[vertex].y)}px)`), opts.dur);
}

// ------------------------------------------------------------ meshes ----

export function cube(s) {
  const vertices = [];
  for (const x of [-s, s]) for (const y of [-s, s]) for (const z of [-s, s]) vertices.push([x, y, z]);
  const edges = [];
  vertices.forEach((a, i) =>
    vertices.forEach((b, j) => {
      if (j > i && [0, 1, 2].filter((k) => a[k] !== b[k]).length === 1) edges.push([i, j]);
    }),
  );
  return { vertices, edges };
}

export function icosahedron(s) {
  const p = (1 + Math.sqrt(5)) / 2;
  const raw = [
    [-1, p, 0], [1, p, 0], [-1, -p, 0], [1, -p, 0],
    [0, -1, p], [0, 1, p], [0, -1, -p], [0, 1, -p],
    [p, 0, -1], [p, 0, 1], [-p, 0, -1], [-p, 0, 1],
  ];
  const n = Math.hypot(1, p);
  const vertices = raw.map((v) => v.map((c) => (c / n) * s));
  return { vertices, edges: edgesByLength(vertices) };
}

export function octahedron(s) {
  const vertices = [[s, 0, 0], [-s, 0, 0], [0, s, 0], [0, -s, 0], [0, 0, s], [0, 0, -s]];
  return { vertices, edges: edgesByLength(vertices) };
}

// Connects every pair of vertices at the shortest distance: the edges of a regular solid.
function edgesByLength(vertices) {
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  let min = Infinity;
  vertices.forEach((a, i) => vertices.forEach((b, j) => j > i && (min = Math.min(min, dist(a, b)))));
  const edges = [];
  vertices.forEach((a, i) => vertices.forEach((b, j) => j > i && Math.abs(dist(a, b) - min) < 1e-6 && edges.push([i, j])));
  return edges;
}

// ------------------------------------------------------ dotted sphere ----

// A sphere of dots on latitude rings. Every dot on a ring follows the same
// orbit, so one CSS keyframes block per ring is enough; each dot only gets a
// negative delay that sets its longitude. `make` builds the element for a
// dot (a circle or a word) and receives its initial transform so it still
// sits in place when animations are disabled.
export function sphereRings(id, { cx, cy, R, tilt, period, f = 900, rings, near, far, steps = 36, scale = [0.55, 1.15], opacity = [0.12, 1], tint = true }) {
  let css = '';
  const place = (lat, lon) => {
    const r = R * Math.cos(lat);
    const p = rotX([r * Math.sin(lon), -R * Math.sin(lat), r * Math.cos(lon)], tilt);
    const q = project(p, cx, cy, f);
    const t = (p[2] / R + 1) / 2;
    const s = r2((scale[0] + (scale[1] - scale[0]) * t) * q.k);
    const o = r2(opacity[0] + (opacity[1] - opacity[0]) * t ** 1.5);
    return { x: r1(q.x), y: r1(q.y), s, o, color: mix(far, near, t) };
  };
  rings.forEach((lat, k) => {
    let frames = '';
    for (let i = 0; i <= steps; i++) {
      const p = place(lat, (TAU * i) / steps);
      // Animating fill forces a full repaint of every dot, so plain dots skip it.
      frames += `${r2((100 * i) / steps)}%{transform:translate(${p.x}px,${p.y}px) scale(${p.s});opacity:${p.o}${tint ? `;fill:${p.color}` : ''}}`;
    }
    css += `@keyframes ${id}-k${k}{${frames}}.${id}-r${k}{animation:${id}-k${k} ${period}s linear infinite}\n`;
  });
  const item = (k, lon) => {
    const p = place(rings[k], lon);
    const delay = r2(-(((lon % TAU) + TAU) % TAU / TAU) * period);
    return {
      cls: `${id}-r${k}`,
      style: `transform:translate(${p.x}px,${p.y}px) scale(${p.s});opacity:${p.o}${tint ? `;fill:${p.color}` : ''};animation-delay:${delay}s`,
    };
  };
  return { css, item, place };
}

// Great-circle arcs lifted off the sphere, rotating with it. Returns { svg, css }.
export function sphereArcs(id, { cx, cy, R, tilt, period, f = 900, arcs, color, count = 36, lift = 0.28 }) {
  const unit = (lat, lon) => [Math.cos(lat) * Math.sin(lon), -Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
  let svg = '';
  let css = `@keyframes ${id}-pulse{from{stroke-dashoffset:100}to{stroke-dashoffset:0}}
`;
  arcs.forEach(([a, b], n) => {
    const A = unit(...a);
    const B = unit(...b);
    const omega = Math.acos(Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]));
    const samples = 18;
    const pts = Array.from({ length: samples + 1 }, (_, i) => {
      const u = i / samples;
      const wa = Math.sin((1 - u) * omega) / Math.sin(omega);
      const wb = Math.sin(u * omega) / Math.sin(omega);
      const h = R * (1 + lift * Math.sin(Math.PI * u));
      return [0, 1, 2].map((k) => (wa * A[k] + wb * B[k]) * h);
    });
    const D = [];
    const O = [];
    const ends = [[], []];
    for (let i = 0; i < count; i++) {
      const proj = pts.map((p) => project(rotX(rotY(p, (TAU * i) / count), tilt), cx, cy, f));
      D.push(pathOf(proj));
      const mid = proj[samples >> 1].z / (R * (1 + lift));
      O.push(`opacity:${r2(0.12 + 0.88 * Math.max(0, (mid + 0.35) / 1.35) ** 1.3)}`);
      ends[0].push(`transform:translate(${r1(proj[0].x)}px,${r1(proj[0].y)}px)`);
      ends[1].push(`transform:translate(${r1(proj[samples].x)}px,${r1(proj[samples].y)}px)`);
    }
    const c = typeof color === 'function' ? color(n) : color;
    css += keyframes(`${id}-o${n}`, O, period) + keyframes(`${id}-s${n}`, ends[0], period) + keyframes(`${id}-t${n}`, ends[1], period);
    css += `.${id}-p${n}{animation:${id}-pulse ${r1(2.2 + n * 0.37)}s linear infinite}
`;
    // The arc geometry is defined once and drawn twice (a faint trail and a
    // travelling pulse) through <use>, which halves the file size.
    svg += `<defs><path id="${id}-arc${n}" d="${D[0]}" pathLength="100">${loop('d', D, period)}</path></defs>
    <g class="${id}-o${n}" style="${O[0]}">
      <use href="#${id}-arc${n}" fill="none" stroke="${c}" stroke-opacity=".35" stroke-width="1.2"/>
      <use class="${id}-p${n}" href="#${id}-arc${n}" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="14 86"/>
      <circle class="${id}-s${n}" r="3" fill="${c}" style="${ends[0][0]}"/>
      <circle class="${id}-t${n}" r="3" fill="${c}" style="${ends[1][0]}"/>
    </g>`;
  });
  return { svg, css };
}

// Rows of a moving 3D landscape seen in perspective. Each row is filled with
// the background so nearer ridges hide the ones behind them.
export function ridgelines({ W, yTop, yBottom, rows = 9, cols = 48, count = 16, dur = 9, amp = 24, fill, stroke }) {
  let svg = '';
  for (let j = 0; j < rows; j++) {
    const t = j / (rows - 1);
    const base = yTop + (yBottom - yTop) * t ** 1.35;
    const s = 0.5 + 0.5 * t;
    const D = [];
    for (let i = 0; i < count; i++) {
      const phi = (TAU * i) / count;
      let d = '';
      for (let c = 0; c <= cols; c++) {
        const X = (W * c) / cols;
        const xw = (X - W / 2) / s;
        const env = 0.3 + 0.7 * Math.exp(-(((xw + 120) / 460) ** 2));
        const z = amp * s * env * (Math.sin(0.0105 * xw + 0.85 * j - phi) + 0.45 * Math.sin(0.026 * xw - 1.3 * j + 2 * phi));
        d += `${c ? 'L' : 'M'}${Math.round(X)},${r1(base - z)}`;
      }
      D.push(`${d}L${W},${yBottom + 40}L0,${yBottom + 40}Z`);
    }
    svg += `<path d="${D[0]}" fill="${fill}" stroke="${stroke}" stroke-width="${r1(0.8 + 0.9 * t)}" stroke-opacity="${r2(0.18 + 0.72 * t)}" stroke-linejoin="round">${loop('d', D, dur)}</path>`;
  }
  return svg;
}
