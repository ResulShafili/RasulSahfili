// Builds the hand-designed cards (hero, terminal, stack, section titles,
// projects, connect) from scripts/profile.mjs into assets/.

import { fileURLToPath } from 'node:url';
import { C, MONO_ADV, cardFrame, discreteAnimate, esc, monoLine, monoWidth, r1, rng, svgDoc, write } from './lib.mjs';
import { profile } from './profile.mjs';
import { TAU, cube, icosahedron, mix, octahedron, ridgelines, rotX, rotY, shade, solid, sphereArcs, sphereRings, track, wireframe } from './space.mjs';

const OUT = fileURLToPath(new URL('../assets/', import.meta.url));
const color = (name) => C[name] ?? name;
const deg = (d) => (d * Math.PI) / 180;

// A dotted globe: rings of dots orbiting a tilted axis, a shaded body, a
// tilted orbit with a satellite and optional arcs flying between points.
function globe(id, { cx, cy, R, tilt = 0.38, period = 26, rings, density = 24, arcs = [], orbit = true, dot = 2.4 }) {
  const G = { cx, cy, R, tilt, period, f: 900 };
  const sphere = sphereRings(id, { ...G, rings, near: '#a5f3fc', far: '#5b21b6', tint: false });
  const arcSet = arcs.length ? sphereArcs(id, { ...G, arcs, color: (n) => [C.cyan, C.pink, C.amber, C.violet, C.green][n % 5] }) : { svg: '', css: '' };
  let dots = '';
  rings.forEach((lat, k) => {
    const n = Math.max(6, Math.round(density * Math.cos(lat)));
    for (let i = 0; i < n; i++) {
      const it = sphere.item(k, (TAU * i) / n + k * 0.37);
      dots += `<circle class="${it.cls}" r="${dot}" fill="${mix('#a5f3fc', '#c4b5fd', (Math.sin(lat) + 1) / 2)}" style="${it.style}"/>`;
    }
  });
  const defs = `
  <radialGradient id="${id}-halo"><stop offset=".55" stop-color="${C.cyan}" stop-opacity=".16"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/></radialGradient>
  <radialGradient id="${id}-body" cx=".36" cy=".3" r=".8">
    <stop offset="0" stop-color="#1e3a8a" stop-opacity=".55"/><stop offset=".6" stop-color="#111a3a" stop-opacity=".6"/><stop offset="1" stop-color="#060913" stop-opacity=".85"/>
  </radialGradient>
  <linearGradient id="${id}-rim" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${C.cyan}" stop-opacity=".9"/><stop offset=".5" stop-color="${C.violet}" stop-opacity=".15"/><stop offset="1" stop-color="${C.pink}" stop-opacity=".5"/>
  </linearGradient>`;
  const rx = R * 1.42;
  const ry = R * 0.3;
  const ringPath = `M${r1(cx - rx)},${cy} A${r1(rx)},${r1(ry)} 0 0 1 ${r1(cx + rx)},${cy} A${r1(rx)},${r1(ry)} 0 0 1 ${r1(cx - rx)},${cy}`;
  const back = orbit
    ? `<g transform="rotate(-16 ${cx} ${cy})"><path d="M${r1(cx - rx)},${cy} A${r1(rx)},${r1(ry)} 0 0 1 ${r1(cx + rx)},${cy}" fill="none" stroke="${C.violet}" stroke-opacity=".35" stroke-width="1.2" stroke-dasharray="3 6"/></g>`
    : '';
  const front = orbit
    ? `<g transform="rotate(-16 ${cx} ${cy})">
        <path d="M${r1(cx + rx)},${cy} A${r1(rx)},${r1(ry)} 0 0 1 ${r1(cx - rx)},${cy}" fill="none" stroke="${C.cyan}" stroke-opacity=".6" stroke-width="1.4"/>
        <circle class="${id}-sat" r="5" fill="${C.pink}"><animateMotion dur="9s" repeatCount="indefinite" path="${ringPath}"/></circle>
      </g>`
    : '';
  const svg = `
  <circle cx="${cx}" cy="${cy}" r="${r1(R * 1.5)}" fill="url(#${id}-halo)"/>
  ${back}
  <circle cx="${cx}" cy="${cy}" r="${r1(R + 2)}" fill="url(#${id}-body)"/>
  ${dots}
  ${arcSet.svg}
  <circle cx="${cx}" cy="${cy}" r="${r1(R + 2)}" fill="none" stroke="url(#${id}-rim)" stroke-width="1.5"/>
  ${front}`;
  const css = `${sphere.css}${arcSet.css}
  .${id}-sat{animation:${id}-sat 9s steps(1) infinite}
  @keyframes ${id}-sat{0%{opacity:.25}50%{opacity:1}}`;
  return { css, defs, svg };
}

// ---------------------------------------------------------------- hero ----

