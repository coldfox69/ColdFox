import { z } from 'zod';
import { withApi, ok, requireApiSession, enforceRateLimit, ApiError, assertRole, writeAudit } from '@/lib/http';
import { parseSpreadsheet } from '@/lib/import/spreadsheet';
import { createServiceClient } from '@/lib/supabase/service';
import { CRM_FIELDS } from '@/lib/ai/columns';
import { importLeadRows } from '@/lib/lead-lists/import';

export const runtime = 'nodejs';
export const maxDuration = 60;

const mappingSchema = z.array(
  z.object({
    header: z.string().max(200),
    // A CRM field, or 'custom' to keep the column as a dynamic personalization field.
    field: z.union([z.enum(CRM_FIELDS), z.literal('custom')]),
  }),
).min(1).max(60);

export async function POST(request: Request) {
  return withApi({ route: '/api/leads/import/confirm', method: 'POST' }, async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin', 'member']);
    await enforceRateLimit(request, 'lead-import-confirm', 10, 3600, session.userId);

    const form = await request.formData().catch(() => null);
    const file = form?.get('file');
    const mappingRaw = form?.get('mapping');
    const leadListNameRaw = form?.get('lead_list_name');
    if (!(file instanceof File)) throw new ApiError(422, 'The file was not included.');
    if (typeof mappingRaw !== 'string') throw new ApiError(422, 'Confirm a column mapping before importing.');
    const leadListName = typeof leadListNameRaw === 'string' ? leadListNameRaw.trim().slice(0, 160) : '';
    if (leadListName.length < 2) throw new ApiError(422, 'Give the lead list a name before importing.');

    let mapping: { header: string; field: string }[];
    try {
      mapping = mappingSchema.parse(JSON.parse(mappingRaw));
    } catch {
      throw new ApiError(422, 'The column mapping is invalid.');
    }

    const parsed = await parseSpreadsheet(file);
    const db = createServiceClient();
    const result = await importLeadRows({
      db,
      organizationId: session.organizationId,
      userId: session.userId,
      listName: leadListName,
      filename: parsed.filename,
      headers: parsed.headers,
      rows: parsed.rows,
      mapping,
      source: 'import',
    });

    await writeAudit({
      organizationId: session.organizationId,
      actorId: session.userId,
      actorEmail: session.email,
      action: 'leads.imported',
      entityType: 'lead_list',
      entityId: result.leadListId,
      request,
      metadata: { created: result.created, duplicates: result.duplicates, invalid: result.invalid, filename: parsed.filename, lead_list_name: leadListName },
    });

    return ok({
      created: result.created,
      duplicates: result.duplicates,
      invalid: result.invalid,
      sampleInvalid: result.sampleInvalid,
      limited: result.limited,
      totalRows: result.totalRows,
      leadIds: result.leadIds,
      leadListId: result.leadListId,
      leadListName: result.leadListName,
      placeholders: result.columns.map((column) => column.placeholder),
    });
  });
}
