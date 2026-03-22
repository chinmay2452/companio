import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';

export type User = {
  id: string;
  name?: string;
  exam_type?: string;
  exam_date?: string;
};

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export type Notification = {
  id: number;
  type: NotificationType;
  message: string;
  duration: number;
};

export type ActiveSubject = 'All' | 'Physics' | 'Chemistry' | 'Biology' | 'Maths';
export type ExamType = 'JEE' | 'NEET' | 'UPSC';

interface AppStore {
  // Auth Slice
  user: User | null;
  session: any | null;
  setUser: (user: User | null) => void;
  setSession: (session: any | null) => void;
  clearAuth: () => void;
  
  // App State Slice
  activeSubject: ActiveSubject;
  examType: ExamType;
  setActiveSubject: (subject: ActiveSubject) => void;
  setExamType: (type: ExamType) => void;

  // Notification Slice
  notifications: Notification[];
  addNotification: (type: NotificationType, message: string, duration?: number) => void;
  removeNotification: (id: number) => void;

  // Offline Slice
  isOnline: boolean;
  pendingSync: number;
  setOnline: (isOnline: boolean) => void;
  setPendingSync: (count: number) => void;
}

const useAppStore = create<AppStore>((set, get) => ({
  // Auth Slice
  user: null,
  session: null,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  clearAuth: () => set({ user: null, session: null }),

  // App State Slice
  activeSubject: 'All',
  examType: 'JEE',
  setActiveSubject: (activeSubject) => set({ activeSubject }),
  setExamType: (examType) => set({ examType }),

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

// Export typed selectors as requested
export const useUser = () => useAppStore((s) => s.user);
export const useNotifications = () => useAppStore((s) => s.notifications);
export const useIsOnline = () => useAppStore((s) => s.isOnline);