function hero() {
  const W = 1200;
  const H = 480;
  const rand = rng(7);
  const f = cardFrame('h', W, H, { r: 26, speed: 10 });

  let stars = '';
  for (let i = 0; i < 55; i++) {
    const x = r1(rand() * W);
    const y = r1(rand() * 380);
    stars += `<circle class="h-star" cx="${x}" cy="${y}" r="${r1(0.5 + rand() * 1.2)}" style="animation-duration:${r1(2 + rand() * 4)}s;animation-delay:${r1(-rand() * 6)}s"/>`;
  }

  const g = globe('hg', {
    cx: 930,
    cy: 212,
    R: 150,
    rings: [-70, -56, -42, -28, -14, 0, 14, 28, 42, 56, 70].map(deg),
    arcs: [
      [[deg(40), deg(-20)], [deg(10), deg(70)]],
      [[deg(-10), deg(20)], [deg(35), deg(130)]],
      [[deg(55), deg(160)], [deg(-25), deg(230)]],
      [[deg(-40), deg(-80)], [deg(15), deg(-10)]],
      [[deg(20), deg(200)], [deg(-5), deg(300)]],
    ],
  });

  // Name in extruded 3D letters. Each depth layer slides sideways as if the
  // word were turning, which reads as a slow yaw of a solid object.
  const layers = 8;
  const nameLines = profile.name.toUpperCase().split(' ');
  const nx = 60;
  const ny = [176, 268];
  const nameAttr = (y) => `x="${nx}" y="${y}" font-size="94" font-weight="900" letter-spacing="3"`;
  let extrude = '';
  let extrudeCss = '';
  for (let i = layers; i >= 1; i--) {
    const fill = mix('#6d28d9', '#140f33', (i - 1) / (layers - 1));
    const sx = r1(i * 1.35);
    const sy = r1(i * 1.2);
    extrudeCss += `@keyframes hx${i}{from{transform:translate(${sx}px,${sy}px)}to{transform:translate(${-sx}px,${sy}px)}}
  .hx${i}{transform:translate(0,${sy}px);animation:hx${i} 7s cubic-bezier(.37,0,.63,1) infinite alternate}\n`;
    extrude += `<g class="hx${i}">${nameLines.map((l, k) => `<text class="sans" ${nameAttr(ny[k])} fill="${fill}">${esc(l)}</text>`).join('')}</g>`;
  }
  const front = nameLines.map((l, k) => `<text class="sans h-name" ${nameAttr(ny[k])}>${esc(l)}</text>`).join('');

  // Rotating typewriter under the name.
  const size = 22;
  const adv = size * MONO_ADV;
  const lineY = 320;
  const x0 = nx + 2;
  const typeS = 0.055;
  const holdS = 2.2;
  const delS = 0.022;
  const gapS = 0.5;
  let t = 0;
  const slots = profile.roles.map((text) => {
    const n = Array.from(text).length;
    const start = t + gapS;
    const held = start + n * typeS + holdS;
    const end = held + n * delS;
    t = end;
    return { text, n, start, held, end };
  });
  const total = t;
  let typing = '';
  let clips = '';
  const cursorPts = [[0, x0]];
  slots.forEach((s, i) => {
    const pts = [[0, 0]];
    for (let k = 1; k <= s.n; k++) {
      const tk = s.start + k * typeS;
      pts.push([tk, r1(k * adv + 2)]);
      cursorPts.push([tk, r1(x0 + k * adv + 2)]);
    }
    for (let k = s.n - 1; k >= 0; k--) {
      const tk = s.held + (s.n - k) * delS;
      pts.push([tk, k === 0 ? 0 : r1(k * adv + 2)]);
      cursorPts.push([tk, r1(x0 + k * adv + 2)]);
    }
    clips += `<clipPath id="h-type${i}"><rect x="${x0 - 2}" y="${lineY - 26}" height="36" width="0">${discreteAnimate('width', pts, total)}</rect></clipPath>`;
    const [head, ...rest] = s.text.split(' · ');
    const segs = [{ t: head, fill: C.text, weight: 700 }];
    if (rest.length) segs.push({ t: ` · ${rest.join(' · ')}`, fill: C.muted });
    typing += `<g clip-path="url(#h-type${i})">${monoLine(x0, lineY, segs, { size })}</g>`;
  });
  cursorPts.sort((a, b) => a[0] - b[0]);
  const cursor = `<rect class="h-cursor" x="${x0}" y="${lineY - 19}" width="12" height="25" rx="2" fill="${C.cyan}">${discreteAnimate('x', cursorPts, total)}</rect>`;

  // Info chips with tiny line icons.
  const icons = [
    (x, y) => `<path d="M${x} ${y + 7}c-4-5-6-8-6-11a6 6 0 0 1 12 0c0 3-2 6-6 11z" fill="none" stroke="${C.cyan}" stroke-width="1.6"/><circle cx="${x}" cy="${y - 4}" r="2" fill="${C.cyan}"/>`,
    (x, y) => `<path d="M${x - 8} ${y - 2}l8-5 8 5-8 5z" fill="none" stroke="${C.violet}" stroke-width="1.6" stroke-linejoin="round"/><path d="M${x - 4} ${y + 1}v4c2 2 6 2 8 0v-4" fill="none" stroke="${C.violet}" stroke-width="1.6"/>`,
    (x, y) => `<rect x="${x - 8}" y="${y - 7}" width="16" height="11" rx="3" fill="none" stroke="${C.pink}" stroke-width="1.6"/><path d="M${x - 3} ${y + 4}l-2 4 5-4" fill="none" stroke="${C.pink}" stroke-width="1.6" stroke-linejoin="round"/>`,
  ];
  const chipSize = 14;
  let cx = x0;
  let chips = '';
  profile.chips.forEach((c, i) => {
    const w = monoWidth(c, chipSize) + 48;
    chips += `<g class="h-rise" style="animation-delay:${r1(2.4 + i * 0.15)}s">
      <rect x="${r1(cx)}" y="${344 + 4}" width="${r1(w)}" height="36" rx="18" fill="#000" fill-opacity=".45"/>
      <rect x="${r1(cx)}" y="344" width="${r1(w)}" height="36" rx="18" fill="${C.panel}" stroke="${C.line}"/>
      ${icons[i % icons.length](r1(cx + 22), 362)}
      ${monoLine(r1(cx + 38), 367, [{ t: c, fill: C.text }], { size: chipSize })}
    </g>`;
    cx += w + 12;
  });

  let eq = '';
  for (let i = 0; i < 6; i++) {
    eq += `<rect class="h-eq" x="${1112 + i * 9}" y="30" width="5" height="22" rx="2" fill="${i % 2 ? C.pink : C.cyan}" style="animation-delay:-${r1(i * 0.17)}s;animation-duration:${r1(0.8 + (i % 3) * 0.25)}s"/>`;
  }

  const defs = `${f.defs}${g.defs}
  <radialGradient id="h-a1"><stop offset="0" stop-color="${C.cyan}" stop-opacity=".26"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/></radialGradient>
  <radialGradient id="h-a2"><stop offset="0" stop-color="${C.purple}" stop-opacity=".32"/><stop offset="1" stop-color="${C.purple}" stop-opacity="0"/></radialGradient>
  <radialGradient id="h-a3"><stop offset="0" stop-color="${C.pink}" stop-opacity=".18"/><stop offset="1" stop-color="${C.pink}" stop-opacity="0"/></radialGradient>
  <linearGradient id="h-name" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="640" y2="0" spreadMethod="repeat">
    <stop offset="0" stop-color="#67e8f9"/><stop offset=".33" stop-color="#c4b5fd"/><stop offset=".66" stop-color="#f9a8d4"/><stop offset="1" stop-color="#67e8f9"/>
    <animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="640 0" dur="6s" repeatCount="indefinite"/>
  </linearGradient>
  <linearGradient id="h-rfill" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="${H}"><stop offset="0" stop-color="${C.bg1}"/><stop offset="1" stop-color="${C.bg0}"/></linearGradient>
  <linearGradient id="h-rstroke" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.cyan}"/><stop offset=".5" stop-color="${C.violet}"/><stop offset="1" stop-color="${C.pink}"/></linearGradient>
  ${clips}`;

  const css = `${f.css}
  ${g.css}
  ${extrudeCss}
  .h-star{fill:#fff;animation:h-tw 3s ease-in-out infinite}
  @keyframes h-tw{0%,100%{opacity:.15}50%{opacity:.9}}
  .h-a{animation:h-drift 18s ease-in-out infinite alternate}
  .h-a2{animation-duration:23s;animation-direction:alternate-reverse}
  .h-a3{animation-duration:15s}
  @keyframes h-drift{0%{transform:translate(0,0)}50%{transform:translate(140px,40px)}100%{transform:translate(-120px,-20px)}}
  .h-kicker{animation:h-rise .7s ease-out .2s both}
  .h-depth{animation:h-fade 1.2s ease-out 1s both}
  @keyframes h-fade{from{opacity:0}}
  .h-name{fill:url(#h-name);stroke:#fff;stroke-opacity:.35;stroke-width:1;stroke-dasharray:420;stroke-dashoffset:0;fill-opacity:1;animation:h-draw 2.2s ease-out both}
  @keyframes h-draw{0%{stroke-dashoffset:420;fill-opacity:0;stroke-opacity:1}55%{fill-opacity:0}100%{stroke-dashoffset:0;fill-opacity:1;stroke-opacity:.35}}
  .h-rise{animation:h-rise .7s cubic-bezier(.2,.9,.3,1.2) both}
  @keyframes h-rise{from{opacity:0;transform:translateY(14px)}}
  .h-cursor{animation:h-blink 1s steps(1) infinite}
  @keyframes h-blink{50%{opacity:0}}
  .h-eq{transform-box:fill-box;transform-origin:50% 100%;animation:h-eq 1s ease-in-out infinite alternate}
  @keyframes h-eq{from{transform:scaleY(.2)}to{transform:scaleY(1)}}
  .h-globe{animation:h-fade 1.6s ease-out .3s both}`;

  const body = `
  ${f.back}
  <g clip-path="url(#h-clip)">
    <circle class="h-a" cx="180" cy="60" r="380" fill="url(#h-a1)"/>
    <circle class="h-a h-a2" cx="1020" cy="120" r="400" fill="url(#h-a2)"/>
    <circle class="h-a h-a3" cx="560" cy="470" r="360" fill="url(#h-a3)"/>
    ${stars}
    <g class="h-globe">${g.svg}</g>
    ${ridgelines({ W, yTop: 392, yBottom: 472, rows: 7, cols: 40, count: 16, dur: 10, amp: 22, fill: 'url(#h-rfill)', stroke: 'url(#h-rstroke)' })}
  </g>

  <text class="mono" x="44" y="46" font-size="14" fill="${C.dim}" letter-spacing="1">github.com/${esc(profile.login)}</text>
  ${eq}

  <text class="mono h-kicker" x="${x0}" y="84" font-size="17" fill="${C.cyan}" letter-spacing="6">// HELLO, I'M</text>
  <g class="h-depth">${extrude}</g>
  ${front}

  ${typing}
  ${cursor}
  ${chips}
  ${f.border}`;

  return svgDoc({ w: W, h: H, title: profile.name, desc: `${profile.name}: ${profile.roles.join('; ')}.`, css, defs, body });
}

