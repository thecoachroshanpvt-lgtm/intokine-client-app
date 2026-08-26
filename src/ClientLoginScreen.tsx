import React, { useState } from 'react';
import { initializeClientFirebaseApp, signInWithEmailAndPassword } from './firebase';

export const ClientLoginScreen: React.FC = () => {
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
    <div className="min-h-screen bg-[#1c1c1c] flex items-center justify-center p-5 relative overflow-hidden">
      <div
        className="absolute pointer-events-none hidden sm:block"
        style={{
          top: '15%',
          left: '-10%',
          width: '60%',
          height: '2px',
          background: 'linear-gradient(90deg, transparent, #6ccbde, transparent)',
          transform: 'rotate(-20deg)',
          opacity: 0.25,
        }}
      />
      <div
        className="absolute pointer-events-none hidden sm:block"
        style={{
          bottom: '10%',
          right: '-10%',
          width: '60%',
          height: '2px',
          background: 'linear-gradient(90deg, transparent, #ec2226, transparent)',
          transform: 'rotate(-20deg)',
          opacity: 0.2,
        }}
      />
      <div className="w-full max-w-sm space-y-8 relative z-10">
        <div className="text-center space-y-3">
          <div
            className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center shadow-xl"
            style={{ background: 'linear-gradient(135deg, #ec2226, #6ccbde)' }}
          >
            <span className="font-header text-2xl text-white">IK</span>
          </div>
          <h1 className="font-header text-2xl text-white tracking-wide">INTOKINE</h1>
          <p className="text-xs text-white/50 font-light">Sign in to see your training plan</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-3">
          {error && (
            <div className="text-xs text-white bg-[#ec2226]/15 border border-[#ec2226]/40 rounded-xl p-3 font-light">
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
              className="w-full bg-white/[0.06] border border-white/[0.1] rounded-2xl px-4 py-3.5 text-sm text-white placeholder-white/40 font-light focus:outline-none focus:border-[#6ccbde]"
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
              className="w-full bg-white/[0.06] border border-white/[0.1] rounded-2xl px-4 py-3.5 text-sm text-white placeholder-white/40 font-light focus:outline-none focus:border-[#6ccbde]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl text-white font-bold text-sm shadow-xl disabled:opacity-50 transition active:scale-[0.98]"
            style={{ background: 'linear-gradient(90deg, #ec2226, #6ccbde)' }}
          >
            {loading ? 'SIGNING IN...' : 'SIGN IN'}
          </button>
        </form>

        <p className="text-center text-[11px] text-white/40 font-light">
          Don't have login details? Ask your coach.
        </p>
      </div>
    </div>
  );
};
