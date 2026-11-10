import { z } from 'zod';
import { withApi, parseBody, requireApiSession, assertRole, ApiError } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';

const schema = z.object({ planKey: z.string().min(1).max(40) });

export async function POST(request: Request) {
  return withApi({ route: '/api/billing/checkout', method: 'POST' }, async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner']);
    const { planKey } = await parseBody(request, schema);
    const db = createServiceClient();
    const { data: plan } = await db.from('subscription_plans').select('key, name, price_monthly').eq('key', planKey).eq('is_active', true).maybeSingle();
    if (!plan) throw new ApiError(404, 'Plan not found.', 'not_found');

    // Billing is intentionally not wired to a paid provider in this deployment.
    // No plan change is applied without a verified provider transaction.
    throw new ApiError(
      503,
      `Checkout is not available on this deployment${process.env.BILLING_PROVIDER ? '' : ' (no billing provider configured)'}. Your workspace stays on its current plan. Contact support to change plans.`,
      'billing_not_configured',
    );
  });
}
