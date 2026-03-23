import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';

export const useRealtimeStore = create((set, get) => ({
  data: {
    users: null,
    cards: [],
    attempts: [],
    daily_plans: [],
    weak_topics: [],
    micro_sessions: [],
    tutor_sessions: [],
  },
  loading: true,
  subscriptions: [],

  initRealtime: async (userId) => {
    if (!userId) return;

    set({ loading: true });

    // 1. Fetch initial data concurrently
    const [
      { data: users },
      { data: cards },
      { data: attempts },
      { data: plans },
      { data: weakTopics },
      { data: microSessions },
      { data: tutorSessions }
    ] = await Promise.all([
      supabase.from('users').select('*').eq('id', userId).single().then(res => res.error ? {data:null} : res),
      supabase.from('cards').select('*').eq('user_id', userId).then(res => res.error ? {data:[]} : res),
      supabase.from('attempts').select('*').eq('user_id', userId).order('created_at', { ascending: false }).then(res => res.error ? {data:[]} : res),
      supabase.from('daily_plans').select('*').eq('user_id', userId).then(res => res.error ? {data:[]} : res),
      supabase.from('weak_topics').select('*').eq('user_id', userId).then(res => res.error ? {data:[]} : res),
      supabase.from('micro_sessions').select('*').eq('user_id', userId).then(res => res.error ? {data:[]} : res),
      supabase.from('tutor_sessions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).then(res => res.error ? {data:[]} : res),
    ]);

    set({
      data: {
        users: users || null,
        cards: cards || [],
        attempts: attempts || [],
        daily_plans: plans || [],
        weak_topics: weakTopics || [],
        micro_sessions: microSessions || [],
        tutor_sessions: tutorSessions || [],
      },
      loading: false
    });

    // 2. Setup Realtime Subscriptions
    const tables = ['users', 'cards', 'attempts', 'daily_plans', 'weak_topics', 'micro_sessions', 'tutor_sessions'];
    
    // Cleanup any existing
    const existingSubs = get().subscriptions;
    existingSubs.forEach(s => supabase.removeChannel(s));

    const newSubs = tables.map(table => {
      const channel = supabase.channel(`public:${table}:${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: table, filter: `user_id=eq.${userId}` }, (payload) => {
          
          set((state) => {
            const currentData = { ...state.data };
            let arr = currentData[table];

            if (table === 'users') {
              if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
                currentData.users = payload.new;
              }
            } else {
              // Array-based tables
              if (!Array.isArray(arr)) arr = [];
              if (payload.eventType === 'INSERT') {
                arr = [payload.new, ...arr];
              } else if (payload.eventType === 'UPDATE') {
                arr = arr.map(item => item.id === payload.new.id ? payload.new : item);
              } else if (payload.eventType === 'DELETE') {
                arr = arr.filter(item => item.id !== payload.old.id);
              }
              currentData[table] = arr;
            }

            return { data: currentData };
          });
        })
        .subscribe();
      return channel;
    });

    // Special case: `users` table filter uses `id=eq.${userId}` instead of `user_id`
    const userChannel = supabase.channel(`public:users:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `id=eq.${userId}` }, (payload) => {
        set((state) => {
          const currentData = { ...state.data };
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') currentData.users = payload.new;
          return { data: currentData };
        });
      })
      .subscribe();
    
    newSubs.push(userChannel);

    set({ subscriptions: newSubs });
  },

  cleanup: () => {
    const subs = get().subscriptions;
    subs.forEach(s => supabase.removeChannel(s));
    set({ subscriptions: [], data: { users: null, cards: [], attempts: [], daily_plans: [], weak_topics: [], micro_sessions: [], tutor_sessions: [] } });
  }
}));
