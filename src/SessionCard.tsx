import React from 'react';

// One session card for Home and Schedule. Online clients get a Google Meet
// join button; everything else (date tile, time, status) is the same for all.

export interface SessionCardData {
  id: string;
  date: string; // YYYY-MM-DD
  time: string;
  coachName: string;
  sessionType: string;
  location: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled' | 'Postponed';
  attendanceStatus?: string;
  program?: string;
  meetLink?: string;
  postponeReason?: string;
}

function parseDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

// Accepts "14:00" and "02:00 PM".
function formatTime(t: string): { clock: string; period: string } | null {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec((t || '').trim());
  if (!m) return null;
  let h = Number(m[1]);
  const suffix = m[3] ? m[3].toUpperCase() : '';
  if (suffix) {
    if (h < 1 || h > 12) return null;
    if (suffix === 'PM' && h < 12) h += 12;
    if (suffix === 'AM' && h === 12) h = 0;
  }
  if (h > 23) return null;
  return { clock: `${h % 12 === 0 ? 12 : h % 12}:${m[2]}`, period: h >= 12 ? 'PM' : 'AM' };
}

const statusColor = (status: SessionCardData['status']) =>
  status === 'Completed' ? '#6ccbde' : status === 'Cancelled' ? '#71717a' : status === 'Postponed' ? '#f59e0b' : '#ec2226';

// Only real web links open; anything else typed in Coach OS is ignored.
function safeLink(raw?: string): string | null {
  const v = (raw || '').trim();
  if (!v) return null;
  const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withProto);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

interface Props {
  s: SessionCardData;
  /** Online Personal Training client */
  online: boolean;
  /** Home only: the day being shown. A session moved off that day reads "Moved to ...". */
  viewDate?: string;
}

export const SessionCard: React.FC<Props> = ({ s, online, viewDate }) => {
  const isOnline = online || s.program === 'Online Personal Training';
  const movedAway = !!viewDate && s.date !== viewDate;
  const absent = !movedAway && (s.attendanceStatus === 'Absent' || s.attendanceStatus === 'No Show');
  const color = movedAway ? '#f59e0b' : absent ? '#ec2226' : statusColor(s.status);
  const label = movedAway ? 'POSTPONED' : absent ? 'ABSENT' : s.status.toUpperCase();
  const tileDate = parseDateKey(movedAway ? (viewDate as string) : s.date);
  const movedTo = movedAway ? parseDateKey(s.date) : null;
  const t = formatTime(s.time);
  const link = safeLink(s.meetLink);
  const live = isOnline && !movedAway && !absent && s.status === 'Scheduled';

  return (
    <div className="bg-[#252525] border border-white/[0.06] rounded-2xl p-3">
      <div className="flex items-center gap-3">
        <div className="w-14 shrink-0 rounded-xl bg-white/[0.05] border border-white/[0.06] py-2 text-center">
          <div className="font-subheader text-[12px] uppercase tracking-wide text-[#6ccbde] leading-none">
            {tileDate ? tileDate.toLocaleDateString(undefined, { weekday: 'short' }) : '—'}
          </div>
          <div className="text-lg font-semibold font-mono text-white leading-none mt-1.5 mb-1">{tileDate ? tileDate.getDate() : '—'}</div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-white/40 leading-none">
            {tileDate ? tileDate.toLocaleDateString(undefined, { month: 'short' }) : ''}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          {movedAway ? (
            <div className="text-sm font-bold text-amber-400 leading-snug">
              Moved to {movedTo ? movedTo.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : s.date}
              {t ? ` · ${t.clock} ${t.period}` : ''}
            </div>
          ) : (
            <div className="flex items-baseline gap-1">
              {t ? (
                <>
                  <span className="text-base font-semibold font-mono text-white leading-none">{t.clock}</span>
                  <span className="text-[10px] font-bold text-white/50">{t.period}</span>
                </>
              ) : (
                <span className="text-sm font-bold text-white">{s.time || 'Time TBC'}</span>
              )}
            </div>
          )}
          <div className="text-xs font-semibold text-white/80 mt-1 truncate">{s.sessionType}</div>
          <div className="text-[11px] text-white/40 font-light truncate">
            {isOnline ? 'Online · Google Meet' : s.location} · Coach {s.coachName}
          </div>
        </div>
        <span
          className="text-[9px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap self-start"
          style={{ color, borderColor: `${color}40`, backgroundColor: `${color}15` }}
        >
          {label}
        </span>
      </div>

      {(movedAway || s.status === 'Postponed') && s.postponeReason ? (
        <p className="mt-2 text-[11px] text-amber-300/90 font-light">Reason: {s.postponeReason}</p>
      ) : null}

      {live && (
        link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-[#6ccbde] text-[#0b0c10] text-sm font-bold py-2.5 active:scale-[0.99] transition"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
              <path d="M15.5 10.5l6-3.5v10l-6-3.5" />
            </svg>
            Join Google Meet
          </a>
        ) : (
          <div className="mt-3 w-full rounded-xl bg-white/[0.04] border border-white/[0.06] text-[11px] text-white/50 text-center py-2.5">
            Your coach will add the Google Meet link here
          </div>
        )
      )}
    </div>
  );
};
