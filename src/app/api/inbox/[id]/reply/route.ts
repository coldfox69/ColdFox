import { z } from 'zod';
import { withApi, ok, parseBody, requireApiSession, enforceRateLimit, ApiError } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';
import { loadMailboxCredentials } from '@/lib/email/engine';
import { sendEmail } from '@/lib/email/providers';
import { textToHtml } from '@/lib/email/template';

const schema = z.object({ body: z.string().trim().min(1).max(20000) });

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/inbox/[id]/reply', method: 'POST' }, async () => {
    const session = await requireApiSession();
    await enforceRateLimit(request, 'inbox-reply', 60, 3600, session.userId);
    const { id } = await params;
    const { body } = await parseBody(request, schema);
    const db = createServiceClient();

    const { data: thread } = await db
      .from('email_threads')
      .select('*, lead:leads(id, email, first_name)')
      .eq('id', id)
      .eq('organization_id', session.organizationId)
      .maybeSingle();
    if (!thread) throw new ApiError(404, 'Conversation not found.', 'not_found');
    if (!thread.mailbox_id) throw new ApiError(422, 'This conversation has no connected mailbox.');
    const lead = thread.lead as { id?: string; email?: string; first_name?: string } | null;
    if (!lead?.email) throw new ApiError(422, 'This conversation is not linked to a lead with an email address.');

    const { credentials, mailbox } = await loadMailboxCredentials(thread.mailbox_id as string);
    if (String(mailbox.organization_id) !== session.organizationId) throw new ApiError(403, 'Mailbox does not belong to this workspace.');
    if (mailbox.status !== 'connected') throw new ApiError(422, 'Reconnect this mailbox before replying.');

    const subject = /^re:/i.test(String(thread.subject ?? '')) ? String(thread.subject) : `Re: ${thread.subject ?? 'Your message'}`;
    const html = textToHtml(body);
    let outcome;
    try {
      outcome = await sendEmail(credentials, {
        fromName: String(mailbox.display_name || mailbox.email_address),
        fromEmail: String(mailbox.email_address),
        to: String(lead.email),
        subject,
        text: body,
        html,
      });
    } catch (error) {
      throw new ApiError(502, `The reply could not be sent: ${error instanceof Error ? error.message.slice(0, 300) : 'provider error'}`, 'send_failed');
    }

    const { data: message } = await db
      .from('email_messages')
      .insert({
        organization_id: session.organizationId,
        thread_id: id,
        mailbox_id: thread.mailbox_id,
        lead_id: lead.id ?? null,
        campaign_id: thread.campaign_id ?? null,
        direction: 'outbound',
        from_email: String(mailbox.email_address),
        from_name: mailbox.display_name ? String(mailbox.display_name) : null,
        to_emails: [String(lead.email)],
        subject,
        body_text: body,
        body_html: html,
        snippet: body.slice(0, 400),
        provider_message_id: outcome.providerMessageId,
        sent_at: outcome.acceptedAt,
        is_read: true,
      })
      .select('id')
      .single();

    await db.from('email_threads').update({ last_message_at: new Date().toISOString() }).eq('id', id);
    await db.from('email_events').insert({ organization_id: session.organizationId, message_id: message?.id ?? null, campaign_id: thread.campaign_id, lead_id: lead.id ?? null, event_type: 'accepted', metadata: { source: 'inbox_reply', provider: outcome.provider } });
    await db.rpc('record_mailbox_send', { p_mailbox: thread.mailbox_id, p_org: session.organizationId, p_success: true }).then(() => undefined, () => undefined);

    return ok({ sent: true, messageId: message?.id ?? null });
  });
}