// ------------------------------------------------------------ terminal ----

function terminal() {
  const W = 1200;
  const size = 20;
  const adv = size * MONO_ADV;
  const x0 = 44;
  const pitch = 36;
  const prompt = [
    { t: 'rasul', fill: C.green, weight: 700 },
    { t: '@github', fill: C.green },
    { t: ':', fill: C.muted },
    { t: '~', fill: C.cyan, weight: 700 },
    { t: ' $ ', fill: C.muted },
  ];
  const promptLen = Array.from(prompt.map((p) => p.t).join('')).length;
  const cmdX = x0 + promptLen * adv;

  let y = 104;
  let t = 0.5;
  let lines = '';
  let clips = '';
  const cursor = [[0, cmdX, y]];

  profile.terminal.forEach((step, i) => {
    const n = Array.from(step.cmd).length;
    const promptAt = t;
    const typeStart = promptAt + 0.35;
    lines += `<g class="t-in" style="animation-delay:${r1(promptAt)}s">${monoLine(x0, y, prompt, { size })}</g>`;
    cursor.push([promptAt, cmdX, y]);
    const pts = [[0, 0]];
    for (let k = 1; k <= n; k++) {
      const tk = typeStart + k * 0.075;
      pts.push([tk, r1(k * adv + 2)]);
      cursor.push([tk, r1(cmdX + k * adv + 2), y]);
    }
    const typedAt = typeStart + n * 0.075;
    clips += `<clipPath id="t-cmd${i}"><rect x="${r1(cmdX - 2)}" y="${y - 24}" height="34" width="${r1(n * adv + 4)}">${discreteAnimate('width', pts, typedAt + 0.01, { repeat: false })}</rect></clipPath>`;
    lines += `<g clip-path="url(#t-cmd${i})">${monoLine(cmdX, y, [{ t: step.cmd, fill: C.text }], { size })}</g>`;
    let outAt = typedAt + 0.35;
    step.out.forEach((seg) => {
      y += pitch;
      const segs = seg.map((s) => ({ ...s, fill: color(s.fill) }));
      lines += `<g class="t-in" style="animation-delay:${r1(outAt)}s">${monoLine(x0, y, segs, { size })}</g>`;
      outAt += 0.14;
    });
    y += pitch + 14;
    t = outAt + 0.45;
  });

  lines += `<g class="t-in" style="animation-delay:${r1(t)}s">${monoLine(x0, y, prompt, { size })}</g>`;
  cursor.push([t, cmdX, y]);
  const H = y + 40;
  const total = t + 0.01;
  const cursorEl = `<rect class="t-cursor" x="${r1(cmdX)}" y="${y - 17}" width="11" height="22" rx="1.5" fill="${C.cyan}">
    ${discreteAnimate('x', cursor.map(([tt, x]) => [tt, r1(x)]), total, { repeat: false })}${discreteAnimate('y', cursor.map(([tt, , yy]) => [tt, yy - 17]), total, { repeat: false })}</rect>`;

  // A glass icosahedron with an octahedron spinning the other way inside it.
  const ox = 1062;
  const oy = 190;
  const ico = wireframe(icosahedron(74), {
    id: 'ti',
    cx: ox,
    cy: oy,
    f: 600,
    count: 36,
    dur: 18,
    pose: (v, u) => rotX(rotY(v, TAU * u), 0.35 + 0.25 * Math.sin(TAU * u)),
    stroke: (i) => (i % 3 ? C.green : C.cyan),
    width: 1.6,
    dots: 3.4,
    dotFill: (i) => (i % 2 ? C.cyan : '#a7f3d0'),
  });
  const octa = wireframe(octahedron(30), {
    id: 'to',
    cx: ox,
    cy: oy,
    f: 600,
    count: 36,
    dur: 18,
    pose: (v, u) => rotX(rotY(v, -TAU * 2 * u), 0.6),
    stroke: C.pink,
    width: 1.4,
    near: 1,
    far: 0.3,
  });

  const status = [
    ['STATUS', 'learning', C.green],
    ['FOCUS', 'AI · Data · Web', C.violet],
    ['TIMEZONE', 'UTC+4', C.cyan],
  ];
  let side = '';
  status.forEach(([k, v, c], i) => {
    const sy = 318 + i * 46;
    side += `<g class="t-in" style="animation-delay:${r1(1 + i * 0.15)}s">
      <text class="mono" x="972" y="${sy}" font-size="12" fill="${C.dim}" letter-spacing="2">${k}</text>
      <circle class="t-pulse" cx="978" cy="${sy + 18}" r="4" fill="${c}" style="animation-delay:-${i * 0.6}s"/>
      <text class="mono" x="990" y="${sy + 23}" font-size="15" fill="${C.text}">${esc(v)}</text>
    </g>`;
  });

  const f = cardFrame('t', W, H, { r: 20, accentA: C.green, accentB: C.cyan, speed: 12 });
  const defs = `${f.defs}${clips}
  <radialGradient id="t-core"><stop offset="0" stop-color="${C.green}" stop-opacity=".28"/><stop offset="1" stop-color="${C.green}" stop-opacity="0"/></radialGradient>
  <radialGradient id="t-shadow"><stop offset="0" stop-color="${C.cyan}" stop-opacity=".35"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/></radialGradient>`;
  const css = `${f.css}
  ${ico.css}
  ${octa.css}
  .t-in{animation:t-in .3s ease-out both}
  @keyframes t-in{from{opacity:0;transform:translateY(6px)}}
  .t-cursor{animation:t-blink 1s steps(1) infinite}
  @keyframes t-blink{50%{opacity:0}}
  .t-pulse{transform-box:fill-box;transform-origin:center;animation:t-pulse 1.8s ease-in-out infinite}
  @keyframes t-pulse{50%{transform:scale(.55);opacity:.5}}
  .t-float{animation:t-float 6s ease-in-out infinite alternate}
  @keyframes t-float{from{transform:translateY(-6px)}to{transform:translateY(6px)}}
  .t-shadow{transform-box:fill-box;transform-origin:center;animation:t-shadow 6s ease-in-out infinite alternate}
  @keyframes t-shadow{from{transform:scale(.8);opacity:.6}to{transform:scale(1.05);opacity:1}}`;

  const body = `
  ${f.back}
  <g clip-path="url(#t-clip)">
    <rect width="${W}" height="54" fill="${C.panel2}" fill-opacity=".9"/>
    <line x1="0" y1="54" x2="${W}" y2="54" stroke="${C.line}"/>
  </g>
  <circle cx="34" cy="27" r="7" fill="#ff5f57"/><circle cx="58" cy="27" r="7" fill="#febc2e"/><circle cx="82" cy="27" r="7" fill="#28c840"/>
  <text class="mono" x="600" y="32" text-anchor="middle" font-size="14" fill="${C.dim}">rasul@github: ~ — zsh</text>
  <line x1="948" y1="80" x2="948" y2="${H - 30}" stroke="${C.line}" stroke-dasharray="3 5"/>
  <ellipse class="t-shadow" cx="${ox}" cy="${oy + 105}" rx="70" ry="10" fill="url(#t-shadow)"/>
  <g class="t-float">
    <circle cx="${ox}" cy="${oy}" r="90" fill="url(#t-core)"/>
    ${octa.svg}
    ${ico.svg}
  </g>
  ${lines}
  ${cursorEl}
  ${side}
  ${f.border}`;

  return svgDoc({
    w: W,
    h: H,
    title: 'About me',
    desc: profile.terminal
      .map((s) => s.out.map((o) => o.map((x) => x.t).join('').replace(/^◆ /, '').replace(/\s{2,}/g, ': ')).join('; '))
      .join('. '),
    css,
    defs,
    body,
  });
}

