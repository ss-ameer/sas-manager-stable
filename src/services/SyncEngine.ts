import { safeAddDoc, safeUpdateDoc, safeDeleteDoc, safeSetDoc } from '../firebase';
import { enqueueLocalMutation, getPendingMutations, removeLocalMutation, MutationItem } from './db';

type SyncListener = (status: {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: Date | null;
  error: string | null;
}) => void;

class SyncEngine {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSyncing: boolean = false;
  private lastSyncedAt: Date | null = null;
  private lastError: string | null = null;
  private listeners: Set<SyncListener> = new Set();
  private timer: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notify();
        this.processQueue();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notify();
      });

      // Periodic queue check every 5 seconds
      this.timer = setInterval(() => {
        if (this.isOnline && !this.isSyncing) {
          this.processQueue();
        }
      }, 5000);
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    // Initial emission
    this.getPendingCount().then((pendingCount) => {
      listener({
        isOnline: this.isOnline,
        isSyncing: this.isSyncing,
        pendingCount,
        lastSyncedAt: this.lastSyncedAt,
        error: this.lastError
      });
    });

    return () => {
      this.listeners.delete(listener);
    };
  }

  private async notify() {
    const pendingCount = await this.getPendingCount();
    const state = {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount,
      lastSyncedAt: this.lastSyncedAt,
      error: this.lastError
    };

    this.listeners.forEach((listener) => listener(state));
  }

  public async getPendingCount(): Promise<number> {
    const mutations = await getPendingMutations();
    return mutations.length;
  }

  /**
   * Enqueue a mutation for optimistic execution
   */
  public async enqueue(entity: string, action: 'create' | 'update' | 'delete' | 'set', docId: string, payload?: any): Promise<void> {
    const mutation: MutationItem = {
      id: `mut_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      entity,
      action,
      docId,
      payload: payload ? JSON.parse(JSON.stringify(payload)) : undefined,
      timestamp: Date.now(),
      retryCount: 0
    };

    await enqueueLocalMutation(mutation);
    this.notify();

    // Trigger immediate background sync attempt if online
    if (this.isOnline && !this.isSyncing) {
      this.processQueue();
    }
  }

  /**
   * Background process queue worker
   */
  public async processQueue(): Promise<void> {
    if (!this.isOnline || this.isSyncing) return;

    const queue = await getPendingMutations();
    if (queue.length === 0) return;

    this.isSyncing = true;
    this.notify();

    try {
      // Process items sequentially to guarantee order per entity
      for (const item of queue) {
        if (!this.isOnline) break;

        try {
          if (item.action === 'create' || item.action === 'set') {
            await safeSetDoc(item.entity, item.docId, item.payload);
          } else if (item.action === 'update') {
            await safeUpdateDoc(item.entity, item.docId, item.payload);
          } else if (item.action === 'delete') {
            await safeDeleteDoc(item.entity, item.docId);
          }

          // Successfully synchronized to Firestore
          await removeLocalMutation(item.id);
          this.lastSyncedAt = new Date();
          this.lastError = null;
        } catch (err: any) {
          console.warn(`[SyncEngine] Failed to sync item ${item.id} (${item.entity}:${item.action}):`, err);
          
          item.retryCount += 1;
          this.lastError = err?.message || 'Sync error occurred';

          // If item fails repeatedly with non-retryable error, drop or pause
          if (item.retryCount > 10) {
            console.error(`[SyncEngine] Dropping un-syncable mutation ${item.id} after 10 attempts.`);
            await removeLocalMutation(item.id);
          }
          break; // Stop loop and retry in next cycle
        }
      }
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }
}

export const syncEngine = new SyncEngine();
