import React, { useEffect, useState } from 'react';
import { initializeClientFirebaseApp, collection, query, where, onSnapshot, doc } from './firebase';

// Contact your coach on WhatsApp.
// The coach is the one assigned to this client (set in Coach OS / Owner OS); their WhatsApp number is the one the Owner types in Settings -> Staff Accounts.
// If no real number is set yet, nothing is shown (no broken button).

const realNumber = (n?: string) => {
  const d = (n || '').replace(/\D/g, '');
  return !!n && !n.includes('@') && d.length >= 8 && d !== '971500000000' && !/^(\d)\1+$/.test(d);
};

const WaIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 21l1.6-4.7A8.5 8.5 0 1 1 8 19.5L3 21z" />
    <path d="M9 9.5c.3 2 2.5 4.2 4.5 4.5l1.3-1.2-1.8-1-.8.7c-.8-.4-1.5-1.1-1.9-1.9l.7-.8-1-1.8L9 9.5z" fill={color} stroke="none" />
  </svg>
);

export function useCoachWhatsapp(clientId: string, fallbackName?: string): { name: string; link: (text?: string) => string } | null {
  const [assigned, setAssigned] = useState('');
  const [number, setNumber] = useState('');
  const name = assigned || fallbackName || '';

  useEffect(() => {
    const { db } = initializeClientFirebaseApp();
    if (!db) return;
    return onSnapshot(doc(db, 'intokine_clients', clientId), (d) => setAssigned(String((d.data() as any)?.assignedCoach || '')), () => {});
  }, [clientId]);

  useEffect(() => {
    setNumber('');
    if (!name) return;
    const { db } = initializeClientFirebaseApp();
    if (!db) return;
    return onSnapshot(
      query(collection(db, 'intokine_staff_accounts'), where('name', '==', name)),
      (snap) => setNumber(String((snap.docs[0]?.data() as any)?.whatsapp || '')),
      () => {}
    );
  }, [name]);

  if (!name || !realNumber(number)) return null;
  return { name, link: (text?: string) => `https://wa.me/${number.replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}` };
}

// Round button for the top of Home, next to Settings.
export const CoachWhatsappButton: React.FC<{ clientId: string }> = ({ clientId }) => {
  const coach = useCoachWhatsapp(clientId);
  if (!coach) return null;
  return (
    <a
      href={coach.link(`Hi Coach ${coach.name}, `)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Message coach ${coach.name} on WhatsApp`}
      className="w-10 h-10 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-white/70 hover:text-white active:scale-95 transition"
    >
      <WaIcon size={20} color="currentColor" />
    </a>
  );
};

// Card for the bottom of the suggested workout page.
export const ContactCoachCard: React.FC<{ clientId: string; coachName?: string; workoutTitle: string }> = ({ clientId, coachName, workoutTitle }) => {
  const coach = useCoachWhatsapp(clientId, coachName);
  if (!coach) return null;
  return (
    <a
      href={coach.link(`Hi Coach ${coach.name}, I have a question about my workout "${workoutTitle}". `)}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-4 flex items-center gap-3 rounded-2xl bg-[#252525] border border-white/[0.06] p-3.5 active:scale-[0.99] transition"
    >
      <span className="w-10 h-10 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center shrink-0 text-white/70">
        <WaIcon size={20} color="currentColor" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-subheader text-[16px] text-white leading-tight">Contact your coach</span>
        <span className="block text-[11px] text-white/50 truncate">Message {coach.name} on WhatsApp</span>
      </span>
      <span className="text-[11px] font-bold text-white/70 border border-white/[0.15] rounded-full px-3 py-1 shrink-0">Chat</span>
    </a>
  );
};
