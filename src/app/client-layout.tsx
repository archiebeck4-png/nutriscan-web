'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ScanContextProvider } from '../context/ScanContext';
import { ProfileContextProvider, useProfile } from '../context/ProfileContext';
import { AuthContextProvider, useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import BottomNav from '../components/BottomNav';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthContextProvider>
      <ProfileContextProvider>
        <ScanContextProvider>
          <LayoutGate>{children}</LayoutGate>
        </ScanContextProvider>
      </ProfileContextProvider>
    </AuthContextProvider>
  );
}

function LayoutGate({ children }: { children: React.ReactNode }) {
  const { user, isGuest, isLoading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname.startsWith('/login');
  const isOnboarding = pathname.startsWith('/onboarding');
  const isDebug = pathname.startsWith('/debug');

  const isLoading = authLoading || profileLoading;
  const authEnabled = !!supabase;

  useEffect(() => {
    if (isLoading) return;

    // Auth gate: if Supabase is configured and no user/guest, redirect to login
    if (authEnabled && !user && !isGuest && !isLogin) {
      router.replace('/login');
      return;
    }

    // If authenticated (or guest or no auth) and on login page, redirect away
    if (isLogin && (!authEnabled || user || isGuest)) {
      router.replace(profile ? '/' : '/onboarding');
      return;
    }

    // Profile gate: no profile → onboarding
    if (!profile && !isOnboarding && !isDebug && !isLogin) {
      router.replace('/onboarding');
    }
  }, [isLoading, authEnabled, user, isGuest, profile, isLogin, isOnboarding, isDebug, router]);

  if (isLoading) {
    return (
      <div
        className="page"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <span style={{ color: '#8e8e93', fontSize: 17 }}>Loading...</span>
      </div>
    );
  }

  // Login page — no wrapper, no bottom nav
  if (isLogin) {
    return <>{children}</>;
  }

  // On onboarding or debug pages — no bottom nav
  if (isOnboarding || isDebug) {
    return <div className="page">{children}</div>;
  }

  // Auth required but no user and not guest — will redirect via useEffect
  if (authEnabled && !user && !isGuest) {
    return null;
  }

  // No profile and not on onboarding — will redirect via useEffect
  if (!profile) {
    return null;
  }

  return (
    <>
      <div className="page">{children}</div>
      <BottomNav />
    </>
  );
}