// --------------------------------------------------------------- stack ----

function stack() {
  const W = 1200;
  const H = 400;
  const f = cardFrame('s', W, H, { r: 20, accentA: C.violet, accentB: C.cyan, speed: 11 });
  const rand = rng(3);

  // A 3D sphere of words, turning on a tilted axis.
  const S = { cx: 232, cy: 200, R: 138, tilt: 0.42, period: 22, f: 700 };
  const words = [...new Set(profile.stack.flatMap((r) => r.items.map((i) => i[0])))];
  const wordRings = [deg(-62), deg(-32), 0, deg(32), deg(62)];
  const perRing = [2, 3, 4, 3, 2];
  const wsphere = sphereRings('sw', { ...S, rings: wordRings, near: '#f0f9ff', far: '#475569', scale: [0.62, 1.12], opacity: [0.25, 1] });
  let wordEls = '';
  let w = 0;
  wordRings.forEach((_, k) => {
    for (let i = 0; i < perRing[k] && w < words.length; i++, w++) {
      const it = wsphere.item(k, (TAU * i) / perRing[k] + k * 0.9);
      wordEls += `<text class="mono ${it.cls}" x="0" y="5" text-anchor="middle" font-size="16" font-weight="700" style="${it.style}">${esc(words[w])}</text>`;
    }
  });
  const dotRings = [-76, -47, -16, 16, 47, 76].map(deg);
  const dsphere = sphereRings('sd', { ...S, rings: dotRings, near: C.violet, far: '#312e81', scale: [0.5, 1.1], opacity: [0.15, 0.8] });
  let dotEls = '';
  dotRings.forEach((lat, k) => {
    const n = Math.max(6, Math.round(22 * Math.cos(lat)));
    for (let i = 0; i < n; i++) {
      const it = dsphere.item(k, (TAU * i) / n);
      dotEls += `<circle class="${it.cls}" r="1.8" style="${it.style}"/>`;
    }
  });
  const eqRy = r1(S.R * Math.sin(S.tilt));

  // Categorised list with keycap chips that get pressed now and then.
  const size = 18;
  const lx = 478;
  let rows = '';
  let n = 0;
  profile.stack.forEach((row, ri) => {
    const ly = 62 + ri * 84;
    rows += `<g class="s-in" style="animation-delay:${r1(ri * 0.12)}s">
      <text class="mono" x="${lx}" y="${ly}" font-size="12" fill="${C.dim}" letter-spacing="3">0${ri + 1}</text>
      <text class="mono" x="${lx + 30}" y="${ly}" font-size="13" fill="${C.muted}" letter-spacing="3" font-weight="700">${esc(row.label)}</text>
      <line x1="${r1(lx + 44 + monoWidth(row.label, 13) + row.label.length * 3)}" y1="${ly - 4}" x2="1160" y2="${ly - 4}" stroke="${C.line}" stroke-dasharray="2 5"/>
    </g>`;
    let x = lx;
    const cy = ly + 30;
    row.items.forEach(([label, c]) => {
      const cw = monoWidth(label, size) + 54;
      const d = r1(0.3 + n * 0.05);
      const press = r1(-rand() * 8);
      rows += `<g class="s-chip" style="animation-delay:${d}s">
        <rect x="${r1(x)}" y="${cy - 17}" width="${r1(cw)}" height="40" rx="11" fill="${shade(mix(C.panel, c, 0.35), -0.35)}"/>
        <g class="s-key" style="animation-delay:${press}s;animation-duration:${r1(6 + rand() * 5)}s">
          <rect x="${r1(x)}" y="${cy - 22}" width="${r1(cw)}" height="40" rx="11" fill="${C.panel2}" stroke="${c}" stroke-opacity=".45"/>
          <rect x="${r1(x + 3)}" y="${cy - 20}" width="${r1(cw - 6)}" height="14" rx="7" fill="#fff" fill-opacity=".04"/>
          <circle cx="${r1(x + 22)}" cy="${cy - 2}" r="11" fill="${c}" fill-opacity=".16"/>
          <circle cx="${r1(x + 22)}" cy="${cy - 2}" r="5" fill="${c}"/>
          ${monoLine(r1(x + 38), cy + 4, [{ t: label, fill: C.text }], { size })}
        </g>
      </g>`;
      x += cw + 12;
      n++;
    });
  });

  const defs = `${f.defs}
  <radialGradient id="s-body" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="${C.purple}" stop-opacity=".22"/><stop offset="1" stop-color="${C.bg0}" stop-opacity=".2"/></radialGradient>
  <linearGradient id="s-shine" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".07"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </linearGradient>`;
  const css = `${f.css}
  ${wsphere.css}
  ${dsphere.css}
  .s-in{animation:s-in .5s ease-out both}
  @keyframes s-in{from{opacity:0;transform:translateX(-12px)}}
  .s-chip{animation:s-pop .55s cubic-bezier(.2,1.5,.4,1) both}
  @keyframes s-pop{from{opacity:0;transform:translateY(14px)}}
  .s-key{animation:s-key 8s ease-in-out infinite}
  @keyframes s-key{0%,90%,100%{transform:translateY(0)}93%,95%{transform:translateY(4px)}}
  .s-shine{animation:s-shine 7s ease-in-out 1.5s infinite}
  @keyframes s-shine{0%{transform:translateX(-400px) skewX(-20deg)}40%,100%{transform:translateX(1500px) skewX(-20deg)}}`;

  const body = `
  ${f.back}
  <circle cx="${S.cx}" cy="${S.cy}" r="${S.R + 20}" fill="url(#s-body)"/>
  <ellipse cx="${S.cx}" cy="${S.cy}" rx="${S.R}" ry="${eqRy}" fill="none" stroke="${C.violet}" stroke-opacity=".25" stroke-dasharray="2 5"/>
  <circle cx="${S.cx}" cy="${S.cy}" r="${S.R + 4}" fill="none" stroke="${C.violet}" stroke-opacity=".22"/>
  ${dotEls}
  ${wordEls}
  <line x1="446" y1="40" x2="446" y2="${H - 40}" stroke="${C.line}" stroke-dasharray="3 5"/>
  ${rows}
  <g clip-path="url(#s-clip)"><rect class="s-shine" x="0" y="0" width="260" height="${H}" fill="url(#s-shine)"/></g>
  ${f.border}`;

  return svgDoc({
    w: W,
    h: H,
    title: 'Tech stack',
    desc: profile.stack.map((r) => `${r.label.toLowerCase()}: ${r.items.map((i) => i[0]).join(', ')}`).join('; '),
    css,
    defs,
    body,
  });
}

