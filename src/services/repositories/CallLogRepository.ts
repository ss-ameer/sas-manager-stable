import { CallLogEntry } from '../../types';
import { syncEngine } from '../SyncEngine';
import { getFromLocalStore, saveToLocalStore } from '../db';
import { safeGetDocs } from '../../firebase';

export class CallLogRepository {
  private static STORE_NAME = 'call_logs';

  public static async getAllLocal(): Promise<CallLogEntry[]> {
    return getFromLocalStore<CallLogEntry>(this.STORE_NAME);
  }

  public static async saveLocalCache(items: CallLogEntry[]): Promise<void> {
    await saveToLocalStore(this.STORE_NAME, items);
  }

  public static async fetchWorkspaceCallLogsFromCloud(workspaceId: string): Promise<CallLogEntry[]> {
    try {
      const snap = await safeGetDocs('call_logs');
      if (!snap || snap.empty) return this.getAllLocal();
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CallLogEntry));
      const filtered = docs.filter((log) =>
        log.workspace_id === workspaceId || (!log.workspace_id && workspaceId === 'ws_default')
      );
      await this.saveLocalCache(filtered);
      return filtered;
    } catch (e) {
      console.warn('[CallLogRepository] Cloud fetch failed, using local cache:', e);
      return this.getAllLocal();
    }
  }

  public static async save(entry: CallLogEntry): Promise<void> {
    const current = await this.getAllLocal();
    const idx = current.findIndex((item) => item.id === entry.id);
    let updated: CallLogEntry[];

    if (idx >= 0) {
      updated = [...current];
      updated[idx] = entry;
    } else {
      updated = [entry, ...current];
    }
    await this.saveLocalCache(updated);
    await syncEngine.enqueue('call_logs', 'set', entry.id, entry);
  }

  public static async softDelete(id: string, user?: { uid: string; name: string }): Promise<void> {
    const current = await this.getAllLocal();
    const idx = current.findIndex((item) => item.id === id);
    if (idx === -1) return;

    const updated: CallLogEntry = {
      ...current[idx],
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by_uid: user?.uid,
      deleted_by_name: user?.name
    };

    await this.save(updated);
  }

  public static async restore(id: string): Promise<void> {
    const current = await this.getAllLocal();
    const idx = current.findIndex((item) => item.id === id);
    if (idx === -1) return;

    const restored: CallLogEntry = {
      ...current[idx],
      is_deleted: false,
      deleted_at: undefined,
      deleted_by_uid: undefined,
      deleted_by_name: undefined
    };

    await this.save(restored);
  }

  public static async purgePermanent(id: string): Promise<void> {
    const current = await this.getAllLocal();
    const updated = current.filter((item) => item.id !== id);
    await this.saveLocalCache(updated);
    await syncEngine.enqueue('call_logs', 'delete', id);
  }

  public static async delete(id: string, user?: { uid: string; name: string }): Promise<void> {
    return this.softDelete(id, user);
  }
}
