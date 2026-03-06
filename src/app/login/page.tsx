'use client';

import { useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import styles from './page.module.css';

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setConfirmationSent(false);
    setLoading(true);

    if (tab === 'login') {
      const { error: err } = await signIn(email, password);
      if (err) setError(err);
    } else {
      const { error: err, needsConfirmation } = await signUp(email, password);
      if (err) {
        setError(err);
      } else if (needsConfirmation) {
        setConfirmationSent(true);
      }
    }

    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>ScaleShift</h1>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'login' ? styles.tabActive : ''}`}
            onClick={() => { setTab('login'); setError(null); setConfirmationSent(false); }}
          >
            Log In
          </button>
          <button
            className={`${styles.tab} ${tab === 'signup' ? styles.tabActive : ''}`}
            onClick={() => { setTab('signup'); setError(null); setConfirmationSent(false); }}
          >
            Sign Up
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <input
            className={styles.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <input
            className={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={6}
          />

          {error && <p className={styles.error}>{error}</p>}
          {confirmationSent && (
            <p className={styles.success}>
              Check your email for a confirmation link, then log in.
            </p>
          )}

          <button className={styles.submit} type="submit" disabled={loading}>
            {loading ? 'Loading...' : tab === 'login' ? 'Log In' : 'Sign Up'}
          </button>
        </form>
      </div>
    </div>
  );
}
