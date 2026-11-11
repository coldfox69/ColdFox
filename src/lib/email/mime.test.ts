import { describe, expect, it } from 'vitest';
import { mimeMessage } from '@/lib/email/providers';

const base = {
  fromName: 'Abu Raihan',
  fromEmail: 'raihan6962@gmail.com',
  to: 'cpanetwork2008@gmail.com',
  subject: "Your app is losing users — here's why",
  text: 'Hi there,\n\nbody para.\n\nBest regards,\nAbu',
  html: '<p>Hi there,</p><p>body para.</p>',
  headers: { 'List-Unsubscribe': '<https://example.com/unsub>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
};

describe('mimeMessage', () => {
  const raw = mimeMessage(base);
  const [headers, body] = raw.split('\r\n\r\n', 2);

  it('leaves a mandatory blank line between headers and the MIME body', () => {
    expect(raw).toContain('\r\n\r\n--cf_');
    expect(headers.trimEnd().split('\r\n').pop()).toMatch(/^Content-Type: multipart\/alternative;/);
  });

  it('has a blank line between each part header and its base64 content', () => {
    expect(raw).toMatch(/Content-Type: text\/plain[^\r]*\r\nContent-Transfer-Encoding: base64\r\n\r\n[A-Za-z0-9+/=]+/);
    expect(raw).toMatch(/Content-Type: text\/html[^\r]*\r\nContent-Transfer-Encoding: base64\r\n\r\n[A-Za-z0-9+/=]+/);
  });

  it('encodes a UTF-8 subject header', () => {
    expect(headers).toMatch(/^Subject: =\?UTF-8\?B\?.+\?=$/m);
  });

  it('includes the unsubscribe headers', () => {
    expect(headers).toContain('List-Unsubscribe: <https://example.com/unsub>');
    expect(headers).toContain('List-Unsubscribe-Post: List-Unsubscribe=One-Click');
  });

  it('round-trips the plain text body', () => {
    const match = raw.match(/Content-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=\r\n]+)\r\n--cf_/);
    expect(match).toBeTruthy();
    const decoded = Buffer.from(match![1]!.replace(/\r\n/g, ''), 'base64').toString('utf8');
    expect(decoded).toBe(base.text);
  });

  it('does not fold the message into a single header line', () => {
    expect(headers).not.toContain('--cf_');
    expect(body).toContain('--cf_');
  });

  it('is parsed by a real mail parser with the body intact', async () => {
    const { simpleParser } = await import('mailparser');
    const parsed = await simpleParser(raw);
    expect(parsed.subject).toBe(base.subject);
    expect(parsed.text?.trim()).toBe(base.text.trim());
    expect(String(parsed.html)).toContain('<p>Hi there,</p>');
  });
});
