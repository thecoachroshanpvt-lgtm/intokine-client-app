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

// Small pill at the top right of the suggested workout page, in line with the Back button.
export const ContactCoachPill: React.FC<{ clientId: string; coachName?: string; workoutTitle: string }> = ({ clientId, coachName, workoutTitle }) => {
  const coach = useCoachWhatsapp(clientId, coachName);
  if (!coach) return null;
  return (
    <a
      href={coach.link(`Hi Coach ${coach.name}, I have a question about my workout "${workoutTitle}". `)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Contact coach ${coach.name} on WhatsApp`}
      className="inline-flex items-center gap-2 pl-1.5 pr-3.5 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-white/70 hover:text-white active:scale-95 transition"
    >
      <span className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center">
        <WaIcon size={16} color="currentColor" />
      </span>
      <span className="font-subheader text-[13px] tracking-wide leading-none">Contact coach</span>
    </a>
  );
};
