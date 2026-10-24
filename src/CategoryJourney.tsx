import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CATEGORY_CONFIGS } from './assessmentConfig';
import { MiniLineChart } from './MiniLineChart';

// Performance categories without a Pass / Already fit button.
// Newest logged activity on top; tap any card to see its whole journey.
// Score-out-of-10 activities move to "Passed" as soon as a 10 is logged.

type Pt = { date: string; value: number };
interface Series { label: string; color: string; points: Pt[] }
interface Log { id: string; date: string; text: string; review: string }
export interface Act { pairs?: { date: string; left?: number; right?: number }[]; name: string; label: string; kind: string; unit: string; series: Series[]; logs: Log[]; last: string; passed: boolean; review: string }

const COLORS = ['#ec2226', '#6ccbde', '#f59e0b', '#a78bfa', '#34d399'];
const keyOf = (r: any) => `${r.date || ''}|${r.id || ''}`;
const num = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

export const buildActs = (catKey: string, goals: any[], recs: any[]): Act[] => {
  const cfg = CATEGORY_CONFIGS[catKey];
  const prefix = `${cfg.category}: `;
  const items: { name: string; label: string; kind: string; unit: string; labels: string[]; get: (r: any) => (number | undefined)[]; std?: any }[] = [];
  cfg.standards.forEach((s) => {
    const labels = s.kind === 'score10' ? ['Score'] : s.fields.map((f) => f.label);
    items.push({ name: s.name, label: s.label, kind: s.kind, unit: s.unit || '', labels, std: s, get: (r) => s.fields.map((f) => num(r[f.key])) });
  });
  goals.filter((g) => g.activityName.startsWith(prefix) && !cfg.standards.some((s) => s.name === g.activityName)).forEach((g) => {
    const k = cfg.customKinds.find((c) => c.valueType !== undefined && c.valueType === g.valueType) || cfg.customKinds[0];
    const name = g.activityName as string;
    if (k.kind === 'dual') items.push({ name, label: name.slice(prefix.length), kind: 'dual', unit: k.unit || '', labels: k.fieldLabels ? [...k.fieldLabels] : ['Left', 'Right'], get: (r) => [num(r.activitySides?.[name]?.left), num(r.activitySides?.[name]?.right)] });
    else if (k.kind === 'circuits') items.push({ name, label: name.slice(prefix.length), kind: 'circuits', unit: 'sec', labels: ['Total time (sec)'], get: (r) => [r.activityCircuits?.[name] ? (r.activityCircuits[name] as number[]).reduce((a, b) => a + b, 0) : undefined] });
    else items.push({ name, label: name.slice(prefix.length), kind: k.kind, unit: k.unit || '', labels: [k.kind === 'score10' ? 'Score' : k.unit || 'Value'], get: (r) => [num(r.customActivityScores?.[name])] });
  });
  const out: Act[] = [];
  items.forEach((it) => {
    const mine = recs.filter((r) => it.get(r).some((v) => v !== undefined)).sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
    if (!mine.length) return;
    const series: Series[] = it.labels.map((label, i) => ({ label, color: COLORS[i % COLORS.length], points: mine.map((r) => ({ date: r.date, value: it.get(r)[i] as number })).filter((p) => p.value !== undefined) }));
    const reviewFor = (r: any) => (r.activityObservations?.[it.name] || (it.std?.obsField ? r[it.std.obsField] : '') || '').toString();
    const logs: Log[] = [...mine].reverse().map((r) => {
      const v = it.get(r);
      const text = it.kind === 'score10' ? `${v[0]}/10` : v.map((x, i) => (x === undefined ? null : (it.labels.length > 1 ? `${it.labels[i]} ` : '') + x)).filter(Boolean).join(' · ') + (it.unit && it.kind !== 'score10' ? ` ${it.unit}` : '');
      return { id: r.id, date: r.date, text, review: reviewFor(r) };
    });
    const passed = it.kind === 'score10' && series[0].points.some((p) => p.value >= 10);
    out.push({ pairs: it.kind === 'dual' ? mine.map((r) => ({ date: r.date, left: it.get(r)[0], right: it.get(r)[1] })) : undefined, name: it.name, label: it.label, kind: it.kind, unit: it.unit, series, logs, last: keyOf(mine[mine.length - 1]), passed, review: logs.find((l) => l.review)?.review || '' });
  });
  return out.sort((a, b) => b.last.localeCompare(a.last));
};

