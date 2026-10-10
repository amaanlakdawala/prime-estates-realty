'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthCard from '@/components/AuthCard';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) {
      setLoading(false);
      setError('Email or password is incorrect.');
      return;
    }
    const next = params.get('next');
    router.replace(next && next.startsWith('/admin') ? next : '/admin');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="field-label">Work email</span>
        <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
      </label>
      <label className="block">
        <span className="field-label">Password</span>
        <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </label>
      {error && <p className="text-sm font-medium text-red-700" role="alert">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
      <p className="text-center text-sm text-muted">Forgot your password? Ask your admin to set a new one.</p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthCard title="Employee sign in" subtitle="For staff managing property listings.">
      <Suspense fallback={null}><LoginForm /></Suspense>
    </AuthCard>
  );
}
