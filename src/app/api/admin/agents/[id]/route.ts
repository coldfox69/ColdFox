import { withApi, ok, parseBody, requirePlatformAdmin, writeAudit, ApiError } from '@/lib/http';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';
import { getAgentById } from '@/lib/agents/service';

export const dynamic = 'force-dynamic';

const fieldSchema = z.object({
  key: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(120),
  type: z.enum(['text', 'textarea', 'email', 'number', 'select', 'multiselect', 'boolean', 'date']),
  required: z.boolean().optional().default(false),
  placeholder: z.string().trim().max(200).optional(),
  help: z.string().trim().max(300).optional(),
  options: z.array(z.object({ value: z.string().max(120), label: z.string().max(120) })).max(50).optional(),
  default: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
  maxLength: z.number().int().min(1).max(20000).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});

const apiConfigSchema = z.object({
  base_url: z.string().trim().max(500).optional(),
  path: z.string().trim().max(500).optional(),
  method: z.enum(['POST', 'GET']).optional(),
  auth_type: z.enum(['bearer', 'header', 'query', 'none']).optional(),
  header_name: z.string().trim().max(120).optional(),
  timeout_ms: z.number().int().min(5000).max(120000).optional(),
  body_mode: z.enum(['inputs', 'flat']).optional(),
  results_path: z.string().trim().max(200).optional(),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  slug: z.string().trim().max(80).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  purpose: z.string().trim().max(2000).optional().nullable(),
  icon: z.string().trim().max(40).optional(),
  category: z.string().trim().max(60).optional(),
  agent_type: z.enum(['builtin', 'external']).optional(),
  status: z.enum(['draft', 'published', 'disabled']).optional(),
  supports_outreach: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(1000).optional(),
  input_schema: z.array(fieldSchema).max(40).optional(),
  api_config: apiConfigSchema.optional(),
  outreach_defaults: z.record(z.string(), z.unknown()).optional(),
});

/** One agent with its input schema. The API key is never part of the answer. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/admin/agents/[id]', method: 'GET' }, async () => {
    await requirePlatformAdmin('ai.manage');
    const { id } = await params;
    const db = createServiceClient();
    const agent = await getAgentById(db, id);
    if (!agent) throw new ApiError(404, 'Agent not found.', 'not_found');
    const { data: credential } = await db.from('ai_agent_credentials').select('agent_id, updated_at').eq('agent_id', id).maybeSingle();
    return ok({
      agent: {
        id: agent.row.id,
        name: agent.row.name,
        slug: agent.row.slug,
        description: agent.row.description ?? '',
        purpose: agent.row.purpose ?? '',
        icon: agent.row.icon,
        category: agent.row.category,
        status: agent.row.status,
        agentType: agent.row.agent_type,
        supportsOutreach: agent.row.supports_outreach,
        sortOrder: agent.row.sort_order,
        fields: agent.row.input_schema ?? [],
        apiConfig: agent.row.api_config ?? {},
        outreachDefaults: agent.row.outreach_defaults ?? {},
        apiConfigured: Boolean(credential),
        credentialUpdatedAt: credential?.updated_at ?? null,
        updatedAt: agent.row.updated_at,
      },
    });
  });
}

/** Update an agent. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/admin/agents/[id]', method: 'PATCH' }, async () => {
    const { session } = await requirePlatformAdmin('ai.manage');
    const { id } = await params;
    const body = await parseBody(request, updateSchema);
    const db = createServiceClient();

    const { data: existing } = await db.from('ai_agents').select('id, status, name').eq('id', id).maybeSingle();
    if (!existing) throw new ApiError(404, 'Agent not found.', 'not_found');

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) patch.name = body.name;
    if (body.slug !== undefined) patch.slug = body.slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    if (body.description !== undefined) patch.description = body.description;
    if (body.purpose !== undefined) patch.purpose = body.purpose;
    if (body.icon !== undefined) patch.icon = body.icon;
    if (body.category !== undefined) patch.category = body.category;
    if (body.agent_type !== undefined) patch.agent_type = body.agent_type;
    if (body.supports_outreach !== undefined) patch.supports_outreach = body.supports_outreach;
    if (body.sort_order !== undefined) patch.sort_order = body.sort_order;
    if (body.input_schema !== undefined) patch.input_schema = body.input_schema;
    if (body.api_config !== undefined) patch.api_config = body.api_config;
    if (body.outreach_defaults !== undefined) patch.outreach_defaults = body.outreach_defaults;
    if (body.status !== undefined) {
      patch.status = body.status;
      patch.published_at = body.status === 'published' ? new Date().toISOString() : null;
    }

    const { data, error } = await db.from('ai_agents').update(patch).eq('id', id).select('id, status, name').single();
    if (error || !data) throw new ApiError(500, `Could not save the agent: ${error?.message ?? ''}`);

    await writeAudit({
      actorId: session.userId,
      actorEmail: session.email,
      action: 'admin.agent.updated',
      entityType: 'ai_agent',
      entityId: id,
      request,
      metadata: { name: data.name, status: data.status },
    });

    return ok({ id: data.id, name: data.name, status: data.status });
  });
}
