import React, { useState } from 'react';
import { PasswordInput } from './PasswordInput';
import { initializeClientFirebaseApp, signInWithEmailAndPassword, sendPasswordResetEmail } from './firebase';

export const ClientLoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  const handleForgot = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setResetMessage('Type your email above first, then tap "Forgot password?" again.');
      return;
    }
    try {
      const { auth } = initializeClientFirebaseApp();
      if (auth) await sendPasswordResetEmail(auth, trimmed);
    } catch { /* same message either way, so nobody can test which emails exist */ }
    setResetMessage('If that email has an account, a reset link has been sent. Check your inbox and spam folder.');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { auth } = initializeClientFirebaseApp();
      if (!auth) throw new Error('Could not connect. Please try again.');
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    } catch (err: any) {
      const code: string = err?.code || '';
      let message: string;
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        message = 'Incorrect email or password. Please try again.';
      } else if (code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      } else if (code === 'auth/user-disabled') {
        message = 'This account has been disabled. Please contact your coach.';
      } else if (code === 'auth/too-many-requests') {
        message = 'Too many attempts. Please wait a few minutes and try again.';
      } else if (code === 'auth/network-request-failed') {
        message = 'No internet connection. Please check your connection and try again.';
      } else if (code === 'auth/web-storage-unsupported' || code === 'auth/operation-not-supported-in-this-environment') {
        message = 'Your browser is blocking storage. Open this link in Safari or Chrome (not inside another app) and turn off Private Browsing.';
      } else if (code.startsWith('auth/requests-from') || code === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.' || code === 'auth/invalid-api-key' || code === 'auth/operation-not-allowed' || code === 'auth/unauthorized-domain') {
        message = `This app link is not authorised yet. Please tell your coach (${code}).`;
      } else {
        message = `Could not sign in${code ? ` (${code})` : ''}. Please try again.`;
      }
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
      <div className="w-full max-w-sm space-y-10 relative z-10">
        <div className="flex flex-col items-center text-center">
          <img src="/brand-icon.png" alt="INTOKINE" className="h-5 w-auto object-contain" />
          <p className="mt-5 text-[10px] text-white/55 font-semibold uppercase tracking-[0.18em] whitespace-nowrap">Sign in to see your training plan</p>
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
            <PasswordInput
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

          <button
            type="button"
            onClick={handleForgot}
            className="w-full text-center text-[11px] text-white/50 underline font-light"
          >
            Forgot password?
          </button>
          {resetMessage && (
            <p className="text-[11px] text-[#6ccbde] text-center font-light">{resetMessage}</p>
          )}
        </form>

        <p className="text-center text-[11px] text-white/40 font-light">
          Don't have login details? Ask your coach.
        </p>
      </div>
    </div>
  );
};
