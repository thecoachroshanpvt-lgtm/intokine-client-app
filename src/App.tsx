import React, { useEffect, useState } from 'react';
import {
  initializeClientFirebaseApp,
  onAuthStateChanged,
  doc,
  getDoc,
  User,
} from './firebase';
import { WelcomeScreen } from './WelcomeScreen';
import { ClientLoginScreen } from './ClientLoginScreen';
import { ProgramHomeScreen } from './ProgramHomeScreen';
import { CurriculumScreen } from './CurriculumScreen';
import { ClientDashboard } from './ClientDashboard';

type ProgramType = 'Weight Training' | 'Calisthenics' | 'CrossFit' | 'Hyrox Training' | 'Boxing Training' | 'Kickboxing Training' | 'Karate Training' | 'KATBA' | 'ZAKI';
type ServiceType = 'Offline Personal Training' | 'Online Personal Training' | 'Recorded Session' | 'Couple Training' | 'Diet Program' | 'Psychology Consultation';

function App() {
  // Both photo screens are meant to show every time the app opens,
  // not just once - so this is plain state with no localStorage
  // persistence, always starting fresh on load.
  const [showWelcome, setShowWelcome] = useState(true);
  const [showProgramHome, setShowProgramHome] = useState(true);

  const [authChecked, setAuthChecked] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [clientInfo, setClientInfo] = useState<{ clientId: string; name: string } | null>(null);
  const [programType, setProgramType] = useState<ProgramType | null>(null);
  const [service, setService] = useState<ServiceType | null>(null);
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

              // Also fetch their real client record, to get their
              // actual Program and Service - two separate fields now,
              // not the old single combined category.
              const clientDoc = await getDoc(doc(db, 'intokine_clients', data.clientId));
              if (clientDoc.exists()) {
                const clientData = clientDoc.data();
                setProgramType((clientData.programType as ProgramType) || 'Weight Training');
                setService((clientData.service as ServiceType) || 'Offline Personal Training');
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
        setProgramType(null);
        setService(null);
      }

      setAuthChecked(true);
    });

    return () => unsubscribe();
  }, []);

  // 1. Welcome/about-INTOKINE screen always shows first, on every
  // app open. First of exactly 2 photo screens.
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

  if (!clientInfo || !programType || !service) {
    return (
      <div className="min-h-screen bg-[#1c1c1c] flex items-center justify-center">
        <div className="text-white/40 text-sm font-light">Loading your account...</div>
      </div>
    );
  }

  // 3. Their own program card - the second of exactly 2 photo
  // screens, showing both their Program and Service together (e.g.
  // "KATBA - Personal Training"), and also where the "welcome back"
  // greeting lives now.
  if (showProgramHome) {
    return (
      <ProgramHomeScreen
        clientName={clientInfo.name}
        programType={programType}
        service={service}
        onEnter={() => setShowProgramHome(false)}
      />
    );
  }

  // 4. What "Enter" leads to depends on the combination. Recorded
  // Session clients on ZAKI or KATBA see the shared, fixed
  // curriculum. Everything else is the existing coach-and-client
  // relationship, which the current dashboard already represents.
  if (service === 'Recorded Session' && (programType === 'ZAKI' || programType === 'KATBA')) {
    return <CurriculumScreen programCategory={programType} />;
  }

  return <ClientDashboard clientId={clientInfo.clientId} clientName={clientInfo.name} />;
}

export default App;
