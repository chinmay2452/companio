import { openDB } from 'idb';
import { useState, useEffect } from 'react';

const DB_NAME = 'companio-offline';
const DB_VERSION = 1;

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('cards_cache')) {
          db.createObjectStore('cards_cache', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('plan_cache')) {
          db.createObjectStore('plan_cache', { keyPath: 'user_id' });
        }
        if (!db.objectStoreNames.contains('attempt_queue')) {
          db.createObjectStore('attempt_queue', { keyPath: 'id', autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

export async function syncCardsOffline(cards) {
  const db = await getDB();
  const tx = db.transaction('cards_cache', 'readwrite');
  for (const card of cards) {
    tx.store.put(card);
  }
  await tx.done;
}

export async function syncPlanOffline(userId, planData) {
  const db = await getDB();
  await db.put('plan_cache', { user_id: userId, planData });
}

export async function getOfflineCards(userId) {
  const db = await getDB();
  const allCards = await db.getAll('cards_cache');
  return allCards.filter((c) => c.user_id === userId);
}

export async function getOfflinePlan(userId) {
  const db = await getDB();
  const res = await db.get('plan_cache', userId);
  return res ? res.planData : null;
}

export async function queueAttempt(attemptData) {
  const db = await getDB();
  await db.add('attempt_queue', attemptData);
  
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then(reg => {
          return reg.sync.register('sync-attempts');
      }).catch(console.error);
  }
}

export async function flushAttemptQueue() {
  const db = await getDB();
  return db.getAll('attempt_queue');
}

export async function clearAttemptQueue() {
  const db = await getDB();
  await db.clear('attempt_queue');
}

export function useOfflineDB() {
  const [isDBReady, setIsDBReady] = useState(false);

  useEffect(() => {
    getDB().then(() => setIsDBReady(true)).catch(console.error);
  }, []);

  return {
    isDBReady,
    syncCardsOffline,
    syncPlanOffline,
    getOfflineCards,
    getOfflinePlan,
    queueAttempt,
    flushAttemptQueue,
    clearAttemptQueue
  };
}
