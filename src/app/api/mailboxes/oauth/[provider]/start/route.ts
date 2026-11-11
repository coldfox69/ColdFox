import { NextResponse } from 'next/server';
import { requireApiSession, assertRole, withApi, ApiError } from '@/lib/http';
import { signState } from '@/lib/crypto';
import { appUrl } from '@/lib/email/engine';

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  return withApi({ route: '/api/mailboxes/oauth/[provider]/start', method: 'GET' }, async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin']);
    const { provider } = await params;
    // Accept both the UI labels (gmail/outlook) and the OAuth provider names (google/microsoft).
    const normalized = provider === 'gmail' ? 'google' : provider === 'outlook' ? 'microsoft' : provider;
    if (!['google', 'microsoft'].includes(normalized)) throw new ApiError(404, 'Unknown mailbox provider.');

    const url0 = new URL(request.url);
    const senderName = (url0.searchParams.get('sender_name') ?? '').trim().slice(0, 120) || undefined;

    const state = signState({ userId: session.userId, organizationId: session.organizationId, provider: normalized, senderName });
    // Use the normalized provider name in the redirect URI.
    const redirectUri = `${appUrl()}/api/mailboxes/oauth/${normalized}/callback`;

    if (normalized === 'google') {
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        throw new ApiError(503, 'Gmail OAuth is not configured on this deployment. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or connect a mailbox over SMTP.', 'oauth_not_configured');
      }
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('access_type', 'offline');
      url.searchParams.set('prompt', 'consent');
      url.searchParams.set('scope', 'openid email https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.labels');
      url.searchParams.set('state', state);
      return NextResponse.redirect(url.toString());
    }

    if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
      throw new ApiError(503, 'Microsoft OAuth is not configured on this deployment. Add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET, or connect a mailbox over SMTP.', 'oauth_not_configured');
    }
    const tenant = process.env.MICROSOFT_TENANT_ID || 'common';
    const url = new URL(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`);
    url.searchParams.set('client_id', process.env.MICROSOFT_CLIENT_ID);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('response_mode', 'query');
    url.searchParams.set('scope', 'openid email offline_access User.Read Mail.Send Mail.Read Mail.ReadWrite');
    url.searchParams.set('state', state);
    return NextResponse.redirect(url.toString());
  });
}
