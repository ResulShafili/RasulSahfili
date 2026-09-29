// Everything the profile says lives here. Edit this file, push, and the
// workflow rebuilds the cards.

export const profile = {
  login: 'ResulShafili',
  name: 'Rasul Shafili',
  linkedin: 'https://www.linkedin.com/in/rasul-shafili',

  // Lines the hero types and deletes in a loop.
  roles: [
    'AI training · evaluating multimodal model responses',
    'Data analysis · SQL, Python and clean datasets',
    'Full-stack web · React, Node.js, PostgreSQL',
    'Computer Engineering student · Karabakh University',
  ],

  chips: ['Azerbaijan', 'Karabakh University · 2024–2028', 'Azerbaijani · Turkish · English'],

  // The terminal card: each command is typed, then its output is printed.
  terminal: [
    {
      cmd: 'whoami',
      out: [[{ t: 'Rasul Shafili', fill: 'text', weight: 700 }, { t: ' — Computer Engineering student at Karabakh University', fill: 'muted' }]],
    },
    {
      cmd: 'cat focus.md',
      out: [
        [{ t: '◆ ', fill: 'cyan' }, { t: 'AI training  ', fill: 'text' }, { t: 'evaluating and ranking model responses on image and video', fill: 'muted' }],
        [{ t: '◆ ', fill: 'violet' }, { t: 'Data         ', fill: 'text' }, { t: 'cleaning and structuring data, analysis with SQL and Python', fill: 'muted' }],
        [{ t: '◆ ', fill: 'pink' }, { t: 'Web          ', fill: 'text' }, { t: 'full-stack apps with React, Node.js, Express and PostgreSQL', fill: 'muted' }],
      ],
    },
    {
      cmd: 'cat languages.txt',
      out: [[{ t: 'Azerbaijani · Turkish · English', fill: 'muted' }]],
    },
    {
      cmd: 'echo $NOW',
      out: [[{ t: 'building data projects', fill: 'green' }]],
    },
  ],

  stack: [
    {
      label: 'LANGUAGES',
      items: [['Python', '#4b8bbe'], ['C#', '#a179dc'], ['C++', '#659ad2'], ['JavaScript', '#f7df1e'], ['SQL', '#f29111'], ['Luau', '#00a2ff']],
    },
    {
      label: 'WEB',
      items: [['React', '#61dafb'], ['Tailwind CSS', '#38bdf8'], ['Vite', '#bd34fe'], ['Node.js', '#5fa04e'], ['Express', '#e6edf7'], ['HTML & CSS', '#e34f26']],
    },
    {
      label: 'DATA',
      items: [['PostgreSQL', '#6d9eeb'], ['Prisma', '#8b9cf7'], ['Data analysis', '#34d399']],
    },
    {
      label: 'TOOLS',
      items: [['Git', '#f05032'], ['GitHub', '#e6edf7'], ['Vercel', '#e6edf7']],
    },
  ],

  projects: [
    {
      id: 'fightbase',
      kicker: 'FULL-STACK PLATFORM',
      name: 'FightBase',
      status: { label: 'SOURCE PRIVATE', live: false },
      desc: ['Verified MMA fighter profiles, fight records, rankings,', 'challenges and real-time notifications.'],
      tags: ['React', 'Vite', 'Express', 'Prisma', 'PostgreSQL', 'Socket.IO'],
      link: null,
      motif: 'octagon',
      accent: ['#f87171', '#fbbf24'],
    },
    {
      id: 'edurate',
      kicker: 'REVIEW PLATFORM',
      name: 'EduRate',
      status: { label: 'LIVE', live: true },
      desc: ['Education review platform with a leaderboard and an admin', 'moderation panel, in Azerbaijani, English and Russian.'],
      tags: ['Next.js', 'i18n AZ · EN · RU', 'Vercel'],
      link: { href: 'https://edu-rate-nu.vercel.app', text: 'edu-rate-nu.vercel.app' },
      motif: 'leaderboard',
      accent: ['#a78bfa', '#22d3ee'],
    },
    {
      id: 'almajaz',
      kicker: 'EMERGENCY RESPONSE',
      name: 'Al-Majaz',
      status: { label: 'LIVE', live: true },
      desc: ['Flood and emergency response dashboard for the', 'Al-Majaz district of Sharjah, UAE, on a live map.'],
      tags: ['React', 'TypeScript', 'Mapbox GL', 'FastAPI'],
      link: { href: 'https://uae-project-steel.vercel.app', text: 'uae-project-steel.vercel.app' },
      motif: 'radar',
      accent: ['#34d399', '#22d3ee'],
    },
  ],
};
