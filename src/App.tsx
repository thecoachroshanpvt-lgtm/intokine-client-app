import React, { useEffect, useState } from 'react';
import {
  initializeClientFirebaseApp,
  onAuthStateChanged,
  doc,
  getDoc,
  User,
} from './firebase';
import { WelcomeScreen } from './WelcomeScreen';
import { PostLoginWelcomeScreen } from './PostLoginWelcomeScreen';
import { ClientLoginScreen } from './ClientLoginScreen';
import { ProgramHomeScreen } from './ProgramHomeScreen';
import { ClientDashboard } from './ClientDashboard';

type ProgramCategory = 'ZAKI' | 'KATBA' | 'Personal Training' | 'Online Personal Training';

function App() {
  // Both welcome screens are meant to show every time the app opens,
  // not just once - so these are plain state with no localStorage
  // persistence, always starting fresh on load.
  const [showWelcome, setShowWelcome] = useState(true);
  const [showPostLoginWelcome, setShowPostLoginWelcome] = useState(true);
  const [showProgramHome, setShowProgramHome] = useState(true);

  const [authChecked, setAuthChecked] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [clientInfo, setClientInfo] = useState<{ clientId: string; name: string } | null>(null);
  const [programCategory, setProgramCategory] = useState<ProgramCategory | null>(null);
  const [lookupError, setLookupError] = useState('');

  useEffect(() => {
    const { auth } = initializeClientFirebaseApp();
    if (!auth) {
      setAuthChecked(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (user) {
        // Look up this user's linked client account, to get their
        // real clientId and name - the Firebase Auth account alone
        // doesn't carry this, it's stored in intokine_client_accounts.
        try {
          const { db } = initializeClientFirebaseApp();
          if (db) {
            const accountDoc = await getDoc(doc(db, 'intokine_client_accounts', user.uid));
            if (accountDoc.exists()) {
              const data = accountDoc.data();
              setClientInfo({ clientId: data.clientId, name: data.name });
              setLookupError('');

              // Also fetch their real client record, to get which
              // program (ZAKI/KATBA/Personal Training/Online) they're
              // actually enrolled in.
              const clientDoc = await getDoc(doc(db, 'intokine_clients', data.clientId));
              if (clientDoc.exists()) {
                const clientData = clientDoc.data();
                setProgramCategory((clientData.programCategory as ProgramCategory) || 'Personal Training');
              }
            } else {
              setLookupError('This login is not linked to a client account. Please contact your coach.');
            }
          }
        } catch (e) {
          setLookupError('Could not load your account. Please try again.');
        }
      } else {
        setClientInfo(null);
        setProgramCategory(null);
      }

      setAuthChecked(true);
    });

    return () => unsubscribe();
  }, []);

  // 1. Welcome screen always shows first, on every app open.
  if (showWelcome) {
    return <WelcomeScreen onContinue={() => setShowWelcome(false)} />;
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#1c1c1c] flex items-center justify-center">
        <div className="text-white/40 text-sm font-light">Loading...</div>
      </div>
    );
  }

  // 2. Not signed in - straight to login.
  if (!firebaseUser) {
    return <ClientLoginScreen />;
  }

  if (lookupError) {
    return (
      <div className="min-h-screen bg-[#1c1c1c] flex items-center justify-center p-5">
        <div className="max-w-sm text-center space-y-3">
          <p className="text-sm text-[#ec2226] font-light">{lookupError}</p>
        </div>
      </div>
    );
  }

  if (!clientInfo || !programCategory) {
    return (
      <div className="min-h-screen bg-[#1c1c1c] flex items-center justify-center">
        <div className="text-white/40 text-sm font-light">Loading your account...</div>
      </div>
    );
  }

  // 3. Signed in - show the second welcome screen before landing on
  // their program.
  if (showPostLoginWelcome) {
    return (
      <PostLoginWelcomeScreen
        clientName={clientInfo.name}
        onContinue={() => setShowPostLoginWelcome(false)}
      />
    );
  }

  // 4. Their own single program card - never all 4, only theirs.
  if (showProgramHome) {
    return (
      <ProgramHomeScreen
        clientName={clientInfo.name}
        programCategory={programCategory}
        onEnter={() => setShowProgramHome(false)}
      />
    );
  }

  // 5. What "Enter" leads to depends on the program. ZAKI and KATBA
  // are meant to be a fixed, standardized curriculum - not built yet,
  // so a simple placeholder for now. Personal Training and Online
  // Personal Training are the existing coach-and-client relationship,
  // which the current dashboard already reasonably represents.
  if (programCategory === 'ZAKI' || programCategory === 'KATBA') {
    return (
      <div className="min-h-screen bg-[#1c1c1c] flex items-center justify-center p-6 text-center">
        <div className="max-w-sm space-y-3">
          <h2 className="font-header text-2xl text-white">{programCategory} PROGRAM</h2>
          <p className="text-sm text-white/50 font-light leading-relaxed">
            Your {programCategory} curriculum is being built and will appear here soon.
          </p>
        </div>
      </div>
    );
  }

  return <ClientDashboard clientId={clientInfo.clientId} clientName={clientInfo.name} />;
}

export default App;
