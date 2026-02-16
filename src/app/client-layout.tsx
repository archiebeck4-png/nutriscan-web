'use client';

import { ScanContextProvider } from '../context/ScanContext';
import BottomNav from '../components/BottomNav';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ScanContextProvider>
      <div className="page">{children}</div>
      <BottomNav />
    </ScanContextProvider>
  );
}
