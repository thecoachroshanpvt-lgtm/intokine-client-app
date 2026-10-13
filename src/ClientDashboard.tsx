import React, { useEffect, useState } from 'react';
import { ScheduleScreen } from './ScheduleScreen';
import { PlansScreen } from './PlansScreen';
import { ProgressScreen } from './ProgressScreen';
import { DietScreen } from './DietScreen';
import {
  initializeClientFirebaseApp,
  signOut,
} from './firebase';

interface ClientDashboardProps {
  clientId: string;
  clientName: string;
}

interface ScheduledSession {
  id: string;
  date: string;
  time: string;
  coachName: string;
  sessionType: string;
  location: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled' | 'Postponed';
}

type DashboardTab = 'plans' | 'schedule' | 'progress' | 'diet';

export const ClientDashboard: React.FC<ClientDashboardProps> = ({ clientId, clientName }) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('plans');
  // Pull-down-to-refresh (like Instagram): pull from the top, release past the threshold (data on every screen is already live, so this just confirms it is up to date without reloading anything).
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullRef = React.useRef({ startY: 0, startX: 0, active: false, dist: 0, busy: false });
  useEffect(() => {
    const THRESHOLD = 70;
    const onStart = (e: TouchEvent) => {
      const st = pullRef.current;
      if (st.busy || document.body.hasAttribute('data-popup-open') || window.scrollY > 0) { st.active = false; return; }
      // Swipes that start on a sideways-scrolling row (like the Progress top tabs) are never a pull-to-refresh.
      const tgt = e.target as HTMLElement | null;
      if (tgt && tgt.closest && tgt.closest('.no-scrollbar, [data-no-pull]')) { st.active = false; return; }
      st.startY = e.touches[0].clientY;
      st.startX = e.touches[0].clientX;
      st.active = true;
      st.dist = 0;
    };
    const onMove = (e: TouchEvent) => {
      const st = pullRef.current;
      if (!st.active) return;
      const dy = e.touches[0].clientY - st.startY;
      const dx = e.touches[0].clientX - st.startX;
      // Mostly sideways movement: not a pull, leave it alone.
      if (st.dist === 0 && Math.abs(dx) > Math.abs(dy)) { st.active = false; return; }
      if (dy <= 0 || window.scrollY > 0) { if (st.dist > 0) { st.dist = 0; setPull(0); } return; }
      st.dist = Math.min(dy * 0.5, 110);
      setPull(st.dist);
      if (e.cancelable) e.preventDefault();
    };
    const onEnd = () => {
      const st = pullRef.current;
      if (!st.active) return;
      st.active = false;
      if (st.dist >= THRESHOLD && !st.busy) {
        st.busy = true;
        setRefreshing(true);
        setPull(THRESHOLD * 0.7);
        window.setTimeout(() => {
          setRefreshing(false);
          setPull(0);
          st.busy = false;
        }, 1100);
      } else {
        setPull(0);
      }
      st.dist = 0;
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  const handleSignOut = async () => {
    const { auth } = initializeClientFirebaseApp();
    if (auth) await signOut(auth);
  };

  return (
    <div className="min-h-screen bg-[#1c1c1c] pb-20">
      {(pull > 4 || refreshing) && (
        <div
          className="fixed left-0 right-0 z-[45] flex justify-center pointer-events-none"
          style={{ top: 10, transform: `translateY(${Math.min(pull, 80)}px)`, transition: pull === 0 ? 'transform 0.2s' : 'none' }}
        >
          <div className="w-9 h-9 rounded-full bg-[#242426] border border-white/[0.12] shadow-lg flex items-center justify-center">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6ccbde"
              strokeWidth="2.5"
              strokeLinecap="round"
              style={{
                transform: refreshing ? undefined : `rotate(${pull * 4}deg)`,
                animation: refreshing ? 'ikSpin 0.8s linear infinite' : undefined,
                opacity: Math.min(1, pull / 40 + (refreshing ? 1 : 0)),
              }}
            >
              <path d="M21 12a9 9 0 1 1-3-6.7" />
              <path d="M21 3v6h-6" />
            </svg>
          </div>
        </div>
      )}
      <style>{`@keyframes ikSpin { to { transform: rotate(360deg); } }`}</style>


      {/* Plans tab */}
      <div className={activeTab === 'plans' ? '' : 'hidden'}>
        <PlansScreen clientId={clientId} clientName={clientName} />
      </div>

      {/* Schedule tab */}
      <div className={activeTab === 'schedule' ? '' : 'hidden'}>
        <ScheduleScreen clientId={clientId} clientName={clientName} />
      </div>

      {/* Progress tab */}
      <div className={activeTab === 'progress' ? '' : 'hidden'}>
        <ProgressScreen clientId={clientId} />
      </div>

      {/* Diet tab */}
      {activeTab === 'diet' && <DietScreen clientId={clientId} />}

      {/* Bottom navigation */}
      <div className="bottom-nav fixed bottom-0 left-0 right-0 z-30 bg-[#1c1c1c]/95 backdrop-blur-md border-t border-white/[0.08]">
        <div className="flex items-center justify-around max-w-4xl mx-auto px-2 py-2">
          {[
            {
              key: 'plans' as DashboardTab,
              label: 'Home',
              icon: (active: boolean) => (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#ec2226' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 11.5 12 4l9 7.5" />
                  <path d="M5 10v10h14V10" />
                  <path d="M10 20v-5h4v5" />
                </svg>
              ),
            },
            {
              key: 'schedule' as DashboardTab,
              label: 'Schedule',
              icon: (active: boolean) => (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#ec2226' : 'currentColor'} strokeWidth="1.8">
                  <rect x="3" y="4" width="18" height="17" rx="2" />
                  <path d="M3 9h18M8 2v4M16 2v4" />
                </svg>
              ),
            },
            {
              key: 'diet' as DashboardTab,
              label: 'Diet',
              icon: (active: boolean) => (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#ec2226' : 'currentColor'} strokeWidth="1.8">
                  <path d="M7 2v6a2 2 0 0 0 4 0V2M9 8v14M18 2c-2 1-3 3-3 6s1 5 3 6v8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ),
            },
            {
              key: 'progress' as DashboardTab,
              label: 'Progress',
              icon: (active: boolean) => (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#ec2226' : 'currentColor'} strokeWidth="1.8">
                  <path d="M4 19V13M10 19V9M16 19V5M22 19H2" strokeLinecap="round" />
                </svg>
              ),
            },
          ].map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex flex-col items-center gap-1 px-4 py-1.5 relative"
              >
                {active && (
                  <span
                    className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-[2.5px] rounded-full"
                    style={{ background: 'linear-gradient(90deg, #ec2226, #6ccbde)' }}
                  />
                )}
                <span className={active ? '' : 'text-white/40'}>{tab.icon(active)}</span>
                <span className={`text-[9px] font-bold tracking-wide ${active ? 'text-white' : 'text-white/40'}`}>
                  {tab.label.toUpperCase()}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
