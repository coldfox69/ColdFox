import 'server-only';
import { randomUUID } from 'node:crypto';

// nodemailer, imapflow and mailparser are only needed when a message is
// actually sent or fetched. They are loaded on demand so they do not weigh
// down the start-up of every serverless function in the deployment.

export interface OutboundEmail {
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

export interface SendOutcome {
  providerMessageId: string;
  provider: 'gmail' | 'outlook' | 'smtp';
  acceptedAt: string;
}

export type MailboxCredentials =
  | { kind: 'gmail'; refreshToken: string; accessToken?: string; expiresAt?: number }
  | { kind: 'outlook'; refreshToken: string; accessToken?: string; expiresAt?: number; tenant?: string }
  | {
      kind: 'smtp';
      host: string;
      port: number;
      secure: boolean;
      username: string;
      password: string;
      imapHost?: string;
      imapPort?: number;
    };

export interface InboundEmail {
  providerMessageId: string;
  threadId?: string;
  fromEmail: string;
  fromName?: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
  messageId?: string;
  inReplyTo?: string;
  references: string[];
  receivedAt: string;
}

function assertHeaderSafe(value: string, name: string) {
  if (/[\r\n]/.test(value)) throw new Error(`Invalid characters in ${name}`);
}

export function mimeMessage(email: OutboundEmail): string {
  assertHeaderSafe(email.subject, 'subject');
  assertHeaderSafe(email.fromName, 'from name');
  assertHeaderSafe(email.fromEmail, 'from address');
  assertHeaderSafe(email.to, 'recipient');
  const domain = email.fromEmail.split('@')[1] || 'localhost';
  const messageId = `<${randomUUID()}@${domain}>`;
  const extraHeaders = Object.entries(email.headers ?? {})
    .filter(([key]) => !/[\r\n]/.test(key))
    .map(([key, value]) => `${key}: ${value.replace(/[\r\n]+/g, ' ')}`)
    .join('\r\n');
  const boundary = `cf_${randomUUID().replace(/-/g, '')}`;
  const headerLines = [
    `From: ${email.fromName ? `"${email.fromName.replace(/"/g, '')}" ` : ''}<${email.fromEmail}>`,
    `To: <${email.to}>`,
    `Subject: =?UTF-8?B?${Buffer.from(email.subject, 'utf8').toString('base64')}?=`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    email.replyTo ? `Reply-To: <${email.replyTo}>` : '',
    extraHeaders,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean);
  const textPart = [
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(email.text, 'utf8').toString('base64'),
  ].join('\r\n');
  const htmlPart = [
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(email.html, 'utf8').toString('base64'),
  ].join('\r\n');
  return [
    ...headerLines,
    '',
    `--${boundary}`,
    textPart,
    `--${boundary}`,
    htmlPart,
    `--${boundary}--`,
  ].join('\r\n');
}

