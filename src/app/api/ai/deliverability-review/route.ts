import { z } from 'zod';
import { withApi, ok, parseBody, requireApiSession, assertRole } from '@/lib/http';
import { reviewForDeliverability, reviewDisclaimer } from '@/lib/ai/personalize';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const reviewSchema = z.object({
  subject: z.string().trim().min(1).max(300),
  body_text: z.string().trim().min(1).max(50000),
  template_id: z.string().uuid().optional().nullable(),
  variant_id: z.string().uuid().optional().nullable(),
});

/**
 * AI deliverability copy review: returns an improved version plus the changes
 * made. Never claims a spam-free inbox or guaranteed delivery.
 */
export async function POST(request: Request) {
  return withApi({ route: '/api/ai/deliverability-review', method: 'POST' }, async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin', 'member']);
    const input = await parseBody(request, reviewSchema);

    const review = await reviewForDeliverability({
      organizationId: session.organizationId,
      userId: session.userId,
      subject: input.subject,
      body: input.body_text,
    });

    return ok({
      original: { subject: input.subject, body_text: input.body_text },
      improved: { subject: review.improved_subject, body_text: review.improved_body },
      changes: review.changes,
      issues: review.issues,
      checks: review.checks,
      disclaimer: reviewDisclaimer(),
    });
  });
}
