// Builds assets/generated/stats.svg from live GitHub data.
//
// In GitHub Actions it uses the GraphQL API with the workflow's GITHUB_TOKEN.
// Without a token (local preview) it reads the same numbers from the public
// REST API and the public contribution calendar page instead.

import { fileURLToPath } from 'node:url';
import { C, cardFrame, esc, monoLine, monoWidth, r1, svgDoc, write } from './lib.mjs';
import { profile } from './profile.mjs';
import { mix, shade } from './space.mjs';

const OUT = fileURLToPath(new URL('../assets/generated/stats.svg', import.meta.url));
const LOGIN = process.env.PROFILE_LOGIN || profile.login;
const TOKEN = process.env.GITHUB_TOKEN;
const SELF_REPO = (process.env.GITHUB_REPOSITORY || '').split('/')[1]?.toLowerCase();
const HEADERS = { 'User-Agent': `${LOGIN}-profile-cards`, Accept: 'application/vnd.github+json' };

// GitHub's linguist colours, used when the REST fallback gives no colour.
const LANG_COLORS = {
  Python: '#3572A5', JavaScript: '#f1e05a', TypeScript: '#3178c6', HTML: '#e34c26', CSS: '#663399',
  'C#': '#178600', 'C++': '#f34b7d', C: '#555555', Shell: '#89e051', Luau: '#00A2FF', SQL: '#e38c00',
  Java: '#b07219', Go: '#00ADD8', Rust: '#dea584', Dockerfile: '#384d54', SCSS: '#c6538c', Ruby: '#701516',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

async function getJSON(url, init = {}) {
  const res = await fetch(url, { ...init, headers: { ...HEADERS, ...init.headers } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

const isSelf = (name) => name.toLowerCase() === LOGIN.toLowerCase() || name.toLowerCase() === SELF_REPO;

async function viaGraphQL() {
  const query = `query($login: String!) {
    user(login: $login) {
      repositories(ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, first: 100) {
        totalCount
        nodes { name languages(first: 10, orderBy: {field: SIZE, direction: DESC}) { edges { size node { name color } } } }
      }
      contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } } }
    }
  }`;
  const json = await getJSON('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { login: LOGIN } }),
  });
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  const u = json.data.user;
  const languages = {};
  for (const repo of u.repositories.nodes) {
    if (isSelf(repo.name)) continue;
    for (const { size, node } of repo.languages.edges) {
      languages[node.name] ??= { bytes: 0, color: node.color };
      languages[node.name].bytes += size;
    }
  }
  const cal = u.contributionsCollection.contributionCalendar;
  return {
    repos: u.repositories.totalCount,
    total: cal.totalContributions,
    days: cal.weeks.flatMap((w) => w.contributionDays).map((d) => ({ date: d.date, count: d.contributionCount })),
    languages,
  };
}

async function viaPublicPages() {
  const repos = (await getJSON(`https://api.github.com/users/${LOGIN}/repos?per_page=100&type=owner`)).filter((r) => !r.fork);
  const languages = {};
  for (const repo of repos) {
    if (isSelf(repo.name)) continue;
    const langs = await getJSON(repo.languages_url);
    for (const [name, bytes] of Object.entries(langs)) {
      languages[name] ??= { bytes: 0, color: null };
      languages[name].bytes += bytes;
    }
  }
  const res = await fetch(`https://github.com/users/${LOGIN}/contributions`, { headers: HEADERS });
  if (!res.ok) throw new Error(`${res.status} for the contribution calendar`);
  const html = await res.text();
  const counts = {};
  for (const m of html.matchAll(/<tool-tip[^>]*for="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const n = m[2].match(/^(\d[\d,]*) contribution/);
    counts[m[1]] = n ? Number(n[1].replace(/,/g, '')) : 0;
  }
  const days = [];
  for (const m of html.matchAll(/<td[^>]*data-date="(\d{4}-\d{2}-\d{2})"[^>]*id="([^"]+)"/g)) {
    days.push({ date: m[1], count: counts[m[2]] ?? 0 });
  }
  if (!days.length) throw new Error('contribution calendar markup not recognised');
  days.sort((a, b) => a.date.localeCompare(b.date));
  return { repos: repos.length, total: days.reduce((s, d) => s + d.count, 0), days, languages };
}

function streaks(days) {
  let longest = 0;
  let run = 0;
  for (const d of days) {
    run = d.count > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return longest;
}

// Dark linguist colours (CSS, C) vanish on the dark card; lift them toward white.
function readable(hex) {
  const n = parseInt((hex || '#8b949e').slice(1), 16);
  let [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (lum < 0.45) {
    const k = (0.45 - lum) / 0.45;
    [r, g, b] = [r, g, b].map((v) => Math.round(v + (255 - v) * k * 0.7));
  }
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// The contribution calendar as a 3D skyline: one prism per day, drawn in an
// oblique projection so the weeks run left to right and the weekdays recede.
// Prisms rise from the ground in a wave when the card loads.
function skyline(days, { ox, oy, pitch = 12.4, w = 10.2, dx = -4.6, dy = 6.2, depth = 0.82, maxH = 84 }) {
  const first = new Date(`${days[0].date}T00:00:00Z`).getUTCDay();
  const max = Math.max(1, ...days.map((d) => d.count));
  const cells = days.map((d, i) => ({ ...d, col: Math.floor((i + first) / 7), row: (i + first) % 7 }));
  const palette = ['#155e75', '#22d3ee', '#a78bfa', '#f472b6'];
  const colorAt = (t) => {
    const x = t * (palette.length - 1);
    const i = Math.min(palette.length - 2, Math.floor(x));
    return mix(palette[i], palette[i + 1], x - i);
  };
  const pt = (p) => `${r1(p[0])},${r1(p[1])}`;
  const poly = (ps) => `M${ps.map(pt).join('L')}Z`;
  const up = (p, h) => [p[0], p[1] - h];

  let ground = '';
  let prisms = '';
  let peak = null;
  // Far weekdays first, and left to right within a weekday, so nearer prisms cover farther ones.
  const order = [...cells].sort((a, b) => a.row - b.row || a.col - b.col);
  for (const c of order) {
    const p0 = [ox + c.col * pitch + c.row * dx, oy + c.row * dy];
    const p1 = [p0[0] + w, p0[1]];
    const p2 = [p1[0] + dx * depth, p1[1] + dy * depth];
    const p3 = [p0[0] + dx * depth, p0[1] + dy * depth];
    if (!c.count) {
      ground += `<path d="${poly([p0, p1, p2, p3])}"/>`;
      continue;
    }
    const t = Math.sqrt(c.count / max);
    const h = 5 + t * (maxH - 5);
    const col = colorAt(t);
    const faces = [
      [(k) => [p2, p1, up(p1, k), up(p2, k)], shade(col, -0.38)],
      [(k) => [p3, p2, up(p2, k), up(p3, k)], col],
      [(k) => [up(p0, k), up(p1, k), up(p2, k), up(p3, k)], shade(col, 0.3)],
    ];
    const wait = 0.5 + c.col * 0.035 + c.row * 0.02;
    const dur = wait + 0.9;
    for (const [shape, fill] of faces) {
      const flat = poly(shape(0));
      const tall = poly(shape(h));
      prisms += `<path d="${tall}" fill="${fill}"><animate attributeName="d" dur="${r1(dur)}s" fill="freeze" calcMode="spline" keyTimes="0;${(wait / dur).toFixed(3)};1" keySplines="0 0 1 1;.2 .8 .2 1" values="${flat};${flat};${tall}"/></path>`;
    }
    if (!peak || c.count > peak.count) peak = { ...c, top: up([(p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2], h), at: dur };
  }

  let months = '';
  let lastMonth = -1;
  for (const c of cells) {
    const m = Number(c.date.slice(5, 7)) - 1;
    if (c.row === 0 && m !== lastMonth) {
      if (lastMonth !== -1) {
        months += `<text class="mono" x="${r1(ox + c.col * pitch + 7 * dx)}" y="${r1(oy + 7 * dy + 18)}" font-size="11" fill="${C.dim}">${MONTHS[m]}</text>`;
      }
      lastMonth = m;
    }
  }
  const cols = cells.at(-1).col + 1;
  const beam = poly([[ox, oy - maxH], [ox + 26, oy - maxH], [ox + 26 + 7 * dx, oy + 7 * dy], [ox + 7 * dx, oy + 7 * dy]]);
  return { ground, prisms, months, peak, beam, travel: r1(cols * pitch - 26) };
}

// A tilted 3D donut of the top languages. The slices are dashes along an
// ellipse; stacking darker copies underneath gives the ring its thickness,
// and moving every dash along the path spins the donut.
function donut(langs, { cx, cy, rx = 84, ry = 38, width = 24, layers = 10, period = 28 }) {
  const ring = `M${cx + rx},${cy} A${rx},${ry} 0 1 1 ${cx - rx},${cy} A${rx},${ry} 0 1 1 ${cx + rx},${cy}`;
  let css = '';
  let cum = 0;
  const slices = langs.map((l, i) => {
    const len = Math.max(0.4, l.pct - 0.6);
    const s = { ...l, i, dash: `${r1(len)} ${r1(100 - len)}`, offset: r1(-cum) };
    css += `@keyframes gd${i}{from{stroke-dashoffset:${s.offset}}to{stroke-dashoffset:${r1(-cum - 100)}}}.gd${i}{animation:gd${i} ${period}s linear infinite}\n`;
    cum += l.pct;
    return s;
  });
  let svg = `<ellipse cx="${cx}" cy="${cy + layers + 16}" rx="${rx + 26}" ry="${ry + 8}" fill="url(#g-floor)"/>`;
  for (let L = layers; L >= 0; L--) {
    const top = L === 0;
    svg += `<g transform="translate(0 ${L})">${slices
      .map((s) => `<path class="gd${s.i}" d="${ring}" pathLength="100" fill="none" stroke="${top ? s.color : shade(s.color, -0.35 - (L / layers) * 0.3)}" stroke-width="${width}" stroke-dasharray="${s.dash}" stroke-dashoffset="${s.offset}"/>`)
      .join('')}</g>`;
  }
  svg += `<ellipse cx="${cx}" cy="${cy}" rx="${rx + width / 2}" ry="${ry + width / 2}" fill="none" stroke="#fff" stroke-opacity=".12"/>`;
  svg += `<ellipse cx="${cx}" cy="${cy}" rx="${rx - width / 2}" ry="${ry - width / 2}" fill="none" stroke="#fff" stroke-opacity=".08"/>`;
  return { css, svg };
}

function render(data) {
  const W = 1200;
  const H = 450;
  const f = cardFrame('g', W, H, { r: 22, accentA: C.green, accentB: C.cyan, speed: 11 });
  const today = new Date().toISOString().slice(0, 10);
  const active = data.days.filter((d) => d.count > 0).length;
  const tiles = [
    ['CONTRIBUTIONS', data.total, 'last 12 months', C.cyan],
    ['ACTIVE DAYS', active, 'days with commits, PRs or issues', C.violet],
    ['LONGEST STREAK', streaks(data.days), 'days in a row', C.pink],
    ['PUBLIC REPOS', data.repos, 'not counting forks', C.green],
  ];

  // Tiles with a count-up: each intermediate number is visible for one short
  // window, and the final number is simply hidden until its moment arrives,
  // so it still shows when animations are disabled.
  const tileW = (W - 80 - 3 * 16) / 4;
  let tileEls = '';
  tiles.forEach(([label, value, sub, c], i) => {
    const x = 40 + i * (tileW + 16);
    const start = 0.4 + i * 0.15;
    const frames = 18;
    const step = 1.4 / frames;
    let counter = '';
    for (let k = 1; k < frames; k++) {
      const v = Math.round(value * (1 - Math.pow(1 - k / frames, 3)));
      counter += `<text class="mono g-f" x="${r1(x + 22)}" y="138" font-size="42" font-weight="800" fill="${c}" style="animation-delay:${r1(start + (k - 1) * step)}s;animation-duration:${r1(step + 0.01)}s">${v.toLocaleString('en-US')}</text>`;
    }
    counter += `<text class="mono g-last" x="${r1(x + 22)}" y="138" font-size="42" font-weight="800" fill="${c}" style="animation-duration:${r1(start + (frames - 1) * step)}s">${value.toLocaleString('en-US')}</text>`;
    tileEls += `<g class="g-in" style="animation-delay:${r1(0.1 + i * 0.1)}s">
      <rect x="${r1(x)}" y="83" width="${r1(tileW)}" height="112" rx="14" fill="${shade(mix(C.panel, c, 0.3), -0.4)}"/>
      <rect x="${r1(x)}" y="78" width="${r1(tileW)}" height="112" rx="14" fill="${C.panel}" stroke="${C.line}"/>
      <rect class="g-bar" x="${r1(x + 22)}" y="78" width="${r1(tileW - 44)}" height="3" rx="1.5" fill="${c}" style="animation-delay:${r1(start)}s"/>
      <text class="mono" x="${r1(x + 22)}" y="104" font-size="12" font-weight="700" letter-spacing="2" fill="${C.muted}">${label}</text>
      ${counter}
      <text class="sans" x="${r1(x + 22)}" y="170" font-size="14" fill="${C.dim}">${esc(sub)}</text>
    </g>`;
  });

  const sky = skyline(data.days, { ox: 74, oy: 344 });
  const pk = sky.peak;
  let peakEl = '';
  if (pk) {
    const label = `peak ${pk.count} · ${MONTHS[Number(pk.date.slice(5, 7)) - 1]} ${Number(pk.date.slice(8, 10))}`;
    const lw = monoWidth(label, 12) + 16;
    const lx = Math.min(Math.max(pk.top[0] - lw / 2, 40), 730 - lw);
    const ly = Math.max(pk.top[1] - 40, 240);
    peakEl = `<g class="g-in" style="animation-delay:${r1(pk.at)}s">
      <line x1="${r1(pk.top[0])}" y1="${r1(pk.top[1] - 3)}" x2="${r1(pk.top[0])}" y2="${r1(ly + 22)}" stroke="${C.text}" stroke-opacity=".5"/>
      <rect x="${r1(lx)}" y="${r1(ly)}" width="${r1(lw)}" height="22" rx="6" fill="${C.panel2}" stroke="${C.line}"/>
      ${monoLine(r1(lx + 8), r1(ly + 15), [{ t: label, fill: C.text }], { size: 12 })}
    </g>`;
  }

  const langs = Object.entries(data.languages).sort((a, b) => b[1].bytes - a[1].bytes);
  const totalBytes = langs.reduce((s, [, l]) => s + l.bytes, 0) || 1;
  const top = langs.slice(0, 5).map(([name, l]) => ({ name, pct: (l.bytes / totalBytes) * 100, color: readable(l.color || LANG_COLORS[name]) }));
  const rest = 100 - top.reduce((s, l) => s + l.pct, 0);
  if (rest >= 0.5) top.push({ name: 'Other', pct: rest, color: '#64748b' });
  const dn = donut(top, { cx: 872, cy: 316 });
  let legend = '';
  top.forEach((l, i) => {
    const y = 268 + i * 24;
    legend += `<g class="g-in" style="animation-delay:${r1(0.9 + i * 0.1)}s">
      <rect x="1000" y="${y - 10}" width="10" height="10" rx="3" fill="${l.color}"/>
      ${monoLine(1018, y, [{ t: l.name, fill: C.text }], { size: 13 })}
      <text class="mono" x="1160" y="${y}" text-anchor="end" font-size="13" fill="${C.muted}">${l.pct.toFixed(1)}%</text>
    </g>`;
  });

  const css = `${f.css}
  ${dn.css}
  .g-in{animation:g-in .6s ease-out both}
  @keyframes g-in{from{opacity:0;transform:translateY(10px)}}
  .g-f{opacity:0;animation:g-show linear both;animation-fill-mode:none}
  @keyframes g-show{from,to{opacity:1}}
  .g-last{animation:g-hide linear}
  @keyframes g-hide{from,to{opacity:0}}
  .g-bar{transform-box:fill-box;transform-origin:0 50%;animation:g-grow 1.2s cubic-bezier(.2,.8,.2,1) both}
  @keyframes g-grow{from{transform:scaleX(0)}}
  .g-beam{opacity:0;animation:g-beam 7s ease-in-out 3s infinite}
  @keyframes g-beam{0%{transform:translateX(0);opacity:0}8%{opacity:1}60%{transform:translateX(${sky.travel}px);opacity:1}64%,100%{transform:translateX(${sky.travel}px);opacity:0}}
  .g-donut{animation:g-in .9s ease-out .6s both}
  .g-live{transform-box:fill-box;transform-origin:center;animation:g-live 1.8s ease-out infinite}
  @keyframes g-live{from{transform:scale(1);opacity:.8}to{transform:scale(2.8);opacity:0}}`;

  const defs = `${f.defs}
  <linearGradient id="g-beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <radialGradient id="g-floor"><stop offset="0" stop-color="${C.cyan}" stop-opacity=".22"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/></radialGradient>
  <radialGradient id="g-sky" cx=".5" cy=".7" r=".6"><stop offset="0" stop-color="${C.violet}" stop-opacity=".16"/><stop offset="1" stop-color="${C.violet}" stop-opacity="0"/></radialGradient>`;

  const updated = `updated ${today}`;
  const dotX = r1(W - 48 - monoWidth(updated, 13) - 14);
  const body = `
  ${f.back}
  <text class="mono" x="40" y="50" font-size="13" font-weight="700" letter-spacing="3" fill="${C.muted}">LIVE DATA · GITHUB API</text>
  <circle class="g-live" cx="${dotX}" cy="46" r="4" fill="${C.green}"/>
  <circle cx="${dotX}" cy="46" r="4" fill="${C.green}"/>
  <text class="mono" x="${W - 40}" y="50" text-anchor="end" font-size="13" fill="${C.dim}">${updated}</text>
  ${tileEls}
  <text class="mono" x="40" y="232" font-size="12" font-weight="700" letter-spacing="2" fill="${C.muted}">CONTRIBUTION SKYLINE · LAST 12 MONTHS</text>
  <ellipse cx="390" cy="370" rx="360" ry="60" fill="url(#g-sky)"/>
  <g fill="${C.panel2}" stroke="${C.line}" stroke-width=".6">${sky.ground}</g>
  ${sky.prisms}
  <g clip-path="url(#g-clip)"><path class="g-beam" d="${sky.beam}" fill="url(#g-beam)"/></g>
  ${sky.months}
  ${peakEl}
  <text class="mono" x="770" y="232" font-size="12" font-weight="700" letter-spacing="2" fill="${C.muted}">TOP LANGUAGES · PUBLIC REPOS</text>
  <g class="g-donut">${dn.svg}</g>
  ${legend}
  ${f.border}`;

  return svgDoc({
    w: W,
    h: H,
    title: 'GitHub activity',
    desc: `${tiles.map(([l, v]) => `${l.toLowerCase()}: ${v}`).join(', ')}. Top languages: ${top.map((l) => `${l.name} ${l.pct.toFixed(1)}%`).join(', ')}. Updated ${today}.`,
    css,
    defs,
    body,
  });
}

const data = TOKEN ? await viaGraphQL() : await viaPublicPages();
console.log(`contributions ${data.total}, days ${data.days.length}, repos ${data.repos}, languages ${Object.keys(data.languages).join(', ')}`);
write(OUT, render(data));
