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
import { ClientDashboard } from './ClientDashboard';

function App() {
  // Both welcome screens are meant to show every time the app opens,
  // not just once - so these are plain state with no localStorage
  // persistence, always starting fresh on load.
  const [showWelcome, setShowWelcome] = useState(true);
  const [showPostLoginWelcome, setShowPostLoginWelcome] = useState(true);

  const [authChecked, setAuthChecked] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [clientInfo, setClientInfo] = useState<{ clientId: string; name: string } | null>(null);
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
            } else {
              setLookupError('This login is not linked to a client account. Please contact your coach.');
            }
          }
        } catch (e) {
          setLookupError('Could not load your account. Please try again.');
        }
      } else {
        setClientInfo(null);
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

  if (!clientInfo) {
    return (
      <div className="min-h-screen bg-[#1c1c1c] flex items-center justify-center">
        <div className="text-white/40 text-sm font-light">Loading your account...</div>
      </div>
    );
  }

  // 3. Signed in (whether from a fresh login or an already-active
  // session on reopen) - show the second welcome screen before
  // landing on the dashboard.
  if (showPostLoginWelcome) {
    return (
      <PostLoginWelcomeScreen
        clientName={clientInfo.name}
        onContinue={() => setShowPostLoginWelcome(false)}
      />
    );
  }

  // 4. Home.
  return <ClientDashboard clientId={clientInfo.clientId} clientName={clientInfo.name} />;
}

export default App;
