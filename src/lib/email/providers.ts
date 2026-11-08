import 'server-only';
import nodemailer from 'nodemailer';
import { randomUUID } from 'node:crypto';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

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

function mimeMessage(email: OutboundEmail): string {
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
  return [
    `From: ${email.fromName ? `"${email.fromName.replace(/"/g, '')}" ` : ''}<${email.fromEmail}>`,
    `To: <${email.to}>`,
    `Subject: =?UTF-8?B?${Buffer.from(email.subject, 'utf8').toString('base64')}?=`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    email.replyTo ? `Reply-To: <${email.replyTo}>` : '',
    extraHeaders,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(email.text, 'utf8').toString('base64'),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(email.html, 'utf8').toString('base64'),
    `--${boundary}--`,
  ]
    .filter((line) => line !== '')
    .join('\r\n');
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

export function createSmtpTransport(creds: Extract<MailboxCredentials, { kind: 'smtp' }>) {
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

  const transport = createSmtpTransport(creds);
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

export async function testMailboxConnection(creds: MailboxCredentials): Promise<{ ok: true; detail: string }> {
  if (creds.kind === 'smtp') {
    const transport = createSmtpTransport(creds);
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