// -------------------------------------------------------- section title ---

function sectionTitle(index, text, accent = C.cyan) {
  const W = 1200;
  const H = 84;
  const size = 30;
  const label = text.toUpperCase();
  // Titles sit directly on GitHub's page background, which is white or dark
  // depending on the viewer, so the text uses mid-tone colours readable on both.
  const deep = { [C.violet]: '#7c3aed', [C.cyan]: '#0891b2', [C.green]: '#059669' }[accent] ?? accent;
  const numX = 76;
  const textX = 122;
  const textEnd = textX + monoWidth(label, size);
  const cubeSvg = wireframe(cube(12), {
    id: 'sc',
    cx: 40,
    cy: 44,
    f: 300,
    count: 24,
    dur: 7,
    pose: (v, u) => rotX(rotY(v, TAU * u), 0.55 + 0.2 * Math.sin(TAU * u)),
    stroke: deep,
    width: 1.8,
    near: 1,
    far: 0.3,
    dots: 2.4,
    dotFill: '#db2777',
  });
  const css = `${cubeSvg.css}
  .st-in{animation:st-in .6s ease-out both}
  @keyframes st-in{from{opacity:0;transform:translateX(-16px)}}
  .st-under{stroke-dasharray:60 400;animation:st-under 3.2s ease-in-out infinite}
  @keyframes st-under{from{stroke-dashoffset:60}to{stroke-dashoffset:-400}}
  .st-dot{animation:st-dot 4s ease-in-out infinite}
  @keyframes st-dot{0%{transform:translateX(0);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateX(${r1(W - textEnd - 70)}px);opacity:0}}
  .st-blink{animation:st-blink 1s steps(1) infinite}
  @keyframes st-blink{50%{opacity:0}}`;
  const defs = `
  <linearGradient id="st-text" gradientUnits="userSpaceOnUse" x1="${textX}" y1="0" x2="${r1(textEnd)}" y2="0">
    <stop offset="0" stop-color="${deep}"/><stop offset="1" stop-color="#db2777"/>
  </linearGradient>
  <linearGradient id="st-g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${accent}"/><stop offset="1" stop-color="${C.pink}"/></linearGradient>
  <linearGradient id="st-fade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${accent}" stop-opacity=".6"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></linearGradient>`;
  const body = `
  ${cubeSvg.svg}
  <g class="st-in">
    <text class="mono" x="${numX}" y="54" font-size="17" font-weight="700" fill="${deep}">${String(index).padStart(2, '0')}</text>
    <text class="mono" x="${numX + 26}" y="54" font-size="17" fill="${deep}" fill-opacity=".6">/</text>
    ${monoLine(textX, 55, [{ t: label, fill: 'url(#st-text)', weight: 800 }], { size })}
    <rect class="st-blink" x="${r1(textEnd + 10)}" y="31" width="14" height="28" rx="2" fill="#db2777"/>
  </g>
  <line x1="${textX}" y1="71" x2="${r1(textEnd)}" y2="71" stroke="${C.line}" stroke-width="3" stroke-linecap="round"/>
  <line class="st-under" x1="${textX}" y1="71" x2="${r1(textEnd)}" y2="71" stroke="url(#st-g)" stroke-width="3" stroke-linecap="round"/>
  <line x1="${r1(textEnd + 44)}" y1="45" x2="${W - 20}" y2="45" stroke="url(#st-fade)" stroke-width="1.5"/>
  <circle class="st-dot" cx="${r1(textEnd + 44)}" cy="45" r="3.5" fill="${accent}"/>`;
  return svgDoc({ w: W, h: H, title: text, desc: `Section: ${text}`, css, defs, body });
}