const Journey: React.FC<{ a: Act; onClose: () => void }> = ({ a, onClose }) => {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.setAttribute('data-popup-open', '1');
    return () => { document.body.style.overflow = prev; document.body.removeAttribute('data-popup-open'); };
  }, []);
  const score = a.kind === 'score10';
  return createPortal(
    <div className="anim-overlay fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-5" onClick={onClose}>
      <div data-no-pull className="anim-card w-full max-w-md max-h-[85vh] bg-[#1c1c1c] border border-white/[0.1] rounded-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 p-4 border-b border-white/[0.08]">
          <div>
            <div className="font-subheader text-[17px] text-white">{a.label}</div>
            <div className="text-[11px] text-white/40">{a.passed ? 'Passed' : 'In progress'} · {a.logs.length} {a.logs.length === 1 ? 'log' : 'logs'}</div>
          </div>
          <button type="button" onClick={onClose} className="text-white/50 text-xl leading-none px-1" aria-label="Close">×</button>
        </div>
        <div className="overflow-y-auto p-4 space-y-4" style={{ overscrollBehavior: 'contain' }}>
          {a.series.map((s) => (
            <div key={s.label}>
              {a.series.length > 1 && <div className="text-[10px] uppercase font-bold tracking-wide mb-1" style={{ color: s.color }}>{s.label}</div>}
              <MiniLineChart data={s.points} color={s.color} unit={a.unit && !score ? ` ${a.unit}` : ''} fixedMin={score ? 0 : undefined} fixedMax={score ? 10 : undefined} />
            </div>
          ))}
          <div>
            <div className="font-subheader text-[12px] uppercase tracking-wide text-[#6ccbde] mb-2">Your journey</div>
            <div className="space-y-2">
              {a.logs.map((l) => (
                <div key={l.id} className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3">
                  <div className="flex items-baseline justify-between gap-2"><span className="text-sm font-semibold text-white">{l.text}</span><span className="text-[10px] text-white/40 font-mono">{l.date}</span></div>
                  {l.review && <div className="mt-1.5"><span className="font-subheader text-[11px] text-[#6ccbde] uppercase tracking-wide block mb-0.5">Review</span><p className="text-xs text-white/85 leading-relaxed whitespace-pre-line">{l.review}</p></div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

const Card: React.FC<{ a: Act; onOpen: () => void }> = ({ a, onOpen }) => {
  const score = a.kind === 'score10';
  const latest = a.logs[0];
  return (
    <button type="button" onClick={onOpen} className="w-full text-left bg-[#252525] border border-white/[0.06] rounded-2xl p-4 relative overflow-hidden active:scale-[0.99] transition">
      <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: a.passed ? 'linear-gradient(90deg, #34d399, transparent)' : `linear-gradient(90deg, ${a.series[0].color}, transparent)` }} />
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-[10px] text-white/40 uppercase font-bold tracking-wide">{a.label}{a.unit && !score ? <span className="normal-case text-white/30"> ({a.unit})</span> : null}</span>
        {a.passed ? <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border text-[#34d399] border-[#34d399]/40 bg-[#34d399]/10">✓ PASSED</span> : <span className="text-sm font-semibold text-white font-mono">{latest.text}</span>}
      </div>
      {a.series.map((s) => (
        <div key={s.label} className="pointer-events-none">
          {a.series.length > 1 && <div className="text-[10px] uppercase font-bold tracking-wide mt-1" style={{ color: s.color }}>{s.label}</div>}
          <MiniLineChart data={s.points} color={s.color} unit={a.unit && !score ? ` ${a.unit}` : ''} fixedMin={score ? 0 : undefined} fixedMax={score ? 10 : undefined} />
        </div>
      ))}
      {a.review && (
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          <span className="font-subheader text-[12px] text-[#6ccbde] uppercase tracking-wide block mb-1">Review</span>
          <p className="text-xs text-white/90 font-normal leading-relaxed whitespace-pre-line line-clamp-3">{a.review}</p>
        </div>
      )}
      <div className="mt-2 text-[11px] font-semibold text-[#6ccbde]">See journey ›</div>
    </button>
  );
};

export const CategoryJourney: React.FC<{ catKey: string; goals: any[]; records: any[] }> = ({ catKey, goals, records }) => {
  const acts = useMemo(() => buildActs(catKey, goals, records), [catKey, goals, records]);
  const [open, setOpen] = useState('');
  const cur = acts.find((x) => x.name === open);
  const inProg = acts.filter((x) => !x.passed);
  const passed = acts.filter((x) => x.passed);
  if (!acts.length) return <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 text-center"><p className="text-sm text-white/50 font-light">Nothing logged here yet. Use + Add result.</p></div>;
  return (
    <div className="space-y-3">
      {cur && <Journey a={cur} onClose={() => setOpen('')} />}
      {inProg.map((a) => <Card key={a.name} a={a} onOpen={() => setOpen(a.name)} />)}
      {passed.length > 0 && (
        <>
          <div className="font-subheader text-[12px] uppercase tracking-wide text-[#34d399] pt-2">Passed</div>
          {passed.map((a) => <Card key={a.name} a={a} onOpen={() => setOpen(a.name)} />)}
        </>
      )}
    </div>
  );
};
