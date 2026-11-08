import { withApi, ok, requireApiSession, enforceRateLimit, ApiError, assertRole } from '@/lib/http';
import { parseSpreadsheet, sampleRows } from '@/lib/import/spreadsheet';
import { analyzeColumns } from '@/lib/ai/columns';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  return withApi(async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin', 'member']);
    await enforceRateLimit(request, 'lead-import-analyze', 20, 3600, session.userId);

    const form = await request.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File)) throw new ApiError(422, 'Choose a CSV or XLSX file to upload.');

    const parsed = await parseSpreadsheet(file);
    const analysis = await analyzeColumns({
      organizationId: session.organizationId,
      userId: session.userId,
      headers: parsed.headers,
      sampleRows: sampleRows(parsed.rows, 8),
      totalRows: parsed.rows.length,
    });

    return ok({
      filename: parsed.filename,
      sheetName: parsed.sheetName ?? null,
      headers: parsed.headers,
      totalRows: parsed.rows.length,
      preview: parsed.rows.slice(0, 10),
      analysis,
    });
  });
}