async function googleAccessToken(creds: Extract<MailboxCredentials, { kind: 'gmail' }>): Promise<string> {
  if (creds.accessToken && creds.expiresAt && creds.expiresAt > Date.now() + 60_000) return creds.accessToken;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Gmail OAuth is not configured on this deployment.');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: creds.refreshToken, grant_type: 'refresh_token' }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Gmail token refresh failed (${res.status}). Reconnect the mailbox.`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function microsoftAccessToken(creds: Extract<MailboxCredentials, { kind: 'outlook' }>): Promise<string> {
  if (creds.accessToken && creds.expiresAt && creds.expiresAt > Date.now() + 60_000) return creds.accessToken;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Microsoft OAuth is not configured on this deployment.');
  const tenant = creds.tenant || process.env.MICROSOFT_TENANT_ID || 'common';
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: creds.refreshToken, grant_type: 'refresh_token' }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Microsoft token refresh failed (${res.status}). Reconnect the mailbox.`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function getAccessToken(creds: MailboxCredentials): Promise<string> {
  if (creds.kind === 'gmail') return googleAccessToken(creds);
  if (creds.kind === 'outlook') return microsoftAccessToken(creds);
  throw new Error('SMTP does not use OAuth access tokens.');
}

export async function createSmtpTransport(creds: Extract<MailboxCredentials, { kind: 'smtp' }>) {
  const { default: nodemailer } = await import('nodemailer');
  return nodemailer.createTransport({
    host: creds.host,
    port: creds.port,
    secure: creds.secure,
    auth: { user: creds.username, pass: creds.password },
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
    tls: { minVersion: 'TLSv1.2' },
  });
}

export async function sendEmail(creds: MailboxCredentials, email: OutboundEmail): Promise<SendOutcome> {
  if (creds.kind === 'gmail') {
    const token = await googleAccessToken(creds);
    const raw = Buffer.from(mimeMessage(email), 'utf8').toString('base64url');
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gmail rejected the message (${res.status}): ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as { id: string };
    return { providerMessageId: data.id, provider: 'gmail', acceptedAt: new Date().toISOString() };
  }

  if (creds.kind === 'outlook') {
    const token = await microsoftAccessToken(creds);
    const headers = Object.entries(email.headers ?? {}).map(([name, value]) => ({ name, value }));
    const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          subject: email.subject,
          body: { contentType: 'HTML', content: email.html },
          toRecipients: [{ emailAddress: { address: email.to } }],
          internetMessageHeaders: headers,
        },
        saveToSentItems: true,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Microsoft Graph rejected the message (${res.status}): ${body.slice(0, 300)}`);
    }
    // Graph's sendMail returns 202 without a message id. Accepted ≠ delivered.
    return { providerMessageId: `graph-${randomUUID()}`, provider: 'outlook', acceptedAt: new Date().toISOString() };
  }

  const transport = await createSmtpTransport(creds);
  try {
    const info = await transport.sendMail({
      from: { name: email.fromName, address: email.fromEmail },
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
      replyTo: email.replyTo,
      headers: email.headers,
    });
    return { providerMessageId: info.messageId, provider: 'smtp', acceptedAt: new Date().toISOString() };
  } finally {
    transport.close();
  }
}

// ── Message modification helpers ──────────────────────────────
// These require gmail.modify / Mail.ReadWrite scopes.

export async function markAsRead(creds: MailboxCredentials, providerMessageId: string): Promise<void> {
  if (creds.kind === 'gmail') {
    const token = await googleAccessToken(creds);
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${providerMessageId}/modify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Gmail mark-as-read failed (${res.status})`);
    return;
  }
  if (creds.kind === 'outlook') {
    const token = await microsoftAccessToken(creds);
    const res = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${providerMessageId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRead: true }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Graph mark-as-read failed (${res.status})`);
    return;
  }
  // SMTP/IMAP: no server-side read tracking; no-op
}

export async function markAsUnread(creds: MailboxCredentials, providerMessageId: string): Promise<void> {
  if (creds.kind === 'gmail') {
    const token = await googleAccessToken(creds);
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${providerMessageId}/modify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ addLabelIds: ['UNREAD'] }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Gmail mark-as-unread failed (${res.status})`);
    return;
  }
  if (creds.kind === 'outlook') {
    const token = await microsoftAccessToken(creds);
    const res = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${providerMessageId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRead: false }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Graph mark-as-unread failed (${res.status})`);
    return;
  }
}

export async function moveToSpam(creds: MailboxCredentials, providerMessageId: string): Promise<void> {
  if (creds.kind === 'gmail') {
    const token = await googleAccessToken(creds);
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${providerMessageId}/modify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ addLabelIds: ['SPAM'], removeLabelIds: ['INBOX', 'UNREAD'] }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Gmail move-to-spam failed (${res.status})`);
    return;
  }
  if (creds.kind === 'outlook') {
    const token = await microsoftAccessToken(creds);
    // Find the Junk folder ID
    const foldersRes = await fetch('https://graph.microsoft.com/v1.0/me/mailFolders?$filter=displayName eq \'Junk Email\'&$select=id', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    });
    const foldersData = (await foldersRes.json()) as { value?: { id: string }[] };
    const junkId = foldersData.value?.[0]?.id;
    if (!junkId) throw new Error('Could not find Junk folder');
    const res = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${providerMessageId}/move`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ destinationId: junkId }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Graph move-to-spam failed (${res.status})`);
    return;
  }
}

export async function moveToInbox(creds: MailboxCredentials, providerMessageId: string): Promise<void> {
  if (creds.kind === 'gmail') {
    const token = await googleAccessToken(creds);
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${providerMessageId}/modify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ addLabelIds: ['INBOX'], removeLabelIds: ['SPAM'] }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Gmail move-to-inbox failed (${res.status})`);
    return;
  }
  if (creds.kind === 'outlook') {
    const token = await microsoftAccessToken(creds);
    const foldersRes = await fetch('https://graph.microsoft.com/v1.0/me/mailFolders?$filter=displayName eq \'Inbox\'&$select=id', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    });
    const foldersData = (await foldersRes.json()) as { value?: { id: string }[] };
    const inboxId = foldersData.value?.[0]?.id;
    if (!inboxId) throw new Error('Could not find Inbox folder');
    const res = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${providerMessageId}/move`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ destinationId: inboxId }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Graph move-to-inbox (not spam) failed (${res.status})`);
    return;
  }
}

