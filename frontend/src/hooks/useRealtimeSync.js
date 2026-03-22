import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useRealtimeTable(tableName, userId, initialFetch) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    initialFetch()
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err);
          setLoading(false);
        }
      });

    const channel = supabase.channel(`realtime_${tableName}_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          if (!isMounted) return;
          
          if (payload.eventType === 'INSERT') {
            setData((prev) => {
              if (prev.some(item => item.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            });
          } else if (payload.eventType === 'UPDATE') {
            setData((prev) =>
              prev.map((item) => (item.id === payload.new.id ? payload.new : item))
            );
          } else if (payload.eventType === 'DELETE') {
            setData((prev) => prev.filter((item) => item.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [tableName, userId, initialFetch]);

  return { data, loading, error };
}

export function useLiveDueCards(userId) {
  const fetchDueCards = useCallback(async () => {
    const res = await fetch(`/api/srs/due/${userId}`);
    if (!res.ok) throw new Error('Failed to fetch due cards');
    return res.json();
  }, [userId]);

  const { data, loading, error } = useRealtimeTable('cards', userId, fetchDueCards);

  const dueCards = data.filter((card) => {
    if (!card.due_date) return true;
    const today = new Date().toISOString().split('T')[0];
    return card.due_date <= today;
  });

  return { dueCards, loading, error };
}

export function useLiveDailyPlan(userId) {
  const fetchPlan = useCallback(async () => {
    const res = await fetch(`/api/planner/${userId}/today`);
    if (!res.ok) {
      if (res.status === 404) return [];
      throw new Error('Failed to fetch daily plan');
    }
    const json = await res.json();
    if (Array.isArray(json)) return json; 
    return json.id ? [json] : []; 
  }, [userId]);

  const { data, loading, error } = useRealtimeTable('daily_plans', userId, fetchPlan);

  const todayStr = new Date().toISOString().split('T')[0];
  const todaysRow = data.find((row) => row.plan_date === todayStr) || data[0];
  const plan = todaysRow?.plan_json || [];

  return { plan, loading, error };
}

export function useLiveStats(userId) {
  const [stats, setStats] = useState({
    cardsDue: 0,
    totalCards: 0,
    streak: 0,
    weakTopics: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/srs/stats/${userId}`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      const json = await res.json();
      setStats(json);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    let isMounted = true;
    
    // Initial fetch
    fetchStats();

    // Re-fetch on cards or attempts tables changing
    const channelCards = supabase.channel(`stats_cards_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cards', filter: `user_id=eq.${userId}` },
        () => { if (isMounted) fetchStats(); }
      )
      .subscribe();

    const channelAttempts = supabase.channel(`stats_attempts_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attempts', filter: `user_id=eq.${userId}` },
        () => { if (isMounted) fetchStats(); }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channelCards);
      supabase.removeChannel(channelAttempts);
    };
  }, [userId, fetchStats]);

  return { stats, loading, error };
}
