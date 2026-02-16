'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ScanContextProvider } from '../context/ScanContext';
import { ProfileContextProvider, useProfile } from '../context/ProfileContext';
import BottomNav from '../components/BottomNav';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProfileContextProvider>
      <ScanContextProvider>
        <LayoutGate>{children}</LayoutGate>
      </ScanContextProvider>
    </ProfileContextProvider>
  );
}

function LayoutGate({ children }: { children: React.ReactNode }) {
  const { profile, isLoading } = useProfile();
  const pathname = usePathname();
  const router = useRouter();
  const isOnboarding = pathname.startsWith('/onboarding');

  useEffect(() => {
    if (!isLoading && !profile && !isOnboarding) {
      router.replace('/onboarding');
    }
  }, [isLoading, profile, isOnboarding, router]);

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

  // On onboarding page — no bottom nav
  if (isOnboarding) {
    return <div className="page">{children}</div>;
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