export async function trashMessage(creds: MailboxCredentials, providerMessageId: string): Promise<void> {
  if (creds.kind === 'gmail') {
    const token = await googleAccessToken(creds);
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${providerMessageId}/trash`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Gmail trash failed (${res.status})`);
    return;
  }
  if (creds.kind === 'outlook') {
    const token = await microsoftAccessToken(creds);
    const res = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${providerMessageId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok && res.status !== 204) throw new Error(`Graph delete failed (${res.status})`);
    return;
  }
}

export async function modifyLabels(creds: MailboxCredentials, providerMessageId: string, addLabels: string[], removeLabels: string[]): Promise<void> {
  if (creds.kind === 'gmail') {
    const token = await googleAccessToken(creds);
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${providerMessageId}/modify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ addLabelIds: addLabels, removeLabelIds: removeLabels }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Gmail modify labels failed (${res.status})`);
    return;
  }
  // Outlook uses move/folders, not labels
}

// ── Spam folder fetch ──────────────────────────────────────────
export async function fetchSpamMessages(creds: MailboxCredentials, options: { limit?: number } = {}): Promise<InboundEmail[]> {
  const limit = options.limit ?? 25;
  if (creds.kind === 'gmail') {
    const token = await googleAccessToken(creds);
    const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:spam&maxResults=${limit}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!listRes.ok) throw new Error(`Gmail spam fetch failed (${listRes.status})`);
    const listData = (await listRes.json()) as { messages?: { id: string }[] };
    const ids = (listData.messages ?? []).map((m) => m.id);
    const results: InboundEmail[] = [];
    for (const id of ids) {
      const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(30_000),
      });
      if (!msgRes.ok) continue;
      const msg = (await msgRes.json()) as Record<string, unknown>;
      const payload = msg.payload as Record<string, unknown> | undefined;
      const headers = (payload?.headers ?? []) as { name: string; value: string }[];
      const getHeader = (name: string) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
      const parts = (payload?.parts ?? []) as Record<string, unknown>[];
      let bodyText = '';
      let bodyHtml = '';
      const extract = (part: Record<string, unknown>) => {
        const mimeType = String(part.mimeType ?? '');
        const body = part.body as { data?: string } | undefined;
        if (body?.data) {
          const decoded = Buffer.from(body.data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
          if (mimeType === 'text/plain' && !bodyText) bodyText = decoded;
          if (mimeType === 'text/html' && !bodyHtml) bodyHtml = decoded;
        }
        if (Array.isArray(part.parts)) part.parts.forEach(extract);
      };
      extract(payload ?? {});
      if (!bodyText && payload?.body) {
        const body = payload.body as { data?: string };
        if (body.data) bodyText = Buffer.from(body.data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
      }
      const fromRaw = getHeader('From');
      const fromMatch = fromRaw.match(/^(.*?)\s*<([^>]+)>$/) || [null, fromRaw, fromRaw];
      results.push({
        providerMessageId: String(msg.id),
        threadId: String(msg.threadId ?? ''),
        fromEmail: String(fromMatch[2] ?? fromRaw).toLowerCase(),
        fromName: String(fromMatch[1] ?? '').trim() || undefined,
        to: getHeader('To').split(',').map((s) => s.trim()).filter(Boolean),
        subject: getHeader('Subject'),
        text: bodyText,
        html: bodyHtml,
        references: [],
        receivedAt: new Date(Number(msg.internalDate ?? Date.now())).toISOString(),
      });
    }
    return results;
  }
  if (creds.kind === 'outlook') {
    const token = await microsoftAccessToken(creds);
    const res = await fetch('https://graph.microsoft.com/v1.0/me/mailFolders/junkemail/messages?$top=' + limit + '&$select=id,subject,from,toRecipients,receivedDateTime,body,bodyPreview,internetMessageId,conversationId&$orderby=receivedDateTime desc', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Graph spam fetch failed (${res.status})`);
    const data = (await res.json()) as { value?: Record<string, unknown>[] };
    const messages = data.value ?? [];
    return messages.map((m) => {
      const from = m.from as { emailAddress?: { address?: string; name?: string } } | undefined;
      const toRecipients = (m.toRecipients as { emailAddress?: { address?: string } }[]) ?? [];
      const body = m.body as { contentType?: string; content?: string } | undefined;
      return {
        providerMessageId: String(m.id),
        threadId: String(m.conversationId ?? ''),
        fromEmail: String(from?.emailAddress?.address ?? '').toLowerCase(),
        fromName: from?.emailAddress?.name,
        to: toRecipients.map((r) => r.emailAddress?.address ?? '').filter(Boolean),
        subject: String(m.subject ?? ''),
        text: body?.contentType === 'Text' ? String(body.content ?? '') : '',
        html: body?.contentType === 'HTML' ? String(body.content ?? '') : '',
        references: [],
        receivedAt: String(m.receivedDateTime ?? new Date().toISOString()),
      };
    });
  }
  // SMTP/IMAP: no spam folder sync for SMTP
  return [];
}

