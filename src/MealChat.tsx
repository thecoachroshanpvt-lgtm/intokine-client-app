import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { initializeClientFirebaseApp, collection, query, where, onSnapshot, doc, setDoc } from './firebase';

// A small chat under each meal, between the client and the dietitian. One document per message in intokine_meal_chats
// (clientId, date, mealId, from 'client' | 'staff', name, text, at). Nothing is ever edited, so there is nothing to clash.

export interface ChatMsg { id: string; date: string; mealId: string; from: 'client' | 'staff'; name?: string; text: string; at: string }

export function useMealChats(clientId: string): ChatMsg[] {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db || !clientId) return;
    return onSnapshot(
      query(collection(db, 'intokine_meal_chats'), where('clientId', '==', clientId)),
      (snap) => setMsgs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as ChatMsg)).sort((a, b) => String(a.at).localeCompare(String(b.at)))),
      () => {}
    );
  }, [clientId]);
  return msgs;
}

const seenKey = (clientId: string, date: string, mealId: string) => `ik_chat_seen_${clientId}_${date}_${mealId}`;
const readSeen = (k: string) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const writeSeen = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

/** The button under a meal: "Chat" with the number of messages, and a dot when the dietitian wrote something new. */
export const MealChatButton: React.FC<{ clientId: string; date: string; mealId: string; msgs: ChatMsg[]; legacyNote?: string; onOpen: () => void }> = ({ clientId, date, mealId, msgs, legacyNote, onOpen }) => {
  const mine = msgs.filter((m) => m.date === date && m.mealId === mealId);
  const count = mine.length + (legacyNote ? 1 : 0);
  const last = mine.length ? mine[mine.length - 1] : null;
  const unread = (last?.from === 'staff' && last.at > readSeen(seenKey(clientId, date, mealId))) || (!mine.length && !!legacyNote && !readSeen(seenKey(clientId, date, mealId)));
  return (
    <button type="button" onClick={onOpen} className="mx-4 mb-4 -mt-1 flex items-center gap-2 text-[11px] font-semibold text-[#6ccbde]">
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>
      {count ? `Chat with your nutritionist · ${count}` : 'Ask your nutritionist about this meal'}
      {unread && <span className="w-2 h-2 rounded-full bg-[#ec2226]" aria-label="New message" />}
    </button>
  );
};

export const MealChatSheet: React.FC<{ clientId: string; clientName?: string; date: string; mealId: string; mealName: string; msgs: ChatMsg[]; legacyNote?: string; legacyBy?: string; onClose: () => void }> = ({ clientId, clientName, date, mealId, mealName, msgs, legacyNote, legacyBy, onClose }) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);
  const mine = msgs.filter((m) => m.date === date && m.mealId === mealId);
  const last = mine.length ? mine[mine.length - 1].at : 'seen';
  useEffect(() => { writeSeen(seenKey(clientId, date, mealId), last); endRef.current?.scrollIntoView({ block: 'end' }); }, [mine.length, last, clientId, date, mealId]);

  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setErr('');
    try {
      const { db } = initializeClientFirebaseApp();
      if (!db) throw new Error('offline');
      const at = new Date().toISOString();
      const id = `${clientId}_${date}_${mealId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      await setDoc(doc(db, 'intokine_meal_chats', id), { clientId, date, mealId, mealName, from: 'client', name: clientName || 'Client', text: t.slice(0, 500), at });
      setText('');
    } catch {
      setErr('Could not send. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[400] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-sm max-h-[80vh] flex flex-col bg-[#1c1c1c] border border-white/[0.08] rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <div>
            <div className="font-header text-[18px] text-white leading-none">{mealName}</div>
            <div className="text-[10px] text-white/40 mt-1">Chat with your nutritionist</div>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-white/[0.08] text-white/80 text-lg leading-none" aria-label="Close">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-[160px]">
          {legacyNote && (
            <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white/[0.07] px-3 py-2">
              <div className="text-[9px] font-bold uppercase tracking-wide text-[#6ccbde] mb-0.5">{legacyBy || 'Your nutritionist'}</div>
              <div className="text-[13px] text-white/90 whitespace-pre-wrap leading-snug">{legacyNote}</div>
            </div>
          )}
          {mine.length === 0 && !legacyNote && <p className="text-[12px] text-white/40 text-center py-8">No messages yet. Ask your nutritionist anything about this meal.</p>}
          {mine.map((m) => (
            <div key={m.id} className={`max-w-[85%] rounded-2xl px-3 py-2 ${m.from === 'client' ? 'ml-auto rounded-br-md bg-[#6ccbde]/20' : 'rounded-bl-md bg-white/[0.07]'}`}>
              {m.from === 'staff' && <div className="text-[9px] font-bold uppercase tracking-wide text-[#6ccbde] mb-0.5">{m.name || 'Your nutritionist'}</div>}
              <div className="text-[13px] text-white/90 whitespace-pre-wrap leading-snug">{m.text}</div>
              <div className="text-[9px] text-white/30 mt-1 text-right">{new Date(m.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        {err && <p className="px-4 text-[11px] text-[#ec2226]">{err}</p>}
        <div className="flex items-end gap-2 p-3 border-t border-white/[0.06]">
          <textarea rows={1} value={text} maxLength={500} onChange={(e) => setText(e.target.value)} placeholder="Write a message..."
            className="flex-1 resize-none max-h-28 bg-black/30 border border-white/[0.08] rounded-2xl px-3 py-2 text-[13px] text-white focus:outline-none focus:border-[#6ccbde]" />
          <button type="button" disabled={!text.trim() || busy} onClick={send} className="px-4 py-2 rounded-2xl text-[13px] font-bold text-white disabled:opacity-40" style={{ background: '#ec2226' }}>{busy ? '...' : 'Send'}</button>
        </div>
      </div>
    </div>,
    document.body
  );
};