// ------------------------------------------------------------ projects ----

function motif(kind, [a, b]) {
  const cx = 194;
  if (kind === 'octagon') {
    // An octagonal cage turning in 3D: floor, two rails and eight posts.
    const R = 104;
    const levels = [52, 10, -34];
    const vertices = [];
    levels.forEach((y) => {
      for (let i = 0; i < 8; i++) {
        const ang = (TAU * i) / 8 + TAU / 16;
        vertices.push([R * Math.cos(ang), y, R * Math.sin(ang)]);
      }
    });
    const edges = [];
    for (let l = 0; l < 3; l++) for (let i = 0; i < 8; i++) edges.push([l * 8 + i, l * 8 + ((i + 1) % 8)]);
    for (let i = 0; i < 8; i++) edges.push([i, 16 + i]);
    const mesh = { vertices, edges };
    const opts = { cx, cy: 136, f: 560, count: 40, dur: 24, pose: (v, u) => rotX(rotY(v, TAU * u), 0.46) };
    const floor = solid(mesh, { ...opts, faces: [{ idx: [0, 1, 2, 3, 4, 5, 6, 7], fill: 'url(#m-floor)', opacity: 1 }] });
    const cage = wireframe(mesh, { ...opts, id: 'mc', stroke: (i) => (i >= 24 ? b : a), width: 2, dots: 3, dotFill: b, far: 0.22 });
    return {
      defs: `<radialGradient id="m-floor"><stop offset="0" stop-color="${a}" stop-opacity=".45"/><stop offset=".7" stop-color="${a}" stop-opacity=".12"/><stop offset="1" stop-color="${b}" stop-opacity=".3"/></radialGradient>
      <linearGradient id="m-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`,
      css: `${cage.css}.m-beam{animation:m-beam 3.2s ease-in-out infinite alternate}@keyframes m-beam{from{opacity:.4}to{opacity:1}}`,
      svg: `<path class="m-beam" d="M${cx - 18},24 L${cx + 18},24 L${cx + 120},250 L${cx - 120},250 Z" fill="url(#m-beam)"/>${floor}${cage.svg}`,
    };
  }
  // A 3D leaderboard: five solid bars on a platform, swinging gently. The
  // swing stays between 14° and 57°, so the draw order never changes.
  const heights = [118, 96, 78, 60, 44];
  const vertices = [];
  const box = (x0, z0, hx, hz, yb, yt) => {
    const i = vertices.length;
    vertices.push(
      [x0 - hx, yb, z0 + hz], [x0 + hx, yb, z0 + hz], [x0 + hx, yt, z0 + hz], [x0 - hx, yt, z0 + hz],
      [x0 - hx, yb, z0 - hz], [x0 + hx, yb, z0 - hz], [x0 + hx, yt, z0 - hz], [x0 - hx, yt, z0 - hz],
    );
    return i;
  };
  const faces = [];
  const addBox = (i, base, edge) => {
    faces.push({ idx: [i + 4, i + 0, i + 3, i + 7], fill: shade(base, -0.4), stroke: edge, width: 0.8 });
    faces.push({ idx: [i + 0, i + 1, i + 2, i + 3], fill: base, stroke: edge, width: 0.8 });
    faces.push({ idx: [i + 3, i + 2, i + 6, i + 7], fill: shade(base, 0.35), stroke: edge, width: 0.8 });
  };
  addBox(box(0, 0, 112, 30, 62, 52), '#1b2440', '#334166');
  const tops = [];
  for (let k = heights.length - 1; k >= 0; k--) {
    const x0 = (k - 2) * 40;
    const base = mix(b, a, k / (heights.length - 1));
    addBox(box(x0, 0, 13, 13, 52, 52 - heights[k]), base, shade(base, 0.5));
    tops[k] = vertices.length;
    vertices.push([x0, 52 - heights[k] - 26, 0]);
  }
  const mesh = { vertices, edges: [] };
  const opts = { cx, cy: 150, f: 620, count: 36, dur: 12, pose: (v, u) => rotX(rotY(v, 0.62 + 0.38 * Math.sin(TAU * u)), 0.42) };
  const bars = solid(mesh, { ...opts, faces });
  const starPath = Array.from({ length: 10 }, (_, k) => {
    const rr = k % 2 ? 5 : 12;
    const ang = ((k * 36 - 90) * Math.PI) / 180;
    return `${r1(rr * Math.cos(ang))},${r1(rr * Math.sin(ang))}`;
  }).join(' ');
  const ride = track('m-ride', mesh, tops[0], opts);
  return {
    defs: `<radialGradient id="m-spot"><stop offset="0" stop-color="${b}" stop-opacity=".35"/><stop offset="1" stop-color="${b}" stop-opacity="0"/></radialGradient>`,
    css: `${ride}.m-star{animation:m-star 2.4s ease-in-out infinite alternate}@keyframes m-star{from{transform:translateY(-4px)}to{transform:translateY(4px)}}
      .m-spin{animation:m-spin 5s linear infinite}@keyframes m-spin{to{transform:rotate(360deg)}}`,
    svg: `<ellipse cx="${cx}" cy="226" rx="150" ry="26" fill="url(#m-spot)"/>${bars}
      <g class="m-ride">
        <g class="m-star"><g class="m-spin"><circle r="16" fill="${C.amber}" fill-opacity=".18"/><polygon points="${starPath}" fill="${C.amber}"/></g></g></g>`,
  };
}

