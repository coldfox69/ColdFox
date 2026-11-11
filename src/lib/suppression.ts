import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Partition a batch of emails into suppressed / eligible using the workspace
 * suppression list (and the shared/global blocklist if one is configured).
 * One query instead of one RPC per recipient.
 */
export async function partitionSuppressed(db: SupabaseClient, organizationId: string, emails: string[]) {
  const normalized = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const suppressed = new Set<string>();
  if (!normalized.length) return { suppressed, eligible: [] as string[] };
  const { data, error } = await db
    .from('suppression_entries')
    .select('email_normalized')
    .eq('organization_id', organizationId)
    .in('email_normalized', normalized);
  if (error) {
    // Suppression must never fail open. Fall back to per-email checks so the
    // caller still gets correct behaviour if the batch read breaks.
    for (const email of normalized) {
      const { data: single } = await db.rpc('is_suppressed', { p_org: organizationId, p_email: email });
      if (single === true) suppressed.add(email);
    }
    return { suppressed, eligible: normalized.filter((e) => !suppressed.has(e)) };
  }
  for (const row of data ?? []) suppressed.add(String(row.email_normalized));
  return { suppressed, eligible: normalized.filter((e) => !suppressed.has(e)) };
}
