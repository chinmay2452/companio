import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';

const useAppStore = create((set, get) => ({
  // Auth Slice
  user: null,
  session: null,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  clearAuth: () => set({ user: null, session: null }),
  
  // App State Slice
  activeSubject: 'All',
  examType: 'JEE',
  isOnboarded: localStorage.getItem("onboarded") === "true",
  setActiveSubject: (activeSubject) => set({ activeSubject }),
  setExamType: (examType) => set({ examType }),
  setOnboarded: (val) => {
    localStorage.setItem("onboarded", val ? "true" : "false");
    set({ isOnboarded: val });
  },

  // Notification Slice
  notifications: [],
  addNotification: (type, message, duration = 3000) => {
    const id = Date.now();
    set((state) => ({
      notifications: [...state.notifications, { id, type, message, duration }]
    }));
    
    if (duration > 0) {
      setTimeout(() => {
        get().removeNotification(id);
      }, duration);
    }
  },
  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter((n) => n.id !== id)
  })),

  // Offline Slice
  isOnline: typeof window !== 'undefined' ? navigator.onLine : true,
  pendingSync: 0,
  setOnline: (isOnline) => set({ isOnline }),
  setPendingSync: (pendingSync) => set({ pendingSync })
}));

// Initialization (Auth and Offline status)
if (typeof window !== 'undefined') {
  // Initial Auth Session Check
  supabase.auth.getSession().then(({ data: { session } }) => {
    useAppStore.getState().setSession(session);
    if (session?.user) {
      const u = session.user;
      useAppStore.getState().setUser({
        id: u.id,
        name: u.user_metadata?.name || '',
        exam_type: u.user_metadata?.exam_type || '',
        exam_date: u.user_metadata?.exam_date || ''
      });
    }
  });

  // Listen for Auth changes
  supabase.auth.onAuthStateChange((_event, session) => {
    useAppStore.getState().setSession(session);
    if (session?.user) {
      const u = session.user;
      useAppStore.getState().setUser({
        id: u.id,
        name: u.user_metadata?.name || '',
        exam_type: u.user_metadata?.exam_type || '',
        exam_date: u.user_metadata?.exam_date || ''
      });
    } else {
      useAppStore.getState().clearAuth();
    }
  });

  // Attach online/offline listeners
  window.addEventListener('online', () => useAppStore.getState().setOnline(true));
  window.addEventListener('offline', () => useAppStore.getState().setOnline(false));
}

export default useAppStore;

export const useUser = () => useAppStore((s) => s.user);
export const useNotifications = () => useAppStore((s) => s.notifications);
export const useIsOnline = () => useAppStore((s) => s.isOnline);