function project(p, index) {
  const W = 1200;
  const H = 300;
  const [a, b] = p.accent;
  const f = cardFrame('p', W, H, { r: 22, accentA: a, accentB: b, speed: 10 });
  const m = motif(p.motif, p.accent);
  const x0 = 404;

  const statusSize = 13;
  const statusW = monoWidth(p.status.label, statusSize) + 44;
  const sx = W - 30 - statusW;
  const statusDot = p.status.live
    ? `<circle class="p-live" cx="${r1(sx + 20)}" cy="61" r="5" fill="${C.green}"/><circle cx="${r1(sx + 20)}" cy="61" r="5" fill="${C.green}"/>`
    : `<rect x="${r1(sx + 14)}" y="59" width="12" height="9" rx="2" fill="${C.dim}"/><path d="M${r1(sx + 16.5)} 59v-3a3.5 3.5 0 0 1 7 0v3" fill="none" stroke="${C.dim}" stroke-width="1.8"/>`;
  const status = `<g class="p-in" style="animation-delay:.3s">
    <rect x="${r1(sx)}" y="44" width="${r1(statusW)}" height="34" rx="17" fill="${p.status.live ? C.green : C.dim}" fill-opacity=".1" stroke="${p.status.live ? C.green : C.dim}" stroke-opacity=".5"/>
    ${statusDot}
    <text class="mono" x="${r1(sx + 34)}" y="66" font-size="${statusSize}" font-weight="700" letter-spacing="1.5" fill="${p.status.live ? C.green : C.muted}">${esc(p.status.label)}</text>
  </g>`;

  let tx = x0;
  let tags = '';
  p.tags.forEach((tag, i) => {
    const w = monoWidth(tag, 14) + 24;
    tags += `<g class="p-in" style="animation-delay:${r1(0.55 + i * 0.07)}s">
      <rect x="${r1(tx)}" y="229" width="${r1(w)}" height="30" rx="8" fill="#000" fill-opacity=".35"/>
      <rect x="${r1(tx)}" y="226" width="${r1(w)}" height="30" rx="8" fill="${mix(C.panel, a, 0.1)}" stroke="${a}" stroke-opacity=".45"/>
      ${monoLine(r1(tx + 12), 246, [{ t: tag, fill: C.text }], { size: 14 })}
    </g>`;
    tx += w + 10;
  });

  const link = p.link
    ? `<text class="mono p-in" x="${W - 30}" y="247" text-anchor="end" font-size="15" fill="${b}" style="animation-delay:.9s">↗ ${esc(p.link.text)}</text>`
    : '';

  const defs = `${f.defs}${m.defs ?? ''}
  <linearGradient id="p-name" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="520" y2="0" spreadMethod="repeat">
    <stop offset="0" stop-color="${C.text}"/><stop offset=".4" stop-color="${C.text}"/><stop offset=".5" stop-color="${b}"/><stop offset=".6" stop-color="${C.text}"/><stop offset="1" stop-color="${C.text}"/>
    <animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="520 0" dur="5s" repeatCount="indefinite"/>
  </linearGradient>
  <radialGradient id="p-art" cx=".5" cy=".45" r=".7"><stop offset="0" stop-color="${a}" stop-opacity=".2"/><stop offset="1" stop-color="${a}" stop-opacity="0"/></radialGradient>
  <pattern id="p-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#fff" stroke-opacity=".04"/></pattern>
  <clipPath id="p-artclip"><rect x="24" y="24" width="340" height="252" rx="16"/></clipPath>`;
  const css = `${f.css}${m.css ?? ''}
  .p-in{animation:p-in .6s ease-out both}
  @keyframes p-in{from{opacity:0;transform:translateY(10px)}}
  .p-live{transform-box:fill-box;transform-origin:center;animation:p-live 1.6s ease-out infinite}
  @keyframes p-live{from{transform:scale(1);opacity:.8}to{transform:scale(3);opacity:0}}`;

  const extruded = (fill, dy) => `<text class="sans" x="${x0 + dy * 0.6}" y="${120 + dy}" font-size="46" font-weight="800" fill="${fill}">${esc(p.name)}</text>`;
  const body = `
  ${f.back}
  <rect x="24" y="24" width="340" height="252" rx="16" fill="${C.bg0}" fill-opacity=".7" stroke="${C.line}"/>
  <g clip-path="url(#p-artclip)">
    <rect x="24" y="24" width="340" height="252" fill="url(#p-grid)"/>
    <rect x="24" y="24" width="340" height="252" fill="url(#p-art)"/>
    ${m.svg}
  </g>
  <text class="mono p-in" x="${x0}" y="66" font-size="13" font-weight="700" letter-spacing="3" fill="${a}">${String(index + 1).padStart(2, '0')} · ${esc(p.kicker)}</text>
  <g class="p-in" style="animation-delay:.1s">
    ${[5, 4, 3, 2, 1].map((d) => extruded(mix(a, C.bg0, 0.35 + d * 0.1), d)).join('')}
    <text class="sans" x="${x0}" y="120" font-size="46" font-weight="800" fill="url(#p-name)">${esc(p.name)}</text>
  </g>
  ${status}
  ${p.desc.map((line, i) => `<text class="sans p-in" x="${x0}" y="${168 + i * 30}" font-size="21" fill="${C.muted}" style="animation-delay:${r1(0.25 + i * 0.1)}s">${esc(line)}</text>`).join('\n  ')}
  ${tags}
  ${link}
  ${f.border}`;

  return svgDoc({
    w: W,
    h: H,
    title: p.name,
    desc: `${p.name}: ${p.desc.join(' ')} Built with ${p.tags.join(', ')}.${p.link ? ` Live at ${p.link.text}.` : ''}`,
    css,
    defs,
    body,
  });
}

