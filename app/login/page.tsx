'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseClient } from '@supabase/auth-helpers-react';

export default function LoginPage() {
  const router = useRouter();
  const supabase = useSupabaseClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/auth/callback' },
    });
    if (error) {
      console.error('Error during Google sign-in:', error);
      setError(error.message);
    }
  };

  const handleEmailLogin = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      console.error('Error during email sign-in:', error);
      setError(error.message);
    } else {
      router.push('/auth-redirect');
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ padding: 24, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', textAlign: 'center', width: 320 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 16px',
            marginBottom: 12,
            borderRadius: 4,
            border: '1px solid #ccc',
            fontSize: 16,
            boxSizing: 'border-box',
          }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 16px',
            marginBottom: 12,
            borderRadius: 4,
            border: '1px solid #ccc',
            fontSize: 16,
            boxSizing: 'border-box',
          }}
        />
        <button
          onClick={handleEmailLogin}
          disabled={loading}
          style={{
            backgroundColor: '#333',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: 4,
            cursor: loading ? 'default' : 'pointer',
            fontSize: 16,
            width: '100%',
            marginBottom: 16,
          }}
        >
          {loading ? 'Signing in...' : 'Sign in with Email'}
        </button>
        <button
          onClick={handleGoogleLogin}
          style={{
            backgroundColor: '#4285F4',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 16,
            width: '100%',
          }}
        >
          Sign in with Google
        </button>
        {error && (
          <div style={{ marginTop: 16, color: 'red', fontSize: 14 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
