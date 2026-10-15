import React, { useEffect, useState } from 'react';
import { initializeClientFirebaseApp, onSnapshot, doc } from './firebase';

// Group meetings scheduled by the coach for Zaki clients. They live on the client's own record (zakiMeetings),
// which this app already reads, so no extra database access is needed.

export interface ZakiMeeting {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // "19:00" or "07:00 PM"
  meetLink: string;
  notes?: string;
}

const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseDateKey = (k: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
function formatTime(t: string): { clock: string; period: string } | null {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec((t || '').trim());
  if (!m) return null;
  let h = Number(m[1]);
  const suffix = m[3] ? m[3].toUpperCase() : '';
  if (suffix) {
    if (suffix === 'PM' && h < 12) h += 12;
    if (suffix === 'AM' && h === 12) h = 0;
  }
  if (h > 23) return null;
  return { clock: `${h % 12 === 0 ? 12 : h % 12}:${m[2]}`, period: h >= 12 ? 'PM' : 'AM' };
}
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

// The client's upcoming meetings (today and later), soonest first.
export function useZakiMeetings(clientId: string): ZakiMeeting[] {
  const [all, setAll] = useState<ZakiMeeting[]>([]);
  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) return;
    return onSnapshot(
      doc(db, 'intokine_clients', clientId),
      (d) => setAll(Array.isArray((d.data() as any)?.zakiMeetings) ? ((d.data() as any).zakiMeetings as ZakiMeeting[]) : []),
      () => {}
    );
  }, [clientId]);
  const today = dateKey(new Date());
  return all.filter((m) => m.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

export const ZakiMeetingCard: React.FC<{ m: ZakiMeeting }> = ({ m }) => {
  const today = dateKey(new Date());
  const d = parseDateKey(m.date);
  const t = formatTime(m.time);
  const link = safeLink(m.meetLink);
  const isToday = m.date === today;
  return (
    <div className="bg-[#252525] border border-white/[0.06] rounded-2xl p-3">
      <div className="flex items-center gap-3">
        <div className="w-14 shrink-0 rounded-xl bg-white/[0.05] border border-white/[0.06] py-2 text-center">
          <div className="font-subheader text-[12px] uppercase tracking-wide text-[#6ccbde] leading-none">{d ? d.toLocaleDateString(undefined, { weekday: 'short' }) : '—'}</div>
          <div className="text-lg font-semibold font-mono text-white leading-none mt-1.5 mb-1">{d ? d.getDate() : '—'}</div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-white/40 leading-none">{d ? d.toLocaleDateString(undefined, { month: 'short' }) : ''}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1">
            {t ? (
              <>
                <span className="text-base font-semibold font-mono text-white leading-none">{t.clock}</span>
                <span className="text-[10px] font-bold text-white/50">{t.period}</span>
              </>
            ) : (
              <span className="text-sm font-bold text-white">{m.time || 'Time TBC'}</span>
            )}
          </div>
          <div className="text-xs font-semibold text-white/80 mt-1 truncate">{m.title}</div>
          <div className="text-[11px] text-white/40 font-light truncate">Group meeting · Google Meet</div>
        </div>
        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap self-start" style={{ color: '#6ccbde', borderColor: '#6ccbde40', backgroundColor: '#6ccbde15' }}>
          {isToday ? 'TODAY' : 'MEETING'}
        </span>
      </div>
      {m.notes ? <p className="mt-2 text-[11px] text-white/50 font-light">{m.notes}</p> : null}
      {link ? (
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
      )}
    </div>
  );
};
