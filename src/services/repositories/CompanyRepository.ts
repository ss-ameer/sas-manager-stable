import { Company, Contact } from '../../types';
import { syncEngine } from '../SyncEngine';
import { getFromLocalStore, saveToLocalStore } from '../db';
import { safeGetDocs, safeUpdateDoc } from '../../firebase';

export class CompanyRepository {
  private static COMPANY_STORE = 'companies';
  private static CONTACT_STORE = 'contacts';

  // --- Companies ---
  public static async getCompaniesLocal(): Promise<Company[]> {
    return getFromLocalStore<Company>(this.COMPANY_STORE);
  }

  public static async saveCompaniesLocalCache(items: Company[]): Promise<void> {
    await saveToLocalStore(this.COMPANY_STORE, items);
  }

  public static async fetchWorkspaceCompaniesFromCloud(workspaceId: string): Promise<Company[]> {
    try {
      const snap = await safeGetDocs('companies');
      if (!snap || snap.empty) return this.getCompaniesLocal();
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Company));
      const filtered = docs.filter((c) =>
        c.workspace_id === workspaceId || (!c.workspace_id && workspaceId === 'ws_default')
      );
      await this.saveCompaniesLocalCache(filtered);
      return filtered;
    } catch (e) {
      console.warn('[CompanyRepository] Cloud fetch failed, using local cache:', e);
      return this.getCompaniesLocal();
    }
  }

  public static async saveCompany(company: Company): Promise<void> {
    const current = await this.getCompaniesLocal();
    const idx = current.findIndex((item) => item.id === company.id);
    let updated: Company[];

    if (idx >= 0) {
      updated = [...current];
      updated[idx] = company;
    } else {
      updated = [company, ...current];
    }
    await this.saveCompaniesLocalCache(updated);
    await syncEngine.enqueue('companies', 'set', company.id, company);

    if (company.id && (company.display_name || company.canonical_name)) {
      const newName = company.display_name || company.canonical_name;
      await this.cascadeUpdateCallLogsCompanyName(company.id, newName);
    }
  }

  public static async updateCompany(companyId: string, companyData: Partial<Company>): Promise<void> {
    const current = await this.getCompaniesLocal();
    const idx = current.findIndex((item) => item.id === companyId);
    let companyToSave: Company;

    if (idx >= 0) {
      companyToSave = {
        ...current[idx],
        ...companyData,
        id: companyId,
        updatedAt: new Date().toISOString()
      };
    } else {
      companyToSave = {
        ...companyData,
        id: companyId,
        updatedAt: new Date().toISOString()
      } as Company;
    }

    await this.saveCompany(companyToSave);
  }

  public static async cascadeUpdateCallLogsCompanyName(companyId: string, newCompanyName: string): Promise<void> {
    if (!companyId || !newCompanyName) return;

    try {
      const storesToUpdate = ['activity_logs', 'call_logs'];
      for (const storeName of storesToUpdate) {
        const allLogs = await getFromLocalStore<any>(storeName);
        if (!allLogs || !Array.isArray(allLogs) || allLogs.length === 0) continue;

        let hasChanges = false;
        const updatedLogs = allLogs.map((log) => {
          if (log.company_id === companyId && log.company_name !== newCompanyName) {
            hasChanges = true;
            // CRITICAL: ONLY update company_name, NEVER overwrite log.phone or log.contact_phone
            return {
              ...log,
              company_name: newCompanyName,
              updatedAt: new Date().toISOString()
            };
          }
          return log;
        });

        if (hasChanges) {
          await saveToLocalStore(storeName, updatedLogs);

          const affectedLogs = updatedLogs.filter(
            (log) => log.company_id === companyId && log.company_name === newCompanyName
          );

          for (const log of affectedLogs) {
            if (log.id) {
              await syncEngine.enqueue(storeName as any, 'set', log.id, log);
              try {
                await safeUpdateDoc(storeName, log.id, {
                  company_name: newCompanyName,
                  updatedAt: new Date().toISOString()
                });
              } catch (e) {
                // Ignore silent failure for individual docs if offline
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[CompanyRepository] Cascade update call logs failed:', e);
    }
  }

  public static async softDeleteCompany(id: string, user?: { uid: string; name: string }): Promise<void> {
    const current = await this.getCompaniesLocal();
    const idx = current.findIndex((item) => item.id === id);
    if (idx === -1) return;

    const updated: Company = {
      ...current[idx],
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by_uid: user?.uid,
      deleted_by_name: user?.name
    };

    await this.saveCompany(updated);
  }

  public static async restoreCompany(id: string): Promise<void> {
    const current = await this.getCompaniesLocal();
    const idx = current.findIndex((item) => item.id === id);
    if (idx === -1) return;

    const restored: Company = {
      ...current[idx],
      is_deleted: false,
      deleted_at: undefined,
      deleted_by_uid: undefined,
      deleted_by_name: undefined
    };

    await this.saveCompany(restored);
  }

  public static async purgeCompanyPermanent(id: string): Promise<void> {
    const current = await this.getCompaniesLocal();
    const updated = current.filter((item) => item.id !== id);
    await this.saveCompaniesLocalCache(updated);
    await syncEngine.enqueue('companies', 'delete', id);
  }

  public static async deleteCompany(id: string, user?: { uid: string; name: string }): Promise<void> {
    return this.softDeleteCompany(id, user);
  }

  // --- Contacts ---
  public static async getContactsLocal(): Promise<Contact[]> {
    return getFromLocalStore<Contact>(this.CONTACT_STORE);
  }

  public static async saveContactsLocalCache(items: Contact[]): Promise<void> {
    await saveToLocalStore(this.CONTACT_STORE, items);
  }

  public static async fetchWorkspaceContactsFromCloud(workspaceId: string): Promise<Contact[]> {
    try {
      const snap = await safeGetDocs('contacts');
      if (!snap || snap.empty) return this.getContactsLocal();
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Contact));
      const filtered = docs.filter((c) =>
        c.workspace_id === workspaceId || (!c.workspace_id && workspaceId === 'ws_default')
      );
      await this.saveContactsLocalCache(filtered);
      return filtered;
    } catch (e) {
      console.warn('[CompanyRepository] Contacts cloud fetch failed:', e);
      return this.getContactsLocal();
    }
  }

  public static async saveContact(contact: Contact): Promise<void> {
    const current = await this.getContactsLocal();
    const idx = current.findIndex((item) => item.id === contact.id);
    let updated: Contact[];

    if (idx >= 0) {
      updated = [...current];
      updated[idx] = contact;
    } else {
      updated = [contact, ...current];
    }
    await this.saveContactsLocalCache(updated);
    await syncEngine.enqueue('contacts', 'set', contact.id, contact);
  }

  public static async softDeleteContact(id: string, user?: { uid: string; name: string }): Promise<void> {
    const current = await this.getContactsLocal();
    const idx = current.findIndex((item) => item.id === id);
    if (idx === -1) return;

    const updated: Contact = {
      ...current[idx],
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by_uid: user?.uid,
      deleted_by_name: user?.name
    };

    await this.saveContact(updated);
  }

  public static async restoreContact(id: string): Promise<void> {
    const current = await this.getContactsLocal();
    const idx = current.findIndex((item) => item.id === id);
    if (idx === -1) return;

    const restored: Contact = {
      ...current[idx],
      is_deleted: false,
      deleted_at: undefined,
      deleted_by_uid: undefined,
      deleted_by_name: undefined
    };

    await this.saveContact(restored);
  }

  public static async purgeContactPermanent(id: string): Promise<void> {
    const current = await this.getContactsLocal();
    const updated = current.filter((item) => item.id !== id);
    await this.saveContactsLocalCache(updated);
    await syncEngine.enqueue('contacts', 'delete', id);
  }

  public static async deleteContact(id: string, user?: { uid: string; name: string }): Promise<void> {
    return this.softDeleteContact(id, user);
  }
}
