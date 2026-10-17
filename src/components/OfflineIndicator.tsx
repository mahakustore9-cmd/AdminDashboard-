import React from 'react';
import { useOnlineStatus } from '../hooks/usePWAInstall';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-18 md:bottom-4 left-4 right-4 md:right-auto md:max-w-md z-50 flex items-center gap-3 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-medium text-white shadow-xl animate-bounce-subtle">
      <WifiOff className="w-4 h-4 shrink-0 text-amber-100" />
      <div>
        <p className="font-semibold">Offline Mode</p>
        <p className="text-amber-100 text-[11px]">Network disconnected. Cached data is currently displayed.</p>
      </div>
    </div>
  );
};