// ------------------------------------------------------------- connect ----

function connect() {
  const W = 1200;
  const H = 210;
  const f = cardFrame('c', W, H, { r: 22, accentA: C.blue, accentB: C.pink, speed: 9 });
  const handle = 'linkedin.com/in/rasul-shafili';
  const btnW = monoWidth(handle, 16) + 110;
  const bx = W - 44 - btnW;
  const by = 70;
  const g = globe('cg', {
    cx: r1(bx - 76),
    cy: 105,
    R: 56,
    period: 20,
    rings: [-60, -36, -12, 12, 36, 60].map(deg),
    density: 16,
    dot: 1.7,
    orbit: false,
    arcs: [
      [[deg(30), deg(-30)], [deg(-10), deg(60)]],
      [[deg(-30), deg(150)], [deg(20), deg(240)]],
    ],
  });
  const defs = `${f.defs}${g.defs}
  <linearGradient id="c-btn" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a66c2"/><stop offset="1" stop-color="${C.purple}"/></linearGradient>
  <linearGradient id="c-shine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <linearGradient id="c-rfill" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="${H}"><stop offset="0" stop-color="${C.bg1}"/><stop offset="1" stop-color="${C.bg0}"/></linearGradient>
  <linearGradient id="c-rstroke" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.blue}"/><stop offset="1" stop-color="${C.pink}"/></linearGradient>
  <clipPath id="c-btnclip"><rect x="${r1(bx)}" y="${by}" width="${r1(btnW)}" height="64" rx="32"/></clipPath>`;
  const css = `${f.css}
  ${g.css}
  .c-in{animation:c-in .7s ease-out both}
  @keyframes c-in{from{opacity:0;transform:translateY(10px)}}
  .c-shine{animation:c-shine 3.5s ease-in-out 1s infinite}
  @keyframes c-shine{0%{transform:translateX(-160px) skewX(-20deg)}50%,100%{transform:translateX(${r1(btnW + 160)}px) skewX(-20deg)}}
  .c-press{animation:c-press 4s ease-in-out 2s infinite}
  @keyframes c-press{0%,86%,100%{transform:translateY(0)}90%,94%{transform:translateY(5px)}}
  .c-halo{transform-box:fill-box;transform-origin:center;animation:c-halo 2.4s ease-out infinite}
  @keyframes c-halo{from{transform:scale(1);opacity:.55}to{transform:scale(1.12,1.5);opacity:0}}`;
  const body = `
  ${f.back}
  <g clip-path="url(#c-clip)">
    ${ridgelines({ W, yTop: 176, yBottom: 206, rows: 5, cols: 40, count: 12, dur: 9, amp: 10, fill: 'url(#c-rfill)', stroke: 'url(#c-rstroke)' })}
  </g>
  ${g.svg}
  <text class="sans c-in" x="48" y="92" font-size="40" font-weight="800" fill="${C.text}">Let's connect</text>
  <text class="sans c-in" x="48" y="130" font-size="20" fill="${C.muted}" style="animation-delay:.15s">Say hi on LinkedIn, or have a look around my repositories.</text>
  <g class="c-in" style="animation-delay:.3s">
    <rect class="c-halo" x="${r1(bx)}" y="${by}" width="${r1(btnW)}" height="64" rx="32" fill="none" stroke="#0a66c2" stroke-width="2"/>
    <rect x="${r1(bx)}" y="${by + 6}" width="${r1(btnW)}" height="64" rx="32" fill="#1e1b4b"/>
    <g class="c-press">
      <rect x="${r1(bx)}" y="${by}" width="${r1(btnW)}" height="64" rx="32" fill="url(#c-btn)"/>
      <g clip-path="url(#c-btnclip)"><rect class="c-shine" x="${r1(bx)}" y="${by}" width="90" height="64" fill="url(#c-shine)"/></g>
      <rect x="${r1(bx + 20)}" y="${by + 14}" width="36" height="36" rx="8" fill="#fff"/>
      <text class="sans" x="${r1(bx + 38)}" y="${by + 41}" text-anchor="middle" font-size="24" font-weight="800" fill="#0a66c2">in</text>
      ${monoLine(r1(bx + 72), by + 38, [{ t: handle, fill: '#fff', weight: 700 }], { size: 16 })}
    </g>
  </g>
  ${f.border}`;
  return svgDoc({ w: W, h: H, title: "Let's connect", desc: `Connect with ${profile.name} on LinkedIn: ${handle}`, css, defs, body });
}

// ---------------------------------------------------------------- main ----

write(`${OUT}hero.svg`, hero());
write(`${OUT}about.svg`, terminal());
write(`${OUT}stack.svg`, stack());
write(`${OUT}title-stack.svg`, sectionTitle(1, 'Tech stack', C.violet));
write(`${OUT}title-projects.svg`, sectionTitle(2, 'Projects', C.cyan));
write(`${OUT}title-activity.svg`, sectionTitle(3, 'GitHub activity', C.green));
profile.projects.forEach((p, i) => write(`${OUT}project-${p.id}.svg`, project(p, i)));
write(`${OUT}connect.svg`, connect());
