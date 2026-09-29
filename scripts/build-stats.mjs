// Builds assets/generated/stats.svg from live GitHub data.
//
// In GitHub Actions it uses the GraphQL API with the workflow's GITHUB_TOKEN.
// Without a token (local preview) it reads the same numbers from the public
// REST API and the public contribution calendar page instead.

import { fileURLToPath } from 'node:url';
import { C, cardFrame, esc, monoLine, monoWidth, r1, svgDoc, write } from './lib.mjs';
import { profile } from './profile.mjs';

const OUT = fileURLToPath(new URL('../assets/generated/stats.svg', import.meta.url));
const LOGIN = process.env.PROFILE_LOGIN || profile.login;
const TOKEN = process.env.GITHUB_TOKEN;
const SELF_REPO = (process.env.GITHUB_REPOSITORY || '').split('/')[1]?.toLowerCase();
const HEADERS = { 'User-Agent': `${LOGIN}-profile-cards`, Accept: 'application/vnd.github+json' };

// GitHub's linguist colours, used when the REST fallback gives no colour.
const LANG_COLORS = {
  Python: '#3572A5', JavaScript: '#f1e05a', TypeScript: '#3178c6', HTML: '#e34c26', CSS: '#663399',
  'C#': '#178600', 'C++': '#f34b7d', C: '#555555', Shell: '#89e051', Luau: '#00A2FF', SQL: '#e38c00',
  Java: '#b07219', Go: '#00ADD8', Rust: '#dea584', Dockerfile: '#384d54', SCSS: '#c6538c',
};

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

