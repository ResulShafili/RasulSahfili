// Builds the hand-designed cards (hero, terminal, stack, section titles,
// projects, connect) from scripts/profile.mjs into assets/.

import { fileURLToPath } from 'node:url';
import { C, MONO_ADV, cardFrame, discreteAnimate, esc, monoLine, monoWidth, r1, rng, svgDoc, write } from './lib.mjs';
import { profile } from './profile.mjs';

const OUT = fileURLToPath(new URL('../assets/', import.meta.url));
const color = (name) => C[name] ?? name;

// ---------------------------------------------------------------- hero ----

function hero() {
  const W = 1200;
  const H = 440;
  const rand = rng(7);
  const f = cardFrame('h', W, H, { r: 26, speed: 10 });

  // Stars that twinkle out of phase with each other.
  let stars = '';
  for (let i = 0; i < 70; i++) {
    const x = r1(rand() * W);
    const y = r1(rand() * 360);
    const r = r1(0.5 + rand() * 1.3);
    const dur = r1(2 + rand() * 4);
    const delay = r1(-rand() * 6);
    stars += `<circle class="h-star" cx="${x}" cy="${y}" r="${r}" style="animation-duration:${dur}s;animation-delay:${delay}s"/>`;
  }

  // Two small neural networks in the side margins, with signals running along the edges.
  const network = (x0, x1, seed) => {
    const nr = rng(seed);
    const nodes = Array.from({ length: 9 }, () => [r1(x0 + nr() * (x1 - x0)), r1(70 + nr() * 250)]);
    const edges = new Set();
    nodes.forEach((a, i) => {
      nodes
        .map((b, j) => [j, Math.hypot(a[0] - b[0], a[1] - b[1])])
        .filter(([j]) => j !== i)
        .sort((p, q) => p[1] - q[1])
        .slice(0, 2)
        .forEach(([j]) => edges.add([Math.min(i, j), Math.max(i, j)].join('-')));
    });
    let g = '';
    for (const e of edges) {
      const [i, j] = e.split('-').map(Number);
      const [ax, ay] = nodes[i];
      const [bx, by] = nodes[j];
      const len = r1(Math.hypot(ax - bx, ay - by));
      g += `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${C.violet}" stroke-opacity=".22" stroke-width="1"/>`;
      g += `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${nr() > 0.5 ? C.cyan : C.pink}" stroke-width="2" stroke-linecap="round"
        stroke-dasharray="10 ${r1(len + 20)}" stroke-dashoffset="10"><animate attributeName="stroke-dashoffset" values="10;${r1(-len - 10)}" dur="${r1(1.8 + nr() * 1.8)}s" begin="${r1(nr() * 3)}s" repeatCount="indefinite"/></line>`;
    }
    nodes.forEach(([x, y], i) => {
      const c = i % 3 === 0 ? C.pink : i % 2 ? C.cyan : C.violet;
      g += `<circle class="h-halo" cx="${x}" cy="${y}" r="7" fill="${c}" style="animation-delay:${r1(-nr() * 3)}s"/>`;
      g += `<circle cx="${x}" cy="${y}" r="2.8" fill="${c}"/>`;
    });
    return g;
  };

  // The perspective floor: rays from a vanishing point plus lines that fall toward the viewer.
  const horizon = 374;
  const vpx = 600;
  const vpy = 250;
  let floor = '';
  for (let k = -9; k <= 9; k++) {
    const bx = vpx + k * 150;
    const t = (horizon - vpy) / (H - vpy);
    const hx = r1(vpx + (bx - vpx) * t);
    floor += `<line x1="${hx}" y1="${horizon}" x2="${bx}" y2="${H}" stroke="${C.violet}" stroke-opacity=".35"/>`;
  }
  for (let k = 0; k < 5; k++) {
    floor += `<line class="h-fall" x1="0" y1="${horizon}" x2="${W}" y2="${horizon}" stroke="${C.cyan}" stroke-opacity=".45" style="animation-delay:-${k}s"/>`;
  }

  // Rotating typewriter under the name.
  const size = 24;
  const adv = size * MONO_ADV;
  const lineY = 266;
  const typeS = 0.055;
  const holdS = 2.2;
  const delS = 0.022;
  const gapS = 0.5;
  let t = 0;
  const slots = profile.roles.map((text) => {
    const n = Array.from(text).length;
    const start = t + gapS;
    const typed = start + n * typeS;
    const held = typed + holdS;
    const end = held + n * delS;
    t = end;
    return { text, n, start, typed, held, end, x0: r1(600 - (n * adv) / 2) };
  });
  const total = t;
  let typing = '';
  let clips = '';
  const cursorPts = [[0, slots[0].x0]];
  slots.forEach((s, i) => {
    const pts = [[0, 0]];
    for (let k = 1; k <= s.n; k++) {
      const tk = s.start + k * typeS;
      pts.push([tk, r1(k * adv + 2)]);
      cursorPts.push([tk, r1(s.x0 + k * adv + 2)]);
    }
    for (let k = s.n - 1; k >= 0; k--) {
      const tk = s.held + (s.n - k) * delS;
      pts.push([tk, k === 0 ? 0 : r1(k * adv + 2)]);
      cursorPts.push([tk, r1(s.x0 + k * adv + 2)]);
    }
    if (slots[i + 1]) cursorPts.push([s.end + 0.001, slots[i + 1].x0]);
    clips += `<clipPath id="h-type${i}"><rect x="${r1(s.x0 - 2)}" y="${lineY - 28}" height="38" width="0">${discreteAnimate('width', pts, total)}</rect></clipPath>`;
    const [head, ...rest] = s.text.split(' · ');
    const segs = [{ t: head, fill: C.text, weight: 700 }];
    if (rest.length) segs.push({ t: ` · ${rest.join(' · ')}`, fill: C.muted });
    typing += `<g clip-path="url(#h-type${i})">${monoLine(s.x0, lineY, segs, { size })}</g>`;
  });
  cursorPts.sort((a, b) => a[0] - b[0]);
  const cursor = `<rect class="h-cursor" x="${slots[0].x0}" y="${lineY - 21}" width="13" height="27" rx="2" fill="${C.cyan}">${discreteAnimate('x', cursorPts, total)}</rect>`;

  // Info chips with tiny line icons.
  const icons = [
    (x, y) => `<path d="M${x} ${y + 7}c-4-5-6-8-6-11a6 6 0 0 1 12 0c0 3-2 6-6 11z" fill="none" stroke="${C.cyan}" stroke-width="1.6"/><circle cx="${x}" cy="${y - 4}" r="2" fill="${C.cyan}"/>`,
    (x, y) => `<path d="M${x - 8} ${y - 2}l8-5 8 5-8 5z" fill="none" stroke="${C.violet}" stroke-width="1.6" stroke-linejoin="round"/><path d="M${x - 4} ${y + 1}v4c2 2 6 2 8 0v-4" fill="none" stroke="${C.violet}" stroke-width="1.6"/>`,
    (x, y) => `<rect x="${x - 8}" y="${y - 7}" width="16" height="11" rx="3" fill="none" stroke="${C.pink}" stroke-width="1.6"/><path d="M${x - 3} ${y + 4}l-2 4 5-4" fill="none" stroke="${C.pink}" stroke-width="1.6" stroke-linejoin="round"/>`,
  ];
  const chipSize = 15;
  const chipW = profile.chips.map((c) => monoWidth(c, chipSize) + 52);
  const gap = 16;
  let cx = 600 - (chipW.reduce((a, b) => a + b, 0) + gap * (chipW.length - 1)) / 2;
  let chips = '';
  profile.chips.forEach((c, i) => {
    const w = chipW[i];
    chips += `<g class="h-rise" style="animation-delay:${r1(2.4 + i * 0.15)}s">
      <rect x="${r1(cx)}" y="304" width="${r1(w)}" height="38" rx="19" fill="${C.panel}" fill-opacity=".85" stroke="${C.line}"/>
      ${icons[i % icons.length](r1(cx + 24), 323)}
      ${monoLine(r1(cx + 42), 328, [{ t: c, fill: C.text }], { size: chipSize })}
    </g>`;
    cx += w + gap;
  });

  // Equalizer in the top-right corner.
  let eq = '';
  for (let i = 0; i < 6; i++) {
    eq += `<rect class="h-eq" x="${1112 + i * 9}" y="30" width="5" height="22" rx="2" fill="${i % 2 ? C.pink : C.cyan}" style="animation-delay:-${r1(i * 0.17)}s;animation-duration:${r1(0.8 + (i % 3) * 0.25)}s"/>`;
  }

  const ellipse = (rx, ry) => `M${600 - rx},195 a${rx},${ry} 0 1,0 ${2 * rx},0 a${rx},${ry} 0 1,0 ${-2 * rx},0`;

  const name = profile.name.toUpperCase();
  const nameAttrs = `x="600" y="205" text-anchor="middle" font-size="84" font-weight="800" letter-spacing="5"`;

  const defs = `${f.defs}
  <radialGradient id="h-a1"><stop offset="0" stop-color="${C.cyan}" stop-opacity=".30"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/></radialGradient>
  <radialGradient id="h-a2"><stop offset="0" stop-color="${C.purple}" stop-opacity=".34"/><stop offset="1" stop-color="${C.purple}" stop-opacity="0"/></radialGradient>
  <radialGradient id="h-a3"><stop offset="0" stop-color="${C.pink}" stop-opacity=".22"/><stop offset="1" stop-color="${C.pink}" stop-opacity="0"/></radialGradient>
  <linearGradient id="h-name" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="720" y2="0" spreadMethod="repeat">
    <stop offset="0" stop-color="${C.cyan}"/><stop offset=".33" stop-color="${C.violet}"/><stop offset=".66" stop-color="${C.pink}"/><stop offset="1" stop-color="${C.cyan}"/>
    <animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="720 0" dur="6s" repeatCount="indefinite"/>
  </linearGradient>
  <linearGradient id="h-orbit" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${C.cyan}" stop-opacity="0"/><stop offset=".5" stop-color="${C.violet}" stop-opacity=".7"/><stop offset="1" stop-color="${C.pink}" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="h-shoot" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="110" y2="0">
    <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/>
  </linearGradient>
  <linearGradient id="h-floorFade" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="1"/>
  </linearGradient>
  <mask id="h-floorMask"><rect x="0" y="${horizon}" width="${W}" height="${H - horizon}" fill="url(#h-floorFade)"/></mask>
  <filter id="h-blur" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="16"/></filter>
  <clipPath id="h-slice1"><rect x="0" y="150" width="${W}" height="14"/><rect x="0" y="178" width="${W}" height="9"/></clipPath>
  <clipPath id="h-slice2"><rect x="0" y="162" width="${W}" height="10"/><rect x="0" y="190" width="${W}" height="16"/></clipPath>
  ${clips}`;

  const css = `${f.css}
  .h-star{fill:#fff;animation:h-tw 3s ease-in-out infinite}
  @keyframes h-tw{0%,100%{opacity:.15}50%{opacity:.9}}
  .h-a{animation:h-drift 18s ease-in-out infinite alternate}
  .h-a2{animation-duration:23s;animation-direction:alternate-reverse}
  .h-a3{animation-duration:15s}
  @keyframes h-drift{0%{transform:translate(0,0)}50%{transform:translate(140px,40px)}100%{transform:translate(-120px,-20px)}}
  .h-halo{transform-box:fill-box;transform-origin:center;animation:h-halo 3s ease-out infinite}
  @keyframes h-halo{from{transform:scale(.4);opacity:.55}to{transform:scale(2.2);opacity:0}}
  .h-fall{animation:h-fall 5s cubic-bezier(.55,0,1,.45) infinite}
  @keyframes h-fall{0%{transform:translateY(0);opacity:0}20%{opacity:1}100%{transform:translateY(${H - horizon}px);opacity:1}}
  .h-kicker{animation:h-rise .7s ease-out .2s both}
  .h-name{fill:url(#h-name);stroke:url(#h-name);stroke-width:1.4;stroke-dasharray:420;stroke-dashoffset:0;fill-opacity:1;animation:h-draw 2.4s ease-out both}
  @keyframes h-draw{0%{stroke-dashoffset:420;fill-opacity:0}55%{fill-opacity:0}100%{stroke-dashoffset:0;fill-opacity:1}}
  .h-glow{fill:url(#h-name);filter:url(#h-blur);opacity:.5;animation:h-glowin 2.4s ease-out both,h-pulse 4s ease-in-out 2.4s infinite}
  @keyframes h-glowin{0%,50%{opacity:0}100%{opacity:.5}}
  @keyframes h-pulse{0%,100%{opacity:.35}50%{opacity:.75}}
  .h-gl{opacity:0;animation:h-glitch 7s steps(1) 3s infinite}
  .h-gl2{animation-delay:3.05s}
  @keyframes h-glitch{0%{opacity:0;transform:translate(0,0)}88%{opacity:.85;transform:translate(-6px,1px)}90%{opacity:.85;transform:translate(5px,-2px)}92%{opacity:.7;transform:translate(-3px,2px)}94%{opacity:0;transform:translate(0,0)}}
  .h-rise{animation:h-rise .7s cubic-bezier(.2,.9,.3,1.2) both}
  @keyframes h-rise{from{opacity:0;transform:translateY(14px)}}
  .h-cursor{animation:h-blink 1s steps(1) infinite}
  @keyframes h-blink{50%{opacity:0}}
  .h-shootg{opacity:0;animation:h-shoot 9s ease-in 4s infinite}
  @keyframes h-shoot{0%{opacity:0;transform:translate(1030px,34px) rotate(160deg)}2%{opacity:1}12%{opacity:0;transform:translate(700px,154px) rotate(160deg)}100%{opacity:0;transform:translate(700px,154px) rotate(160deg)}}
  .h-eq{transform-box:fill-box;transform-origin:50% 100%;animation:h-eq 1s ease-in-out infinite alternate}
  @keyframes h-eq{from{transform:scaleY(.2)}to{transform:scaleY(1)}}
  .h-orbit1{transform-origin:600px 195px;animation:h-spin 40s linear infinite}
  .h-orbit2{transform-origin:600px 195px;animation:h-spin 55s linear infinite reverse}
  @keyframes h-spin{to{transform:rotate(360deg)}}`;

  const body = `
  ${f.back}
  <g clip-path="url(#h-clip)">
    <circle class="h-a" cx="180" cy="60" r="380" fill="url(#h-a1)"/>
    <circle class="h-a h-a2" cx="1020" cy="90" r="400" fill="url(#h-a2)"/>
    <circle class="h-a h-a3" cx="600" cy="460" r="360" fill="url(#h-a3)"/>
    ${stars}
    <g class="h-shootg"><line x1="0" y1="0" x2="110" y2="0" stroke="url(#h-shoot)" stroke-width="2" stroke-linecap="round"/></g>
    <g mask="url(#h-floorMask)">${floor}</g>
    <line x1="0" y1="${horizon}" x2="${W}" y2="${horizon}" stroke="${C.violet}" stroke-opacity=".5"/>
    ${network(30, 210, 11)}
    ${network(990, 1170, 23)}
    <g class="h-orbit1"><path d="${ellipse(500, 108)}" fill="none" stroke="url(#h-orbit)" stroke-width="1.2" stroke-dasharray="2 9"/>
      <circle r="4" fill="${C.cyan}"><animateMotion dur="14s" repeatCount="indefinite" path="${ellipse(500, 108)}"/></circle></g>
    <g class="h-orbit2"><path d="${ellipse(450, 86)}" fill="none" stroke="url(#h-orbit)" stroke-width="1" stroke-dasharray="1 7"/>
      <circle r="3" fill="${C.pink}"><animateMotion dur="11s" repeatCount="indefinite" path="${ellipse(450, 86)}"/></circle></g>
  </g>

  <text class="mono" x="44" y="46" font-size="14" fill="${C.dim}" letter-spacing="1">github.com/${esc(profile.login)}</text>
  ${eq}

  <text class="mono h-kicker" x="600" y="118" text-anchor="middle" font-size="17" fill="${C.cyan}" letter-spacing="6">// HELLO, I'M</text>
  <text class="sans h-glow" ${nameAttrs}>${esc(name)}</text>
  <text class="sans h-gl" ${nameAttrs} fill="${C.cyan}" clip-path="url(#h-slice1)">${esc(name)}</text>
  <text class="sans h-gl h-gl2" ${nameAttrs} fill="${C.pink}" clip-path="url(#h-slice2)">${esc(name)}</text>
  <text class="sans h-name" ${nameAttrs}>${esc(name)}</text>

  ${typing}
  ${cursor}
  ${chips}
  ${f.border}`;

  return svgDoc({
    w: W,
    h: H,
    title: `${profile.name}`,
    desc: `${profile.name}: ${profile.roles.join('; ')}.`,
    css,
    defs,
    body,
  });
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
  const cursor = [];
  const endOfTimeline = [];

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
    endOfTimeline.push(typedAt);
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

  // Final prompt with the cursor parked after it.
  lines += `<g class="t-in" style="animation-delay:${r1(t)}s">${monoLine(x0, y, prompt, { size })}</g>`;
  cursor.push([t, cmdX, y]);
  const H = y + 40;
  const total = t + 0.01;
  const cx = cursor.map(([tt, x]) => [tt, r1(x)]);
  const cy = cursor.map(([tt, , yy]) => [tt, yy - 17]);
  const cursorEl = `<rect class="t-cursor" x="${r1(cmdX)}" y="${y - 17}" width="11" height="22" rx="1.5" fill="${C.cyan}">
    ${discreteAnimate('x', cx, total, { repeat: false })}${discreteAnimate('y', cy, total, { repeat: false })}</rect>`;

  // A small status block in the free space on the right.
  const status = [
    ['STATUS', 'learning', C.green],
    ['FOCUS', 'AI · Data · Web', C.violet],
    ['TIMEZONE', 'UTC+4', C.cyan],
  ];
  let side = '';
  status.forEach(([k, v, c], i) => {
    const sy = 110 + i * 46;
    side += `<g class="t-in" style="animation-delay:${r1(t + 0.2 + i * 0.12)}s">
      <text class="mono" x="968" y="${sy}" font-size="12" fill="${C.dim}" letter-spacing="2">${k}</text>
      <circle class="t-pulse" cx="974" cy="${sy + 18}" r="4" fill="${c}" style="animation-delay:-${i * 0.6}s"/>
      <text class="mono" x="986" y="${sy + 23}" font-size="15" fill="${C.text}">${esc(v)}</text>
    </g>`;
  });

  const f = cardFrame('t', W, H, { r: 20, accentA: C.green, accentB: C.cyan, speed: 12 });
  const defs = `${f.defs}${clips}`;
  const css = `${f.css}
  .t-in{animation:t-in .3s ease-out both}
  @keyframes t-in{from{opacity:0;transform:translateY(6px)}}
  .t-cursor{animation:t-blink 1s steps(1) infinite}
  @keyframes t-blink{50%{opacity:0}}
  .t-pulse{transform-box:fill-box;transform-origin:center;animation:t-pulse 1.8s ease-in-out infinite}
  @keyframes t-pulse{50%{transform:scale(.55);opacity:.5}}`;

  const body = `
  ${f.back}
  <g clip-path="url(#t-clip)">
    <rect width="${W}" height="54" fill="${C.panel2}" fill-opacity=".9"/>
    <line x1="0" y1="54" x2="${W}" y2="54" stroke="${C.line}"/>
  </g>
  <circle cx="34" cy="27" r="7" fill="#ff5f57"/><circle cx="58" cy="27" r="7" fill="#febc2e"/><circle cx="82" cy="27" r="7" fill="#28c840"/>
  <text class="mono" x="600" y="32" text-anchor="middle" font-size="14" fill="${C.dim}">rasul@github: ~ — zsh</text>
  <line x1="944" y1="80" x2="944" y2="${H - 30}" stroke="${C.line}" stroke-dasharray="3 5"/>
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
  const rowH = 74;
  const top = 58;
  const H = top + profile.stack.length * rowH - 6;
  const f = cardFrame('s', W, H, { r: 20, accentA: C.violet, accentB: C.cyan, speed: 11 });
  const rand = rng(3);
  const size = 17;
  let rows = '';
  let n = 0;
  profile.stack.forEach((row, ri) => {
    const cy = top + ri * rowH;
    rows += `<g class="s-in" style="animation-delay:${r1(ri * 0.12)}s">
      <text class="mono" x="44" y="${cy + 5}" font-size="13" fill="${C.dim}" letter-spacing="3">0${ri + 1}</text>
      <text class="mono" x="78" y="${cy + 5}" font-size="14" fill="${C.muted}" letter-spacing="3" font-weight="700">${esc(row.label)}</text>
      <line x1="190" y1="${cy}" x2="222" y2="${cy}" stroke="${C.line}" stroke-width="1.5"/>
      <circle cx="222" cy="${cy}" r="2.5" fill="${C.violet}"/>
    </g>`;
    let x = 240;
    row.items.forEach(([label, c]) => {
      const w = monoWidth(label, size) + 58;
      const d = r1(0.25 + n * 0.05);
      rows += `<g class="s-chip" style="animation-delay:${d}s">
        <rect x="${r1(x)}" y="${cy - 22}" width="${r1(w)}" height="44" rx="22" fill="${C.panel}" stroke="${C.line}"/>
        <circle cx="${r1(x + 24)}" cy="${cy}" r="12" fill="${c}" fill-opacity=".14"/>
        <circle class="s-ring" cx="${r1(x + 24)}" cy="${cy}" r="6" fill="none" stroke="${c}" stroke-width="1.5" style="animation-delay:${r1(-rand() * 3)}s"/>
        <circle cx="${r1(x + 24)}" cy="${cy}" r="5" fill="${c}"/>
        ${monoLine(r1(x + 42), cy + 6, [{ t: label, fill: C.text }], { size })}
      </g>`;
      x += w + 12;
      n++;
    });
  });

  const defs = `${f.defs}
  <linearGradient id="s-shine" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".09"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </linearGradient>`;
  const css = `${f.css}
  .s-in{animation:s-in .5s ease-out both}
  @keyframes s-in{from{opacity:0;transform:translateX(-12px)}}
  .s-chip{transform-box:fill-box;transform-origin:center;animation:s-pop .55s cubic-bezier(.2,1.5,.4,1) both}
  @keyframes s-pop{from{opacity:0;transform:scale(.6) translateY(10px)}}
  .s-ring{transform-box:fill-box;transform-origin:center;animation:s-ring 2.6s ease-out infinite}
  @keyframes s-ring{from{transform:scale(1);opacity:.9}to{transform:scale(2.8);opacity:0}}
  .s-shine{animation:s-shine 6s ease-in-out 1.5s infinite}
  @keyframes s-shine{0%{transform:translateX(-400px) skewX(-20deg)}40%,100%{transform:translateX(1500px) skewX(-20deg)}}`;

  const body = `
  ${f.back}
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
  const numX = 20;
  const textX = numX + 70;
  const textEnd = textX + monoWidth(label, size);
  const css = `
  .st-in{animation:st-in .6s ease-out both}
  @keyframes st-in{from{opacity:0;transform:translateX(-16px)}}
  .st-under{stroke-dasharray:60 400;animation:st-under 3.2s ease-in-out infinite}
  @keyframes st-under{from{stroke-dashoffset:60}to{stroke-dashoffset:-400}}
  .st-dot{animation:st-dot 4s ease-in-out infinite}
  @keyframes st-dot{0%{transform:translateX(0);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateX(${r1(W - textEnd - 70)}px);opacity:0}}
  .st-blink{animation:st-blink 1s steps(1) infinite}
  @keyframes st-blink{50%{opacity:0}}`;
  // Titles sit directly on GitHub's page background, which is white or dark
  // depending on the viewer, so the text uses mid-tone colours readable on both.
  const deep = { [C.violet]: '#7c3aed', [C.cyan]: '#0891b2', [C.green]: '#059669' }[accent] ?? accent;
  const defs = `
  <linearGradient id="st-text" gradientUnits="userSpaceOnUse" x1="${textX}" y1="0" x2="${r1(textEnd)}" y2="0">
    <stop offset="0" stop-color="${deep}"/><stop offset="1" stop-color="#db2777"/>
  </linearGradient>
  <linearGradient id="st-g" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${accent}"/><stop offset="1" stop-color="${C.pink}"/>
  </linearGradient>
  <linearGradient id="st-fade" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${accent}" stop-opacity=".6"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/>
  </linearGradient>`;
  const body = `
  <g class="st-in">
    <rect x="${numX}" y="22" width="52" height="40" rx="10" fill="${deep}" fill-opacity=".12" stroke="${deep}" stroke-opacity=".6"/>
    <text class="mono" x="${numX + 26}" y="48" text-anchor="middle" font-size="16" font-weight="700" fill="${deep}">${String(index).padStart(2, '0')}</text>
    ${monoLine(textX, 54, [{ t: label, fill: 'url(#st-text)', weight: 800 }], { size, attrs: 'letter-spacing="0"' })}
    <rect class="st-blink" x="${r1(textEnd + 10)}" y="30" width="14" height="28" rx="2" fill="#db2777"/>
  </g>
  <line x1="${textX}" y1="70" x2="${r1(textEnd)}" y2="70" stroke="${C.line}" stroke-width="3" stroke-linecap="round"/>
  <line class="st-under" x1="${textX}" y1="70" x2="${r1(textEnd)}" y2="70" stroke="url(#st-g)" stroke-width="3" stroke-linecap="round"/>
  <line x1="${r1(textEnd + 44)}" y1="44" x2="${W - 20}" y2="44" stroke="url(#st-fade)" stroke-width="1.5"/>
  <circle class="st-dot" cx="${r1(textEnd + 44)}" cy="44" r="3.5" fill="${accent}"/>`;
  return svgDoc({ w: W, h: H, title: text, desc: `Section: ${text}`, css, defs, body });
}

