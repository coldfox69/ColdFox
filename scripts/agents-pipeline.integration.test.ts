/**
 * Integration check of the agent pipeline.
 *
 * A local HTTP server stands in for the external agent API. The test runs the
 * real runner: it calls the API, reads the leads out of the answer, imports
 * them into a lead list and hands the list to the outreach pipeline.
 *
 * Everything it creates is removed again at the end.
 *
 * Run with: npx vitest run --config vitest.integration.config.ts
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function loadEnv() {
  const raw = fs.readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '');
  const env: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^"|"$/g, '');
  }
  return env;
}

const env = loadEnv();
Object.assign(process.env, env);

const { createServiceClient } = await import('@/lib/supabase/service');
const { saveAgentCredential, removeAgentCredential } = await import('@/lib/agents/service');
const { runAgentTask } = await import('@/lib/agents/runner');

const db: SupabaseClient = createServiceClient();
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

let server: http.Server;
let baseUrl = '';
let receivedAuth = '';
let receivedBody: unknown = null;
const cleanup: Array<() => Promise<void>> = [];

async function findWorkspace(): Promise<{ organizationId: string; userId: string }> {
  const { data: auth, error } = await anon.auth.signInWithPassword({ email: env.SMOKE_EMAIL, password: env.SMOKE_PASSWORD });
  if (error || !auth.session) throw new Error(`Sign-in failed: ${error?.message}`);
  const userId = auth.session.user.id;
  const { data: membership } = await db
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (!membership) throw new Error('The smoke user has no workspace.');
  return { organizationId: String(membership.organization_id), userId };
}

beforeAll(async () => {
  server = http.createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      receivedAuth = String(request.headers.authorization ?? '');
      try {
        receivedBody = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      } catch {
        receivedBody = null;
      }
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({
        leads: [
          { email: 'pipeline.test@example.com', first_name: 'Pipeline', company: 'Test Store', shop_rating: 4.5 },
          { email: 'no-email-here', ignored: true },
        ],
      }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  for (const task of cleanup.reverse()) {
    await task().catch(() => undefined);
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('the agent pipeline', () => {
  it('calls the agent API, imports the leads and hands them to the outreach', async () => {
    const { organizationId, userId } = await findWorkspace();

    const usageBefore = await db.from('usage_records').select('id').eq('organization_id', organizationId).order('id', { ascending: false }).limit(1);
    const usageFloor = Number(usageBefore.data?.[0]?.id ?? 0);

    const slug = `pipeline-test-${Date.now()}`;
    const { data: agent, error: agentError } = await db
      .from('ai_agents')
      .insert({
        slug,
        name: 'Pipeline test agent',
        description: 'Temporary agent used by the integration test.',
        status: 'published',
        agent_type: 'external',
        input_schema: [{ key: 'country', label: 'Country', type: 'text', required: true }],
        api_config: { base_url: baseUrl, path: '/v1/leads', method: 'POST', auth_type: 'bearer', body_mode: 'inputs' },
        supports_outreach: false,
      })
      .select('id')
      .single();
    if (agentError || !agent) throw new Error(`Could not create the test agent: ${agentError?.message}`);
    const agentId = String(agent.id);
    cleanup.push(async () => {
      await db.from('ai_agents').delete().eq('id', agentId);
      await removeAgentCredential(db, agentId);
    });

    await saveAgentCredential(db, agentId, { api_key: 'integration-test-key' });

    const { data: run, error: runError } = await db
      .from('ai_agent_runs')
      .insert({
        organization_id: organizationId,
        agent_id: agentId,
        user_id: userId,
        status: 'queued',
        inputs: { country: 'United States' },
        outreach: { enabled: false },
      })
      .select('id')
      .single();
    if (runError || !run) throw new Error(`Could not create the test run: ${runError?.message}`);
    const runId = String(run.id);
    cleanup.push(async () => {
      await db.from('ai_agent_runs').delete().eq('id', runId);
    });

    await runAgentTask(runId);

    const { data: finished } = await db.from('ai_agent_runs').select('*').eq('id', runId).maybeSingle();
    expect(finished?.status).toBe('succeeded');
    expect(receivedAuth).toBe('Bearer integration-test-key');
    expect(receivedBody).toMatchObject({ inputs: { country: 'United States' } });

    const leadListId = String(finished?.lead_list_id ?? '');
    expect(leadListId).not.toBe('');

    const { data: list } = await db.from('lead_lists').select('*').eq('id', leadListId).maybeSingle();
    expect(list?.source).toBe('agent');
    expect(list?.organization_id).toBe(organizationId);

    const { data: leads } = await db.from('leads').select('email, first_name, company_name').eq('lead_list_id', leadListId);
    expect(leads).toHaveLength(1);
    expect(leads?.[0].email).toBe('pipeline.test@example.com');
    expect(leads?.[0].company_name).toBe('Test Store');

    // The row without a usable email was dropped, and nothing was invented.
    const { data: allLeads } = await db.from('leads').select('email').eq('organization_id', organizationId).eq('lead_list_id', leadListId);
    expect(allLeads?.every((lead) => lead.email === 'pipeline.test@example.com')).toBe(true);

    // Clean up the rows this test created.
    await db.from('leads').delete().eq('lead_list_id', leadListId);
    await db.from('lead_lists').delete().eq('id', leadListId);
    await db.from('usage_records').delete().gt('id', usageFloor).eq('organization_id', organizationId);
  });

  it('stops with a clear message when the agent has no API', async () => {
    const { organizationId, userId } = await findWorkspace();

    const slug = `pipeline-noapi-${Date.now()}`;
    const { data: agent } = await db
      .from('ai_agents')
      .insert({
        slug,
        name: 'Pipeline test agent without API',
        status: 'published',
        agent_type: 'external',
        input_schema: [],
        api_config: { base_url: '' },
      })
      .select('id')
      .single();
    const agentId = String(agent?.id);
    cleanup.push(async () => {
      await db.from('ai_agents').delete().eq('id', agentId);
    });

    const { data: run } = await db
      .from('ai_agent_runs')
      .insert({ organization_id: organizationId, agent_id: agentId, user_id: userId, status: 'queued', inputs: {} })
      .select('id')
      .single();
    const runId = String(run?.id);
    cleanup.push(async () => {
      await db.from('ai_agent_runs').delete().eq('id', runId);
    });

    await runAgentTask(runId);

    const { data: finished } = await db.from('ai_agent_runs').select('status, error, lead_list_id').eq('id', runId).maybeSingle();
    expect(finished?.status).toBe('awaiting_api');
    expect(String(finished?.error)).toMatch(/not connected/i);
    expect(finished?.lead_list_id).toBeNull();
  });
});