export async function testMailboxConnection(creds: MailboxCredentials): Promise<{ ok: true; detail: string }> {
  if (creds.kind === 'smtp') {
    const transport = await createSmtpTransport(creds);
    try {
      await transport.verify();
      return { ok: true, detail: 'SMTP connection and authentication succeeded.' };
    } finally {
      transport.close();
    }
  }
  if (creds.kind === 'gmail') {
    const token = await googleAccessToken(creds);
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Gmail profile request failed (${res.status}).`);
    return { ok: true, detail: 'Gmail connection succeeded.' };
  }
  const token = await microsoftAccessToken(creds);
  const res = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Microsoft profile request failed (${res.status}).`);
  return { ok: true, detail: 'Microsoft Graph connection succeeded.' };
}

/** Fetch recent messages over IMAP for inbox synchronisation. */
export async function fetchImapMessages(
  creds: Extract<MailboxCredentials, { kind: 'smtp' }>,
  options: { sinceDays?: number; limit?: number } = {},
): Promise<InboundEmail[]> {
  if (!creds.imapHost) return [];
  const { ImapFlow } = await import('imapflow');
  const { simpleParser } = await import('mailparser');
  const client = new ImapFlow({
    host: creds.imapHost,
    port: creds.imapPort || 993,
    secure: true,
    auth: { user: creds.username, pass: creds.password },
    logger: false,
  });
  const messages: InboundEmail[] = [];
  await client.connect();
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const since = new Date(Date.now() - (options.sinceDays ?? 2) * 86_400_000);
      const uids = await client.search({ since }, { uid: true });
      const selected = (uids || []).slice(-(options.limit ?? 30));
      if (selected.length) {
        for await (const msg of client.fetch(selected, { source: true, envelope: true, uid: true }, { uid: true })) {
          if (!msg.source) continue;
          const parsed = await simpleParser(msg.source);
          const from = parsed.from?.value?.[0];
          if (!from?.address) continue;
          messages.push({
            providerMessageId: parsed.messageId || `imap-${msg.uid}`,
            fromEmail: from.address.toLowerCase(),
            fromName: from.name,
            to: (parsed.to ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]) : []).flatMap((a) => a.value.map((v) => v.address || '')).filter(Boolean),
            subject: parsed.subject || '(no subject)',
            text: parsed.text || '',
            html: typeof parsed.html === 'string' ? parsed.html : undefined,
            messageId: parsed.messageId,
            inReplyTo: parsed.inReplyTo || undefined,
            references: Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [],
            receivedAt: (parsed.date || new Date()).toISOString(),
          });
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
  return messages;
}
