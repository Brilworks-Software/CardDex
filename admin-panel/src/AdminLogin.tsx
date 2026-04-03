import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';

type Props = { onLogin: () => void };

export default function AdminLogin({ onLogin }: Props) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      // Verify the admin custom claim before granting access
      const token = await cred.user.getIdTokenResult();
      if (!token.claims.admin) {
        await auth.signOut();
        setError('This account does not have admin access. Run: node admin/set-admin-claim.js ' + email.trim());
        return;
      }
      onLogin();
    } catch (e: any) {
      const msg: string = e?.code ?? '';
      if (msg === 'auth/invalid-credential' || msg === 'auth/wrong-password' || msg === 'auth/user-not-found') {
        setError('Invalid email or password.');
      } else if (msg === 'auth/too-many-requests') {
        setError('Too many attempts. Wait a moment and try again.');
      } else {
        setError(e?.message ?? 'Login failed. Check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1 className="login-logo">CardDex Admin</h1>
        <p className="login-sub">Sign in to manage cards and QR codes</p>

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-row">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              autoComplete="email"
              autoFocus
            />
          </div>
          <div className="form-row">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="login-hint">
          First time? Create an account in the mobile app, then run:<br />
          <code>node admin/set-admin-claim.js your@email.com</code>
        </p>
      </div>
    </div>
  );
}
