import React, { useEffect, useState } from 'react';
import useAppStore, { useIsOnline } from '../store/useAppStore';

export default function OfflineBanner() {
  const isOnline = useIsOnline();
  const pendingSync = useAppStore(s => s.pendingSync);
  const [showReconnected, setShowReconnected] = useState(false);
  const [prevOnline, setPrevOnline] = useState(isOnline);

  useEffect(() => {
    if (!prevOnline && isOnline && pendingSync > 0) {
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(timer);
    }
    setPrevOnline(isOnline);
  }, [isOnline, prevOnline, pendingSync]);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
  }, []);

  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 w-full z-50 bg-yellow-400 text-yellow-900 font-bold text-center px-4 py-3 shadow-md transform transition-transform duration-300 ease-in-out">
        ⚠ You're offline — studying from cached data. Attempts will sync when reconnected.
      </div>
    );
  }

  if (showReconnected) {
    return (
      <div className="fixed top-0 left-0 right-0 w-full z-50 bg-green-500 text-white font-bold text-center px-4 py-3 shadow-md transform transition-transform duration-300 ease-in-out">
        ✓ Back online — syncing {pendingSync} queued attempts...
      </div>
    );
  }

  return null;
}
