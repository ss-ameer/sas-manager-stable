/**
 * Reference ID generator and formatter utility for system entities.
 * Standardizes IDs across Call Logs, Companies, Contacts, Enquiries, etc.
 * Example formats:
 *   Call Log: CL-8A9F32
 *   Company: CMP-7B1C9D
 *   Contact: CT-3M9D21
 *   Enquiry: EQ-2026-001 (or EQ-4F9120)
 */

export function getReferenceId(
  type: 'CL' | 'CMP' | 'CT' | 'EQ',
  item: {
    id?: string;
    ref_id?: string;
    ref_code?: string;
    quote_ref_no?: string;
    createdAt?: string;
    created_at?: string;
    date?: string;
    _pending?: boolean;
    is_offline?: boolean;
    is_pending?: boolean;
  } | null | undefined,
  allItems: any[] = []
): string {
  if (!item) return '';

  if (item.ref_code) return item.ref_code;
  if (item.ref_id) return item.ref_id;
  if (type === 'EQ' && item.quote_ref_no) return item.quote_ref_no;

  const rawId = item.id || '';

  // Unsynced/local items show PENDING placeholder until confirmed synced to server
  if (
    !rawId ||
    item._pending ||
    item.is_pending ||
    item.is_offline ||
    rawId.startsWith('local_') ||
    rawId.startsWith('temp_') ||
    rawId.startsWith('offline_')
  ) {
    return `${type}-PENDING`;
  }

  // Filter out unsynced local items from sequence calculation
  const syncedItems = (allItems || []).filter(
    (x) =>
      x &&
      x.id &&
      !x.id.startsWith('local_') &&
      !x.id.startsWith('temp_') &&
      !x.id.startsWith('offline_') &&
      !x._pending &&
      !x.is_pending &&
      !x.is_offline
  );

  if (syncedItems.length > 0) {
    const filtered = syncedItems.sort((a, b) => {
      const dateA = a.createdAt || a.created_at || a.date || '';
      const dateB = b.createdAt || b.created_at || b.date || '';
      if (dateA && dateB && dateA !== dateB) {
        return dateA.localeCompare(dateB);
      }
      return (a.id || '').localeCompare(b.id || '');
    });

    const index = filtered.findIndex((x) => x.id === rawId);
    if (index !== -1) {
      const numStr = String(index + 1).padStart(4, '0');
      return `${type}-${numStr}`;
    }
  }

  // Fallback if not matched in array
  const sanitized = rawId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const shortHash = sanitized.slice(-4).padStart(4, '0');

  return `${type}-${shortHash}`;
}
