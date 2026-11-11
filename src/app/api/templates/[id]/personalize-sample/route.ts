import { z } from 'zod';
import { withApi, ok, parseBody, requireApiSession, assertRole, ApiError } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';
import { personalizeSamples } from '@/lib/ai/personalize';
import type { LeadListColumn } from '@/lib/placeholders';
import { buildLeadVariables, renderText } from '@/lib/email/template';
import { renderPlaceholders, findUnresolvedPlaceholders } from '@/lib/placeholders';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const sampleSchema = z.object({
  lead_list_id: z.string().uuid().optional().nullable(),
  lead_ids: z.array(z.string().uuid()).max(3).optional().default([]),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/templates/[id]/personalize-sample', method: 'POST' }, async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin', 'member']);
    const { id } = await params;
    const input = await parseBody(request, sampleSchema);
    const db = createServiceClient();

    const { data: template } = await db
      .from('email_templates')
      .select('*')
      .eq('id', id)
      .eq('organization_id', session.organizationId)
      .is('archived_at', null)
      .maybeSingle();
    if (!template) throw new ApiError(404, 'Template not found.');

    let leads: Record<string, unknown>[] = [];
    let columns: LeadListColumn[] = [];
    if (input.lead_ids.length) {
      const { data } = await db.from('leads').select('*').eq('organization_id', session.organizationId).is('deleted_at', null).in('id', input.lead_ids).limit(3);
      leads = (data ?? []) as Record<string, unknown>[];
    } else if (input.lead_list_id) {
      const { data: list } = await db.from('lead_lists').select('columns').eq('id', input.lead_list_id).eq('organization_id', session.organizationId).maybeSingle();
      columns = Array.isArray(list?.columns) ? (list!.columns as LeadListColumn[]) : [];
      const { data } = await db.from('leads').select('*').eq('organization_id', session.organizationId).eq('lead_list_id', input.lead_list_id).is('deleted_at', null).limit(3);
      leads = (data ?? []) as Record<string, unknown>[];
    } else {
      const { data } = await db.from('leads').select('*').eq('organization_id', session.organizationId).is('deleted_at', null).limit(3);
      leads = (data ?? []) as Record<string, unknown>[];
    }
    if (!leads.length) throw new ApiError(422, 'No leads available for a sample. Import a lead list first.');

    const subject = String(template.subject ?? '');
    const body = String(template.body_text ?? '');

    if (!template.ai_personalization) {
      // Sample the original template: deterministic render per lead.
      const rendered = leads.map((lead) => {
        const { text: subjectOut, missing: subjectMissing } = renderPlaceholders(subject, { ...buildLeadVariables(lead), ...((lead.custom_data as Record<string, string>) ?? {}) });
        const { text: bodyOut, missing: bodyMissing } = renderPlaceholders(body, { ...buildLeadVariables(lead), ...((lead.custom_data as Record<string, string>) ?? {}) });
        return {
          lead_id: String(lead.id),
          email: String(lead.email),
          subject: subjectOut,
          body: bodyOut,
          ai: false,
          notes: [...subjectMissing, ...bodyMissing].length ? [`Missing values: ${[...subjectMissing, ...bodyMissing].join(', ')}`] : ['Original template with placeholders replaced.'],
        };
      });
      return ok({ samples: rendered, ai_personalization: false });
    }

    const sender = await db.from('organizations').select('name').eq('id', session.organizationId).maybeSingle();
    const samples = await personalizeSamples({
      organizationId: session.organizationId,
      userId: session.userId,
      leads,
      columns,
      subject,
      body,
      senderName: session.email.split('@')[0] || 'ColdFox team',
      senderCompany: sender.data?.name ? String(sender.data.name) : null,
      campaignName: null,
    });

    // Re-render any leftover placeholders with actual lead values.
    const samplesRendered = samples.map((sample) => {
      const lead = leads.find((l) => String(l.id) === sample.lead_id)!;
      const vars = { ...buildLeadVariables(lead), ...((lead.custom_data as Record<string, string>) ?? {}) };
      const s = renderText(sample.subject, vars);
      const b = renderText(sample.body, vars);
      const unresolved = findUnresolvedPlaceholders(s, b);
      return { ...sample, subject: s, body: b, notes: unresolved.length ? [...sample.notes, `Unresolved: ${unresolved.join(', ')}`] : sample.notes };
    });

    return ok({ samples: samplesRendered, ai_personalization: true });
  });
}
