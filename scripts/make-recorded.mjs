// Turns this checkout into the "recorded sessions" app. Run by `npm run build:recorded` on Render (the second Static Site).
// It never touches the GitHub files: it only edits the copy Render builds from.
//
// What it does
//  1. src/variant.ts -> IS_RECORDED = true (hides direct-coaching features, shows the Workouts tab and client progress entry)
//  2. Accent colour: the red + cyan accent becomes cyan only (#6ccbde on charcoal #1c1c1c). Red stays only where it means
//     "problem" (errors, absent, low scores, expired).
//  3. App name in the page title, home-screen title and manifest
//  4. Icons: any file in public-recorded/ replaces the same-named file in public/ (icon-192.png, icon-512.png, favicon-32.png ...)
import fs from 'node:fs';
import path from 'node:path';

const APP_NAME = process.env.RECORDED_APP_NAME || 'ZAKI';
const root = process.cwd();
const src = path.join(root, 'src');

// 1. variant
const variantPath = path.join(src, 'variant.ts');
let variant = fs.readFileSync(variantPath, 'utf8');
variant = variant.replace('IS_RECORDED = false', 'IS_RECORDED = true').replace(/APP_NAME = '[^']*'/, `APP_NAME = '${APP_NAME.replace(/'/g, '')}'`);
fs.writeFileSync(variantPath, variant);

// 2. accent colour
const RED = '#ec2226';
const CYAN = '#6ccbde';
const DARK = '#0b0c10';
let changed = 0;
for (const f of fs.readdirSync(src).filter((n) => n.endsWith('.tsx'))) {
  const p = path.join(src, f);
  let s = fs.readFileSync(p, 'utf8');
  const before = s;
  // red-to-cyan gradients become plain cyan
  s = s.split(`${RED}, ${CYAN}`).join(`${CYAN}, ${CYAN}`);
  s = s.split(`from-[${RED}] to-[${CYAN}]`).join(`from-[${CYAN}] to-[${CYAN}]`);
  s = s.split(`shadow-[${RED}]/20`).join(`shadow-[${CYAN}]/20`);
  // active tab icons
  s = s.split(`active ? '${RED}' : 'currentColor'`).join(`active ? '${CYAN}' : 'currentColor'`);
  // the "assigned" pill on a suggested workout is an accent, not a problem
  s = s.split(`done ? '#34d399' : '${RED}'`).join(`done ? '#34d399' : '${CYAN}'`);
  // solid primary buttons: red background with white text -> cyan background with dark text (inside one class string)
  s = s.replace(/(className=(?:"[^"]*"|\{`[^`]*`\}))/g, (m) => {
    if (!m.includes(`bg-[${RED}]`) || !m.includes('text-white')) return m;
    return m.replace(new RegExp(`bg-\\[${RED}\\](?!/)`, 'g'), `bg-[${CYAN}]`).replace(/text-white/g, `text-[${DARK}]`);
  });
  s = s.replace(/style=\{locked \? undefined : \{ background: '#ec2226' \}\}/g, `style={locked ? undefined : { background: '${CYAN}' }}`);
  if (s !== before) { fs.writeFileSync(p, s); changed++; }
}

// 3. names
const rep = (file, pairs) => {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) return;
  let s = fs.readFileSync(p, 'utf8');
  pairs.forEach(([a, b]) => { s = s.split(a).join(b); });
  fs.writeFileSync(p, s);
};
rep('index.html', [['<title>INTOKINE</title>', `<title>${APP_NAME}</title>`], ['content="INTOKINE"', `content="${APP_NAME}"`]]);
rep('public/manifest.json', [['"name": "INTOKINE"', `"name": "${APP_NAME}"`], ['"short_name": "INTOKINE"', `"short_name": "${APP_NAME}"`]]);

// 4. icons
const iconDir = path.join(root, 'public-recorded');
if (fs.existsSync(iconDir)) {
  for (const f of fs.readdirSync(iconDir)) {
    if (f.toLowerCase() === 'readme.md' || f.toLowerCase() === 'readme.txt') continue;
    fs.copyFileSync(path.join(iconDir, f), path.join(root, 'public', f));
  }
}
console.log(`Recorded app prepared: "${APP_NAME}", ${changed} files recoloured.`);
