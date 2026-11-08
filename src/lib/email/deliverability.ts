import 'server-only';
import { promises as dns } from 'node:dns';
import { ApiError } from '@/lib/http';

export type AuthStatus = 'verified' | 'not_configured' | 'invalid' | 'unable_to_verify' | 'needs_attention';

export interface DnsCheck {
  type: 'spf' | 'dkim' | 'dmarc' | 'mx';
  status: AuthStatus;
  records: string[];
  expected: string;
  detail: string;
}

async function resolveTxtSafe(name: string): Promise<string[] | null> {
  try {
    const records = await dns.resolveTxt(name);
    return records.map((chunks) => chunks.join(''));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOTFOUND' || code === 'ENODATA') return [];
    return null;
  }
}

async function resolveMxSafe(domain: string) {
  try {
    return await dns.resolveMx(domain);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOTFOUND' || code === 'ENODATA') return [];
    return null;
  }
}

/**
 * Checks publicly published DNS records. A successful lookup does not prove
 * that every message is authenticated, nor does it guarantee inbox placement.
 */
export async function checkDomainAuthentication(domain: string, dkimSelector?: string | null): Promise<DnsCheck[]> {
  const checks: DnsCheck[] = [];

  const rootTxt = await resolveTxtSafe(domain);
  const spf = (rootTxt ?? []).filter((r) => r.toLowerCase().startsWith('v=spf1'));
  checks.push({
    type: 'spf',
    status: rootTxt === null ? 'unable_to_verify' : spf.length === 0 ? 'not_configured' : spf.length > 1 ? 'invalid' : spf[0].includes('-all') || spf[0].includes('~all') ? 'verified' : 'needs_attention',
    records: spf,
    expected: 'One SPF TXT record beginning v=spf1 that includes your sending provider and ends with ~all or -all.',
    detail:
      rootTxt === null
        ? 'DNS lookup failed from this server. Retry later.'
        : spf.length === 0
          ? 'No SPF record found.'
          : spf.length > 1
            ? 'Multiple SPF records found. Merge them into one.'
            : 'SPF record published. Verify it includes every sending service you use.',
  });

  const selector = (dkimSelector || 'default').trim();
  const dkimName = `${selector}._domainkey.${domain}`;
  const dkimTxt = await resolveTxtSafe(dkimName);
  const dkim = (dkimTxt ?? []).filter((r) => /v=DKIM1|k=rsa|p=/i.test(r));
  checks.push({
    type: 'dkim',
    status: dkimTxt === null ? 'unable_to_verify' : dkim.length === 0 ? 'not_configured' : dkim.some((r) => /p=/.test(r) && !/p=\s*;?$/.test(r)) ? 'verified' : 'invalid',
    records: dkim,
    expected: `A TXT record at ${dkimName} containing v=DKIM1 and a p= public key supplied by your email provider.`,
    detail:
      dkimTxt === null
        ? 'DNS lookup failed from this server. Retry later.'
        : dkim.length === 0
          ? `No DKIM record found at ${dkimName}. The selector may differ — check your provider's DKIM settings.`
          : 'DKIM record published. Actual signing depends on your provider configuration.',
  });

  const dmarcTxt = await resolveTxtSafe(`_dmarc.${domain}`);
  const dmarc = (dmarcTxt ?? []).filter((r) => r.toLowerCase().startsWith('v=dmarc1'));
  let dmarcStatus: AuthStatus = 'not_configured';
  if (dmarcTxt === null) dmarcStatus = 'unable_to_verify';
  else if (dmarc.length === 0) dmarcStatus = 'not_configured';
  else if (dmarc.length > 1) dmarcStatus = 'invalid';
  else if (/p=none/i.test(dmarc[0])) dmarcStatus = 'needs_attention';
  else dmarcStatus = 'verified';
  checks.push({
    type: 'dmarc',
    status: dmarcStatus,
    records: dmarc,
    expected: 'A TXT record at _dmarc.example.com: v=DMARC1; p=none; rua=mailto:dmarc@example.com (start with p=none, then tighten).',
    detail:
      dmarcTxt === null
        ? 'DNS lookup failed from this server. Retry later.'
        : dmarc.length === 0
          ? 'No DMARC record found.'
          : dmarc.length > 1
            ? 'Multiple DMARC records found. Publish exactly one.'
            : /p=none/i.test(dmarc[0])
              ? 'DMARC is monitoring only (p=none). Review reports before enforcing.'
              : 'DMARC policy published. Confirm alignment and reporting addresses.',
  });

  const mx = await resolveMxSafe(domain);
  checks.push({
    type: 'mx',
    status: mx === null ? 'unable_to_verify' : mx.length === 0 ? 'invalid' : 'verified',
    records: (mx ?? []).map((m) => `${m.priority} ${m.exchange}`),
    expected: 'MX records pointing at your mail provider.',
    detail: mx === null ? 'MX lookup failed from this server.' : mx.length === 0 ? 'No MX records found; the domain cannot receive mail.' : 'MX records found.',
  });

  return checks;
}

export async function assertDomain(domain: string) {
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) throw new ApiError(422, 'Enter a valid domain name.');
}
