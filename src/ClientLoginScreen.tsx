import React, { useState } from 'react';
import { initializeClientFirebaseApp, signInWithEmailAndPassword } from './firebase';

interface ClientLoginScreenProps {
  onLoginError?: (message: string) => void;
}

export const ClientLoginScreen: React.FC<ClientLoginScreenProps> = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { auth } = initializeClientFirebaseApp();
      if (!auth) throw new Error('Could not connect. Please try again.');
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      // Successful sign-in is picked up by the onAuthStateChanged
      // listener in App.tsx - nothing further needed here.
    } catch (err: any) {
      const message = err?.code === 'auth/invalid-credential' || err?.code === 'auth/wrong-password' || err?.code === 'auth/user-not-found'
        ? 'Incorrect email or password. Please try again.'
        : 'Could not sign in. Please check your connection and try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0d10] flex items-center justify-center p-5">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          {/* Placeholder branding - replace with real logo/name once decided */}
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center shadow-lg">
            <span className="text-2xl font-black text-white">P</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Your Program</h1>
          <p className="text-xs text-neutral-400">Sign in to see your training plan</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-3">
          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              {error}
            </div>
          )}

          <div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-2xl px-4 py-3.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-2xl px-4 py-3.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-pink-500 hover:opacity-95 disabled:opacity-50 text-white font-bold text-sm rounded-2xl shadow-lg transition"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-[11px] text-neutral-500">
          Don't have login details? Ask your coach.
        </p>
      </div>
    </div>
  );
};