// ------------------------------------------------------------ projects ----

function motif(kind, [a, b]) {
  const cx = 194;
  const cy = 150;
  if (kind === 'octagon') {
    const oct = (r, rot = 22.5) =>
      Array.from({ length: 8 }, (_, i) => {
        const ang = ((i * 45 + rot) * Math.PI) / 180;
        return `${r1(cx + r * Math.cos(ang))},${r1(cy + r * Math.sin(ang))}`;
      }).join(' ');
    const ecg = `M44,${cy} H120 l10,-10 l8,10 H150 l8,-52 l12,92 l10,-58 l6,18 H236 l10,-12 l10,12 H344`;
    return {
      css: `
      .m-rot{transform-origin:${cx}px ${cy}px;animation:m-spin 30s linear infinite}
      .m-rot2{transform-origin:${cx}px ${cy}px;animation:m-spin 20s linear infinite reverse}
      @keyframes m-spin{to{transform:rotate(360deg)}}
      .m-wave{transform-origin:${cx}px ${cy}px;animation:m-wave 2.6s ease-out infinite}
      @keyframes m-wave{from{transform:scale(.2);opacity:.7}to{transform:scale(1.25);opacity:0}}
      .m-ecg{stroke-dasharray:180 420;animation:m-ecg 2.2s linear infinite}
      @keyframes m-ecg{from{stroke-dashoffset:180}to{stroke-dashoffset:-420}}`,
      svg: `
      <circle class="m-wave" cx="${cx}" cy="${cy}" r="90" fill="none" stroke="${a}" stroke-width="2"/>
      <circle class="m-wave" cx="${cx}" cy="${cy}" r="90" fill="none" stroke="${b}" stroke-width="1.5" style="animation-delay:-1.3s"/>
      <g class="m-rot"><polygon points="${oct(96)}" fill="none" stroke="${a}" stroke-width="2.5" stroke-opacity=".85"/>
        ${oct(96).split(' ').map((p) => `<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="4" fill="${b}"/>`).join('')}</g>
      <g class="m-rot2"><polygon points="${oct(70, 0)}" fill="${a}" fill-opacity=".06" stroke="${b}" stroke-width="1.5" stroke-dasharray="6 6"/></g>
      <path d="${ecg}" fill="none" stroke="${C.line}" stroke-width="2"/>
      <path class="m-ecg" d="${ecg}" fill="none" stroke="${a}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
    };
  }
  if (kind === 'leaderboard') {
    const widths = [196, 168, 140, 114, 88];
    let bars = '';
    widths.forEach((w, i) => {
      const y = 92 + i * 34;
      bars += `<circle cx="70" cy="${y}" r="12" fill="${i === 0 ? b : C.panel2}" stroke="${i === 0 ? b : C.line}"/>
        <text class="mono" x="70" y="${y + 5}" text-anchor="middle" font-size="13" font-weight="700" fill="${i === 0 ? C.bg0 : C.muted}">${i + 1}</text>
        <rect x="94" y="${y - 9}" width="206" height="18" rx="9" fill="${C.panel2}"/>
        <rect class="m-bar" x="94" y="${y - 9}" width="${w}" height="18" rx="9" fill="url(#m-bar)" style="animation-delay:${r1(i * 0.18)}s"/>`;
    });
    let stars = '';
    for (let i = 0; i < 5; i++) {
      const sx = 124 + i * 36;
      const pts = Array.from({ length: 10 }, (_, k) => {
        const rr = k % 2 ? 5 : 12;
        const ang = ((k * 36 - 90) * Math.PI) / 180;
        return `${r1(sx + rr * Math.cos(ang))},${r1(52 + rr * Math.sin(ang))}`;
      }).join(' ');
      stars += `<polygon points="${pts}" fill="${C.line}"/><polygon class="m-star" points="${pts}" fill="${C.amber}" style="animation-delay:${r1(i * 0.22)}s"/>`;
    }
    return {
      defs: `<linearGradient id="m-bar" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`,
      css: `
      .m-bar{transform-box:fill-box;transform-origin:0 50%;animation:m-bar 5s cubic-bezier(.3,.9,.3,1) infinite}
      @keyframes m-bar{0%{transform:scaleX(.08)}30%,85%{transform:scaleX(1)}100%{transform:scaleX(.08)}}
      .m-star{transform-box:fill-box;transform-origin:center;animation:m-star 5s ease-out infinite}
      @keyframes m-star{0%{opacity:0;transform:scale(.3)}12%,85%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(.3)}}`,
      svg: `${stars}${bars}`,
    };
  }
  // radar
  const R = 108;
  let wedges = '';
  for (let k = 0; k < 10; k++) {
    const a0 = (-(k + 1) * 5 * Math.PI) / 180;
    const a1 = (-k * 5 * Math.PI) / 180;
    wedges += `<path d="M${cx},${cy} L${r1(cx + R * Math.cos(a0))},${r1(cy + R * Math.sin(a0))} A${R},${R} 0 0 1 ${r1(cx + R * Math.cos(a1))},${r1(cy + R * Math.sin(a1))} Z" fill="${a}" fill-opacity="${r1(0.42 - k * 0.04)}"/>`;
  }
  const blips = [
    [40, 62, C.red],
    [118, 84, C.amber],
    [205, 48, C.red],
    [262, 92, C.amber],
    [320, 70, C.red],
  ];
  const period = 4;
  let blipEls = '';
  blips.forEach(([deg, dist, c]) => {
    const rad = (deg * Math.PI) / 180;
    const bx = r1(cx + dist * Math.cos(rad));
    const by = r1(cy + dist * Math.sin(rad));
    const delay = r1((deg / 360) * period);
    blipEls += `<circle class="m-blipring" cx="${bx}" cy="${by}" r="5" fill="none" stroke="${c}" stroke-width="1.5" style="animation-delay:${delay}s"/>
      <circle class="m-blip" cx="${bx}" cy="${by}" r="4.5" fill="${c}" style="animation-delay:${delay}s"/>`;
  });
  return {
    css: `
    .m-sweep{transform-origin:${cx}px ${cy}px;animation:m-spin ${period}s linear infinite}
    @keyframes m-spin{to{transform:rotate(360deg)}}
    .m-blip{opacity:.15;animation:m-blip ${period}s ease-out infinite}
    @keyframes m-blip{0%{opacity:1}70%,100%{opacity:.15}}
    .m-blipring{opacity:0;transform-box:fill-box;transform-origin:center;animation:m-ring ${period}s ease-out infinite}
    @keyframes m-ring{0%{opacity:.9;transform:scale(1)}30%,100%{opacity:0;transform:scale(3.5)}}`,
    svg: `
    ${[36, 72, R].map((r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${a}" stroke-opacity=".25"/>`).join('')}
    <line x1="${cx - R - 10}" y1="${cy}" x2="${cx + R + 10}" y2="${cy}" stroke="${a}" stroke-opacity=".18"/>
    <line x1="${cx}" y1="${cy - R - 10}" x2="${cx}" y2="${cy + R + 10}" stroke="${a}" stroke-opacity=".18"/>
    <g class="m-sweep">${wedges}<line x1="${cx}" y1="${cy}" x2="${cx + R}" y2="${cy}" stroke="${b}" stroke-width="2.5" stroke-linecap="round"/></g>
    ${blipEls}
    <circle cx="${cx}" cy="${cy}" r="5" fill="${b}"/>`,
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
      <rect x="${r1(tx)}" y="226" width="${r1(w)}" height="30" rx="8" fill="${a}" fill-opacity=".08" stroke="${a}" stroke-opacity=".45"/>
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
  <radialGradient id="p-art" cx=".5" cy=".5" r=".7"><stop offset="0" stop-color="${a}" stop-opacity=".16"/><stop offset="1" stop-color="${a}" stop-opacity="0"/></radialGradient>
  <clipPath id="p-artclip"><rect x="24" y="24" width="340" height="252" rx="16"/></clipPath>`;
  const css = `${f.css}${m.css}
  .p-in{animation:p-in .6s ease-out both}
  @keyframes p-in{from{opacity:0;transform:translateY(10px)}}
  .p-live{transform-box:fill-box;transform-origin:center;animation:p-live 1.6s ease-out infinite}
  @keyframes p-live{from{transform:scale(1);opacity:.8}to{transform:scale(3);opacity:0}}`;

  const body = `
  ${f.back}
  <rect x="24" y="24" width="340" height="252" rx="16" fill="${C.bg0}" fill-opacity=".6" stroke="${C.line}"/>
  <rect x="24" y="24" width="340" height="252" rx="16" fill="url(#p-art)"/>
  <g clip-path="url(#p-artclip)">${m.svg}</g>
  <text class="mono p-in" x="${x0}" y="66" font-size="13" font-weight="700" letter-spacing="3" fill="${a}">${String(index + 1).padStart(2, '0')} · ${esc(p.kicker)}</text>
  <text class="sans p-in" x="${x0}" y="120" font-size="46" font-weight="800" fill="url(#p-name)" style="animation-delay:.1s">${esc(p.name)}</text>
  ${status}
  ${p.desc.map((line, i) => `<text class="sans p-in" x="${x0}" y="${164 + i * 30}" font-size="21" fill="${C.muted}" style="animation-delay:${r1(0.25 + i * 0.1)}s">${esc(line)}</text>`).join('\n  ')}
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
  const H = 200;
  const f = cardFrame('c', W, H, { r: 22, accentA: C.blue, accentB: C.pink, speed: 9 });
  const wave = (amp, y, period) => {
    let d = `M0,${y}`;
    for (let x = 0; x <= W * 2; x += period / 2) {
      d += ` q${period / 4},${-amp * ((x / (period / 2)) % 2 ? -1 : 1)} ${period / 2},0`;
    }
    return d;
  };
  const handle = 'linkedin.com/in/rasul-shafili';
  const btnW = monoWidth(handle, 16) + 110;
  const bx = W - 44 - btnW;
  const defs = `${f.defs}
  <linearGradient id="c-btn" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a66c2"/><stop offset="1" stop-color="${C.purple}"/></linearGradient>
  <linearGradient id="c-shine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <clipPath id="c-btnclip"><rect x="${r1(bx)}" y="66" width="${r1(btnW)}" height="68" rx="34"/></clipPath>`;
  const css = `${f.css}
  .c-w{animation:c-w 12s linear infinite}
  .c-w2{animation-duration:18s;animation-direction:reverse}
  @keyframes c-w{to{transform:translateX(-${W}px)}}
  .c-in{animation:c-in .7s ease-out both}
  @keyframes c-in{from{opacity:0;transform:translateY(10px)}}
  .c-shine{animation:c-shine 3.5s ease-in-out 1s infinite}
  @keyframes c-shine{0%{transform:translateX(-160px) skewX(-20deg)}50%,100%{transform:translateX(${r1(btnW + 160)}px) skewX(-20deg)}}
  .c-halo{transform-box:fill-box;transform-origin:center;animation:c-halo 2.4s ease-out infinite}
  @keyframes c-halo{from{transform:scale(1);opacity:.55}to{transform:scale(1.12,1.5);opacity:0}}`;
  const body = `
  ${f.back}
  <g clip-path="url(#c-clip)" fill="none">
    <path class="c-w" d="${wave(10, 168, 200)}" stroke="${C.cyan}" stroke-opacity=".25" stroke-width="1.5"/>
    <path class="c-w c-w2" d="${wave(14, 176, 300)}" stroke="${C.pink}" stroke-opacity=".2" stroke-width="1.5"/>
    <path class="c-w" d="${wave(6, 186, 150)}" stroke="${C.violet}" stroke-opacity=".25" stroke-width="1.5" style="animation-duration:9s"/>
  </g>
  <text class="sans c-in" x="48" y="90" font-size="40" font-weight="800" fill="${C.text}">Let's connect</text>
  <text class="sans c-in" x="48" y="128" font-size="20" fill="${C.muted}" style="animation-delay:.15s">Say hi on LinkedIn, or have a look around my repositories.</text>
  <g class="c-in" style="animation-delay:.3s">
    <rect class="c-halo" x="${r1(bx)}" y="66" width="${r1(btnW)}" height="68" rx="34" fill="none" stroke="#0a66c2" stroke-width="2"/>
    <rect x="${r1(bx)}" y="66" width="${r1(btnW)}" height="68" rx="34" fill="url(#c-btn)"/>
    <g clip-path="url(#c-btnclip)"><rect class="c-shine" x="${r1(bx)}" y="66" width="90" height="68" fill="url(#c-shine)"/></g>
    <rect x="${r1(bx + 20)}" y="82" width="36" height="36" rx="8" fill="#fff"/>
    <text class="sans" x="${r1(bx + 38)}" y="109" text-anchor="middle" font-size="24" font-weight="800" fill="#0a66c2">in</text>
    ${monoLine(r1(bx + 72), 106, [{ t: handle, fill: '#fff', weight: 700 }], { size: 16 })}
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
