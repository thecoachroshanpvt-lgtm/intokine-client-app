// Turns this checkout into the "recorded sessions" app (KATBA). Run by `npm run build:recorded` on Cloudflare.
// It never touches the GitHub files: it only edits the copy that is built.
//
// What it does
//  1. src/variant.ts -> IS_RECORDED = true (hides direct-coaching features, shows the Workouts tab and client progress entry)
//  2. Accent colour: the app uses the brand red (#ec2226 on charcoal #1c1c1c) only. Every cyan (#6ccbde) accent becomes red.
//  3. App name in the page title, home-screen title and manifest
//  4. Icons: any file in public-recorded/ replaces the same-named file in public/ (icon-192.png, icon-512.png, favicon-32.png ...)
import fs from 'node:fs';
import path from 'node:path';

const APP_NAME = process.env.RECORDED_APP_NAME || 'KATBA';
const root = process.cwd();
const src = path.join(root, 'src');

// 1. variant
const variantPath = path.join(src, 'variant.ts');
let variant = fs.readFileSync(variantPath, 'utf8');
variant = variant.replace('IS_RECORDED = false', 'IS_RECORDED = true').replace(/APP_NAME = '[^']*'/, `APP_NAME = '${APP_NAME.replace(/'/g, '')}'`);
fs.writeFileSync(variantPath, variant);

// 2. accent colour: cyan -> brand red, everywhere (pages, charts, popups, animations)
const RED = '#ec2226';
const CYAN = '#6ccbde';
// Katba colour roles (change here to retune the whole app):
//  RED  = brand: buttons, active tabs, selected states, progress, big highlights
//  GOLD = energy accent: values, links, protein, chart lines, small highlights
//  section labels = soft white, idle borders = neutral grey
const GOLD = '#ffb020';
const DARK = '#0b0c10';
let changed = 0;
const darkText = '(?:text-black|text-\\[#0d0e12\\]|text-\\[#0b0c10\\]|text-\\[#1c1c1c\\])';
const cyanBg = 'bg-\\[#6ccbde\\](?!\\/)';
const files = fs.readdirSync(src).filter((n) => n.endsWith('.tsx') || n.endsWith('.ts') || n.endsWith('.css'));
for (const f of files) {
  const p = path.join(src, f);
  let s = fs.readFileSync(p, 'utf8');
  const before = s;
  // the welcome screen's red-to-cyan gradient (button + line) stays exactly as in the other client apps
  const keepGrad = f === 'WelcomeScreen.tsx';
  const GRAD = `${RED} 0%, ${CYAN} 100%`;
  if (keepGrad) s = s.split(GRAD).join('__KEEP_GRAD__');
  // a solid cyan button had dark text; on solid red the text must be white (only inside the same class string)
  s = s.replace(new RegExp(`(${cyanBg}[^'"\`]{0,80}?)${darkText}`, 'g'), '$1text-white');
  s = s.replace(new RegExp(`${darkText}([^'"\`]{0,80}?${cyanBg})`, 'g'), 'text-white$1');
  // the same for inline styles
  s = s.split(`background: '${CYAN}', color: '${DARK}'`).join(`background: '${RED}', color: '#ffffff'`);
  s = s.split(`background: '${CYAN}', color: '#0d0e12'`).join(`background: '${RED}', color: '#ffffff'`);
  // role-based recolour of the old cyan (instead of turning everything red)
  s = s.replace(/(["'`])([^"'`\n]*6ccbde[^"'`\n]*)\1/g, (_m, q, body) => {
    const selected = /bg-\[#6ccbde\]\/(?:1\d|2\d)|border-\[#6ccbde\]\/50|bg-\[#6ccbde\](?!\/)/.test(body);
    const upper = /\buppercase\b/.test(body);
    body = body.replace(/text-\[#6ccbde\](?:\/80)?/g, selected ? `text-[${RED}]` : upper ? 'text-white/85' : `text-[${GOLD}]`);
    body = body.replace(/(hover:)?border-\[#6ccbde\]\/(?:25|30|40)(?!\d)/g, (_x, h) => (h ? 'hover:border-white/30' : 'border-white/20'));
    body = body.replace(/to-\[#6ccbde\](\/\d+)?/g, (_x, o) => `to-[${GOLD}]${o || ''}`);
    return q + body + q;
  });
  s = s.replace(/text-\[#6ccbde\](?:\/80)?/g, `text-[${GOLD}]`);
  // inline styles: filled backgrounds stay brand red, every other cyan colour value becomes the gold accent
  s = s.replace(/(background(?:Color)?:\s*)(['"])#6ccbde\2/g, `$1'${RED}'`);
  s = s.replace(/(['"])#6ccbde\1/g, `$1${GOLD}$1`);
  s = s.replace(/(linear-gradient\([^)]*?)#6ccbde/g, `$1${GOLD}`);
  if (f.endsWith('.css')) s = s.split(CYAN).join(RED);
  // every remaining cyan becomes red
  s = s.split(CYAN).join(RED).split(CYAN.toUpperCase()).join(RED);
  // keep the original spacing: a space inside a Tailwind class like shadow-[...rgba(...)] would break the class
  s = s.replace(/rgba\((\s*)108,(\s*)203,(\s*)222/g, (_m, a, b, c) => `rgba(${a}236,${b}34,${c}38`);
  if (keepGrad) s = s.split('__KEEP_GRAD__').join(GRAD);
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
console.log(`Katba app prepared: "${APP_NAME}", ${changed} files recoloured.`);
