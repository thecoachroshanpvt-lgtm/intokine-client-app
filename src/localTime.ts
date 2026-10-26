// Session times are set by the coach in the studio's time zone (Dubai). A client in another country sees the same moment
// in their own phone's time zone, so an online client in India or Saudi Arabia is never told the wrong hour.
const STUDIO_TZ = 'Asia/Dubai';

function offsetMs(ms: number, tz: string): number {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
    .formatToParts(new Date(ms)).reduce<Record<string, number>>((a, x) => { if (x.type !== 'literal') a[x.type] = Number(x.value); return a; }, {});
  return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

/** The session time on this phone's clock. Returns null if the date or time cannot be read (the caller then shows the time as written). */
export function localClock(time: string, date: string, tz: string = STUDIO_TZ): { clock: string; period: string; differs: boolean; dayShift: number } | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  const tm = /^(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec((time || '').trim());
  if (!dm || !tm) return null;
  let h = Number(tm[1]);
  const sfx = tm[3] ? tm[3].toUpperCase() : '';
  if (sfx) {
    if (h < 1 || h > 12) return null;
    if (sfx === 'PM' && h < 12) h += 12;
    if (sfx === 'AM' && h === 12) h = 0;
  }
  if (h > 23) return null;
  try {
    const guess = Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), h, Number(tm[2]));
    let ms = guess - offsetMs(guess, tz);
    ms = guess - offsetMs(ms, tz);
    const d = new Date(ms);
    const lh = d.getHours();
    const differs = lh !== h || d.getMinutes() !== Number(tm[2]);
    const localDay = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    const studioDay = Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]));
    return { clock: `${lh % 12 === 0 ? 12 : lh % 12}:${String(d.getMinutes()).padStart(2, '0')}`, period: lh >= 12 ? 'PM' : 'AM', differs, dayShift: Math.round((localDay - studioDay) / 86400000) };
  } catch {
    return null;
  }
}
