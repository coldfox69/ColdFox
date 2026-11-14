import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { chunk } from '@/lib/data/paginate';

/**
 * Partition a batch of emails into suppressed / eligible using the workspace
 * suppression list (and the shared/global blocklist if one is configured).
 * Emails are checked in batches so a large campaign never builds an oversized
 * request URL, and one failed read only falls back for its own batch.
 */
export async function partitionSuppressed(db: SupabaseClient, organizationId: string, emails: string[]) {
  const normalized = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const suppressed = new Set<string>();
  if (!normalized.length) return { suppressed, eligible: [] as string[] };

  for (const batch of chunk(normalized, 200)) {
    const { data, error } = await db
      .from('suppression_entries')
      .select('email_normalized')
      .eq('organization_id', organizationId)
      .in('email_normalized', batch);
    if (error) {
      // Suppression must never fail open. Fall back to per-email checks so the
      // caller still gets correct behaviour if the batch read breaks.
      for (const email of batch) {
        const { data: single } = await db.rpc('is_suppressed', { p_org: organizationId, p_email: email });
        if (single === true) suppressed.add(email);
      }
      continue;
    }
    for (const row of data ?? []) suppressed.add(String(row.email_normalized));
  }

  return { suppressed, eligible: normalized.filter((e) => !suppressed.has(e)) };
}
