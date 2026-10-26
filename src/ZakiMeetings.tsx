import React, { useMemo, useState } from 'react';
import { ChevronRight, Video, Trash2, Calendar } from 'lucide-react';
import { usePrimeStore } from '../../lib/store';
import type { ClientMasterRecord, ZakiMeeting } from '../../types';

// Group meetings for Zaki clients. One meeting is put on every active Katba client's record, so the Zaki app shows it on Home
// and in the Workouts tab with a Join Google Meet button. Meetings can be scheduled days or weeks ahead.

const inputCls = 'w-full bg-[#1c1c1c] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-[#6ccbde] [color-scheme:dark]';

const todayKey = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};
const prettyDate = (k: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : k;
};
const prettyTime = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(t || '');
  if (!m) return t || '';
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`;
};
const cleanLink = (raw: string) => {
  const v = raw.trim();
  if (!v) return '';
  const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withProto);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : '';
  } catch {
    return '';
  }
};

export const ZakiMeetings: React.FC<{
  onBack: () => void;
  /** Katba clients assigned to the person who is logged in. */
  myClients: ClientMasterRecord[];
  isOwner: boolean;
  createdBy: string;
}> = ({ onBack, myClients, isOwner, createdBy }) => {
  const { clientMasterRecords, scheduleZakiMeeting, deleteZakiMeeting } = usePrimeStore();
  const [title, setTitle] = useState('Katba group meeting');
  const [date, setDate] = useState(todayKey());
  const [time, setTime] = useState('19:00');
  const [link, setLink] = useState('');
  const [notes, setNotes] = useState('');
  const [scopeAll, setScopeAll] = useState(false);
  const [msg, setMsg] = useState('');

  const allZaki = clientMasterRecords.filter((c) => c.service === 'Recorded Training' && c.status === 'Active');
  const mineActive = myClients.filter((c) => c.service === 'Recorded Training' && c.status === 'Active');
  const targets = isOwner && scopeAll ? allZaki : mineActive;

  // The meetings this person scheduled, collected from the client records.
  const meetings = useMemo(() => {
    const byId = new Map<string, { m: ZakiMeeting; count: number; names: string[] }>();
    clientMasterRecords.forEach((c) =>
      (c.zakiMeetings || []).forEach((m) => {
        if (m.createdBy && m.createdBy !== createdBy) return;
        const cur = byId.get(m.id);
        byId.set(m.id, { m, count: (cur?.count || 0) + 1, names: [...(cur?.names || []), c.name] });
      })
    );
    return Array.from(byId.values()).sort((a, b) => (a.m.date + a.m.time).localeCompare(b.m.date + b.m.time));
  }, [clientMasterRecords, createdBy]);
  const today = todayKey();
  const upcoming = meetings.filter((x) => x.m.date >= today);
  const past = meetings.filter((x) => x.m.date < today).reverse();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = cleanLink(link);
    if (!url) { setMsg('Please paste a valid Google Meet link.'); return; }
    if (!title.trim() || !date || !time) { setMsg('Please fill in the title, date and time.'); return; }
    if (targets.length === 0) { setMsg('There are no active Katba clients to invite.'); return; }
    scheduleZakiMeeting(
      { id: `ZM-${Date.now()}`, title: title.trim(), date, time, tz: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dubai'; } catch { return 'Asia/Dubai'; } })(), meetLink: url, notes: notes.trim() || undefined, createdBy },
      targets.map((c) => c.id)
    );
    setMsg(`Meeting scheduled for ${targets.length} Katba client${targets.length === 1 ? '' : 's'}.`);
    setLink('');
    setNotes('');
    window.setTimeout(() => setMsg(''), 5000);
  };

  const row = ({ m, count, names }: { m: ZakiMeeting; count: number; names: string[] }) => (
    <div key={m.id} className="rounded-2xl p-4 border border-[#6ccbde]/20 bg-gradient-to-br from-[#6ccbde]/10 to-transparent flex items-center gap-3">
      <div className="w-9 h-9 shrink-0 rounded-xl bg-[#6ccbde]/15 flex items-center justify-center text-[#6ccbde]"><Video className="w-4 h-4" /></div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white truncate">{m.title}</div>
        <div className="text-[11px] text-neutral-400 truncate">{prettyDate(m.date)} · {prettyTime(m.time)} · {count} client{count === 1 ? '' : 's'}</div>
        <div className="text-[11px] text-neutral-500 truncate">For: {names.slice(0, 3).join(', ')}{names.length > 3 ? ` +${names.length - 3} more` : ''}{m.createdBy ? ` · by ${m.createdBy}` : ''}</div>
        <a href={m.meetLink} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#6ccbde] underline">Open Meet link</a>
      </div>
      <button
        type="button"
        onClick={() => { if (window.confirm(`Delete "${m.title}" on ${prettyDate(m.date)}? It will also disappear from the Katba app.`)) deleteZakiMeeting(m.id); }}
        aria-label="Delete meeting"
        className="p-2 -mr-1 text-neutral-500 hover:text-red-400 shrink-0"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="text-xs font-bold text-[#6ccbde] hover:text-white flex items-center gap-1">
        <ChevronRight className="w-4 h-4 rotate-180" /> Back
      </button>

      <form onSubmit={submit} className="bg-[#252525] border border-white/[0.06] rounded-2xl p-4 space-y-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><Calendar className="w-4 h-4 text-[#6ccbde]" /> Schedule a group meeting</h3>
          <p className="text-[11px] text-neutral-400 mt-1">It is sent to {targets.length} active Katba client{targets.length === 1 ? '' : 's'} and shows in their app with a Join Google Meet button. You can schedule it days or weeks ahead.</p>
        </div>
        <div>
          <label className="text-[11px] text-neutral-400 font-semibold block mb-1">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-neutral-400 font-semibold block mb-1">Date</label>
            <input type="date" min={todayKey()} value={date} onChange={(e) => setDate(e.target.value)} className={inputCls + ' font-mono'} />
          </div>
          <div>
            <label className="text-[11px] text-neutral-400 font-semibold block mb-1">Time (your time zone; clients see their own local time)</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls + ' font-mono'} />
          </div>
        </div>
        <div>
          <label className="text-[11px] text-neutral-400 font-semibold block mb-1">Google Meet link *</label>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/abc-defg-hij" className={inputCls} />
        </div>
        <div>
          <label className="text-[11px] text-neutral-400 font-semibold block mb-1">Notes (optional)</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Bring your questions on form" className={inputCls} />
        </div>
        {isOwner && (
          <label className="flex items-center gap-2 text-[11px] text-neutral-300">
            <input type="checkbox" checked={scopeAll} onChange={(e) => setScopeAll(e.target.checked)} />
            Include every coach's Katba clients ({allZaki.length}), not only mine ({mineActive.length})
          </label>
        )}
        {msg && <p className="text-[11px] font-semibold text-[#6ccbde]">{msg}</p>}
        <button type="submit" className="w-full py-3 bg-[#6ccbde] text-[#0b0c10] font-semibold rounded-xl text-sm hover:brightness-110 transition">Schedule meeting</button>
      </form>

      <div className="space-y-2.5">
        <div className="text-[10px] font-bold text-neutral-500 uppercase px-1">Upcoming meetings</div>
        {upcoming.length === 0 ? <p className="text-xs text-neutral-500 px-1">No upcoming meetings.</p> : upcoming.map(row)}
      </div>
      {past.length > 0 && (
        <div className="space-y-2.5">
          <div className="text-[10px] font-bold text-neutral-500 uppercase px-1">Past meetings</div>
          {past.map(row)}
        </div>
      )}
    </div>
  );
};