function weekly(days, weeks = 26) {
  const sums = [];
  for (let i = days.length; i > 0 && sums.length < weeks; i -= 7) {
    sums.unshift(days.slice(Math.max(0, i - 7), i).reduce((s, d) => s + d.count, 0));
  }
  return sums;
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

// A smooth path through the points (Catmull-Rom converted to cubic Béziers).
function smooth(pts) {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1 = [r1(p1[0] + (p2[0] - p0[0]) / 6), r1(p1[1] + (p2[1] - p0[1]) / 6)];
    const c2 = [r1(p2[0] - (p3[0] - p1[0]) / 6), r1(p2[1] - (p3[1] - p1[1]) / 6)];
    d += ` C${c1} ${c2} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function render(data) {
  const W = 1200;
  const H = 440;
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
  let css = '';
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
      <rect x="${r1(x)}" y="78" width="${r1(tileW)}" height="112" rx="14" fill="${C.panel}" fill-opacity=".8" stroke="${C.line}"/>
      <rect class="g-bar" x="${r1(x + 22)}" y="78" width="${r1(tileW - 44)}" height="3" rx="1.5" fill="${c}" style="animation-delay:${r1(start)}s"/>
      <text class="mono" x="${r1(x + 22)}" y="104" font-size="12" font-weight="700" letter-spacing="2" fill="${C.muted}">${label}</text>
      ${counter}
      <text class="sans" x="${r1(x + 22)}" y="170" font-size="14" fill="${C.dim}">${esc(sub)}</text>
    </g>`;
  });

  // Weekly contributions line.
  const weeks = weekly(data.days);
  const cx0 = 60;
  const cx1 = 700;
  const cy0 = 268;
  const cy1 = 392;
  const max = Math.max(1, ...weeks);
  const pts = weeks.map((v, i) => [r1(cx0 + (i * (cx1 - cx0)) / (weeks.length - 1)), r1(cy1 - (v / max) * (cy1 - cy0))]);
  const line = smooth(pts);
  const area = `${line} L${cx1},${cy1} L${cx0},${cy1} Z`;
  const approxLen = Math.ceil(pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0) * 1.15);
  const peakI = weeks.indexOf(max);
  const [px, py] = pts[peakI];
  const peakLabel = `peak ${max}/week`;
  const peakW = monoWidth(peakLabel, 12) + 16;
  const peakX = Math.min(Math.max(px - peakW / 2, cx0), cx1 - peakW);
  let grid = '';
  for (let k = 0; k <= 3; k++) {
    const gy = r1(cy0 + (k * (cy1 - cy0)) / 3);
    grid += `<line x1="${cx0}" y1="${gy}" x2="${cx1}" y2="${gy}" stroke="${C.line}" stroke-dasharray="2 6"/>`;
  }

  // Languages.
  const langs = Object.entries(data.languages).sort((a, b) => b[1].bytes - a[1].bytes);
  const totalBytes = langs.reduce((s, [, l]) => s + l.bytes, 0) || 1;
  const top = langs.slice(0, 5).map(([name, l]) => ({ name, pct: (l.bytes / totalBytes) * 100, color: readable(l.color || LANG_COLORS[name]) }));
  const lx0 = 760;
  const lx1 = 1160;
  let langEls = '';
  top.forEach((l, i) => {
    const y = 272 + i * 26;
    langEls += `<g class="g-in" style="animation-delay:${r1(0.9 + i * 0.1)}s">
      <circle cx="${lx0 + 5}" cy="${y - 5}" r="5" fill="${l.color}"/>
      ${monoLine(lx0 + 18, y, [{ t: l.name, fill: C.text }], { size: 14 })}
      <text class="mono" x="${lx1}" y="${y}" text-anchor="end" font-size="14" fill="${C.muted}">${l.pct.toFixed(1)}%</text>
      <rect x="${lx0 + 150}" y="${y - 9}" width="${lx1 - lx0 - 210}" height="6" rx="3" fill="${C.panel2}"/>
      <rect class="g-lang" x="${lx0 + 150}" y="${y - 9}" width="${r1(Math.max(4, ((lx1 - lx0 - 210) * l.pct) / top[0].pct))}" height="6" rx="3" fill="${l.color}" style="animation-delay:${r1(1 + i * 0.12)}s"/>
    </g>`;
  });

  css = `${f.css}
  .g-in{animation:g-in .6s ease-out both}
  @keyframes g-in{from{opacity:0;transform:translateY(10px)}}
  .g-f{opacity:0;animation:g-show linear both;animation-fill-mode:none}
  @keyframes g-show{from,to{opacity:1}}
  .g-last{animation:g-hide linear}
  @keyframes g-hide{from,to{opacity:0}}
  .g-bar{transform-box:fill-box;transform-origin:0 50%;animation:g-grow 1.2s cubic-bezier(.2,.8,.2,1) both}
  .g-lang{transform-box:fill-box;transform-origin:0 50%;animation:g-grow 1.1s cubic-bezier(.2,.8,.2,1) both}
  @keyframes g-grow{from{transform:scaleX(0)}}
  .g-line{stroke-dasharray:${approxLen};stroke-dashoffset:0;animation:g-draw 2.2s ease-out .6s both}
  @keyframes g-draw{from{stroke-dashoffset:${approxLen}}}
  .g-area{animation:g-fade 1.2s ease-out 1.6s both}
  @keyframes g-fade{from{opacity:0}}
  .g-live{transform-box:fill-box;transform-origin:center;animation:g-live 1.8s ease-out infinite}
  @keyframes g-live{from{transform:scale(1);opacity:.8}to{transform:scale(2.8);opacity:0}}`;

  const defs = `${f.defs}
  <linearGradient id="g-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.cyan}" stop-opacity=".35"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/></linearGradient>
  <linearGradient id="g-stroke" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.green}"/><stop offset=".5" stop-color="${C.cyan}"/><stop offset="1" stop-color="${C.violet}"/></linearGradient>
  <radialGradient id="g-dot"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="${C.cyan}"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/></radialGradient>`;

  const updated = `updated ${today}`;
  const body = `
  ${f.back}
  <text class="mono" x="40" y="50" font-size="13" font-weight="700" letter-spacing="3" fill="${C.muted}">LIVE DATA · GITHUB API</text>
  <circle class="g-live" cx="${r1(W - 48 - monoWidth(updated, 13) - 14)}" cy="46" r="4" fill="${C.green}"/>
  <circle cx="${r1(W - 48 - monoWidth(updated, 13) - 14)}" cy="46" r="4" fill="${C.green}"/>
  <text class="mono" x="${W - 40}" y="50" text-anchor="end" font-size="13" fill="${C.dim}">${updated}</text>
  ${tileEls}
  <text class="mono" x="${cx0}" y="238" font-size="12" font-weight="700" letter-spacing="2" fill="${C.muted}">CONTRIBUTIONS PER WEEK · LAST ${weeks.length} WEEKS</text>
  ${grid}
  <path class="g-area" d="${area}" fill="url(#g-area)"/>
  <path class="g-line" d="${line}" fill="none" stroke="url(#g-stroke)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <circle r="10" fill="url(#g-dot)"><animateMotion dur="7s" repeatCount="indefinite" path="${line}"/></circle>
  <g class="g-in" style="animation-delay:2.4s">
    <line x1="${px}" y1="${py}" x2="${px}" y2="${cy1}" stroke="${C.cyan}" stroke-opacity=".4" stroke-dasharray="3 4"/>
    <circle cx="${px}" cy="${py}" r="4.5" fill="${C.bg0}" stroke="${C.cyan}" stroke-width="2"/>
    <rect x="${r1(peakX)}" y="${r1(Math.max(py - 34, 244))}" width="${r1(peakW)}" height="22" rx="6" fill="${C.panel2}" stroke="${C.line}"/>
    ${monoLine(r1(peakX + 8), r1(Math.max(py - 34, 244) + 15), [{ t: peakLabel, fill: C.text }], { size: 12 })}
  </g>
  <text class="mono" x="${lx0}" y="238" font-size="12" font-weight="700" letter-spacing="2" fill="${C.muted}">TOP LANGUAGES · PUBLIC REPOS</text>
  ${langEls}
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
