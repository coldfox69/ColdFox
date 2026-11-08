import { NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/crypto';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EVENT_MAP: Record<string, string> = {
  'email.sent': 'accepted',
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  Delivery: 'delivered',
  Bounce: 'bounced',
  SpamComplaint: 'complained',
  Open: 'opened',
  Click: 'clicked',
};

interface NormalizedEvent {
  id: string;
  type: string;
  recipient?: string;
  messageId?: string;
  reason?: string;
}

function normalize(provider: string, payload: Record<string, unknown>): NormalizedEvent | null {
  if (provider === 'resend') {
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const to = Array.isArray(data.to) ? data.to[0] : data.to;
    return {
      id: String(payload.id ?? payload.created_at ?? ''),
      type: EVENT_MAP[String(payload.type)] ?? String(payload.type ?? 'unknown'),
      recipient: to ? String(to) : undefined,
      messageId: data.email_id ? String(data.email_id) : undefined,
      reason: data.bounce ? JSON.stringify(data.bounce).slice(0, 500) : undefined,
    };
  }
  if (provider === 'postmark') {
    return {
      id: String(payload.ID ?? payload.MessageID ?? ''),
      type: EVENT_MAP[String(payload.RecordType)] ?? String(payload.RecordType ?? 'unknown'),
      recipient: payload.Recipient ? String(payload.Recipient) : undefined,
      messageId: payload.MessageID ? String(payload.MessageID) : undefined,
      reason: payload.Description ? String(payload.Description).slice(0, 500) : undefined,
    };
  }
  if (provider === 'sendgrid') {
    const first = Array.isArray(payload) ? (payload[0] as Record<string, unknown>) : payload;
    return {
      id: String(first.sg_event_id ?? first.event_id ?? ''),
      type: String(first.event ?? 'unknown'),
      recipient: first.email ? String(first.email) : undefined,
      messageId: first.sg_message_id ? String(first.sg_message_id).split('.')[0] : undefined,
      reason: first.reason ? String(first.reason).slice(0, 500) : undefined,
    };
  }
  return null;
}

export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const raw = await request.text();
  const signature = request.headers.get('x-webhook-signature') || request.headers.get('x-signature') || request.headers.get('stripe-signature');
  const secret = process.env.WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json({ ok: false, error: 'Webhook endpoint is not configured.' }, { status: 503 });
  }
  if (!verifyWebhookSignature(raw, signature, secret)) {
    return NextResponse.json({ ok: false, error: 'Invalid signature.' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON.' }, { status: 400 });
  }

  const event = normalize(provider, payload);
  if (!event || !event.id) {
    return NextResponse.json({ ok: false, error: 'Unsupported webhook payload.' }, { status: 422 });
  }

  const db = createServiceClient();
  const { error: insertError } = await db.from('webhook_events').insert({
    provider,
    event_id: event.id,
    signature_valid: true,
    payload: payload as Record<string, unknown>,
  });
  if (insertError?.code === '23505') return NextResponse.json({ ok: true, data: { duplicate: true } });

  try {
    let message: Record<string, unknown> | null = null;
    if (event.messageId) {
      const { data } = await db.from('email_messages').select('id, organization_id, lead_id, campaign_id, thread_id').eq('provider_message_id', event.messageId).maybeSingle();
      message = data;
    }

    const orgId = message?.organization_id as string | undefined;
    if (!orgId) {
      await db.from('webhook_events').update({ processed_at: new Date().toISOString(), error: 'No matching message' }).eq('provider', provider).eq('event_id', event.id);
      return NextResponse.json({ ok: true, data: { matched: false } });
    }

    await db.from('email_events').insert({
      organization_id: orgId,
      message_id: message?.id ?? null,
      campaign_id: message?.campaign_id ?? null,
      lead_id: message?.lead_id ?? null,
      event_type: event.type,
      provider_event_id: `${provider}:${event.id}`,
      metadata: { recipient: event.recipient, reason: event.reason },
    });

    if (event.type === 'delivered' && message?.id) {
      await db.from('campaign_executions').update({ status: 'delivered' }).eq('provider_message_id', event.messageId).eq('status', 'accepted');
    }

    if (event.type === 'bounced' || event.type === 'complained') {
      const recipient = (event.recipient || '').toLowerCase().trim();
      if (recipient.includes('@')) {
        await db.from('suppression_entries').upsert(
          {
            organization_id: orgId,
            email: recipient,
            email_normalized: recipient,
            reason_key: event.type === 'bounced' ? 'hard_bounce' : 'complaint',
            source: `webhook:${provider}`,
            notes: event.reason ?? null,
          },
          { onConflict: 'organization_id,email_normalized' },
        );
        if (message?.lead_id) {
          await db.from('leads').update({ status: event.type === 'bounced' ? 'bounced' : 'unsubscribed' }).eq('id', message.lead_id);
        }
        if (message?.campaign_id) {
          await db.rpc('increment_campaign_stat', { p_campaign: message.campaign_id, p_stat: event.type === 'bounced' ? 'bounces' : 'unsubscribes' }).then(() => undefined, () => undefined);
        }
        if (event.type === 'bounced') {
          await db.from('email_bounces').insert({ organization_id: orgId, message_id: message?.id ?? null, lead_id: message?.lead_id ?? null, email: recipient, bounce_type: 'hard', reason: event.reason ?? null, provider });
        } else {
          await db.from('email_complaints').insert({ organization_id: orgId, message_id: message?.id ?? null, lead_id: message?.lead_id ?? null, email: recipient, provider, reason: event.reason ?? null });
        }
      }
    }

    await db.from('webhook_events').update({ processed_at: new Date().toISOString() }).eq('provider', provider).eq('event_id', event.id);
    return NextResponse.json({ ok: true, data: { processed: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Processing failed';
    await db.from('webhook_events').update({ error: message.slice(0, 500) }).eq('provider', provider).eq('event_id', event.id);
    return NextResponse.json({ ok: false, error: 'Webhook processing failed.' }, { status: 500 });
  }
}
