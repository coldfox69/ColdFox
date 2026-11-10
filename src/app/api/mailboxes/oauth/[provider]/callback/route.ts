import { NextResponse } from 'next/server';
import { withApi, ApiError } from '@/lib/http';
import { verifyState } from '@/lib/crypto';
import { appUrl, saveMailboxCredentials } from '@/lib/email/engine';
import { createServiceClient } from '@/lib/supabase/service';

interface OAuthState extends Record<string, unknown> {
  userId: string;
  organizationId: string;
  provider: string;
}

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const url = new URL(request.url);
  const base = appUrl();
  const failure = (reason: string) => NextResponse.redirect(`${base}/app/mailboxes?error=${encodeURIComponent(reason)}`);

  try {
    const { provider: rawProvider } = await params;
    const provider = rawProvider === 'gmail' ? 'google' : rawProvider === 'outlook' ? 'microsoft' : rawProvider;
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    if (error) return failure('The provider cancelled or rejected the connection.');
    if (!code) return failure('No authorization code was returned.');

    const state = verifyState<OAuthState>(url.searchParams.get('state') ?? '');
    if (!state || state.provider !== provider) return failure('The OAuth state was invalid or expired. Start again.');

    const redirectUri = `${base}/api/mailboxes/oauth/${provider}/callback`;
    const db = createServiceClient();

    let email = '';
    let tokenPayload: Record<string, unknown>;
    let displayName: string | null = null;

    if (provider === 'google') {
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return failure('Gmail OAuth is not configured.');
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!tokenRes.ok) return failure('Google rejected the token exchange.');
      tokenPayload = (await tokenRes.json()) as Record<string, unknown>;
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${String(tokenPayload.access_token)}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (!profileRes.ok) return failure('Could not read the Google account profile.');
      const profile = (await profileRes.json()) as { email?: string; name?: string };
      email = (profile.email ?? '').toLowerCase();
      displayName = profile.name ?? null;
      if (!email) return failure('The Google account did not expose an email address.');
    } else if (provider === 'microsoft') {
      if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) return failure('Microsoft OAuth is not configured.');
      const tenant = process.env.MICROSOFT_TENANT_ID || 'common';
      const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.MICROSOFT_CLIENT_ID,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          scope: 'openid email offline_access User.Read Mail.Send Mail.Read',
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!tokenRes.ok) return failure('Microsoft rejected the token exchange.');
      tokenPayload = (await tokenRes.json()) as Record<string, unknown>;
      const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${String(tokenPayload.access_token)}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (!profileRes.ok) return failure('Could not read the Microsoft account profile.');
      const profile = (await profileRes.json()) as { mail?: string; userPrincipalName?: string; displayName?: string };
      email = (profile.mail || profile.userPrincipalName || '').toLowerCase();
      displayName = profile.displayName ?? null;
      if (!email) return failure('The Microsoft account did not expose an email address.');
    } else {
      return failure('Unknown mailbox provider.');
    }

    const refreshToken = String(tokenPayload.refresh_token ?? '');
    if (!refreshToken) return failure('The provider did not return a refresh token. Remove the app permission and reconnect.');

    const mailboxProvider = provider === 'google' ? 'gmail' : 'outlook';
    const { data: existing } = await db
      .from('mailboxes')
      .select('id')
      .eq('organization_id', state.organizationId)
      .eq('email_address', email)
      .maybeSingle();

    let mailboxId = existing?.id as string | undefined;
    if (!mailboxId) {
      const { count } = await db.from('mailboxes').select('id', { count: 'exact', head: true }).eq('organization_id', state.organizationId);
      const { data: created, error: insertError } = await db
        .from('mailboxes')
        .insert({
          organization_id: state.organizationId,
          user_id: state.userId,
          email_address: email,
          display_name: displayName,
          provider: mailboxProvider,
          status: 'connected',
          is_default: (count ?? 0) === 0,
          provider_config: { oauth: true },
        })
        .select('id')
        .single();
      if (insertError || !created) return failure('Could not save the connected mailbox.');
      mailboxId = created.id as string;
    } else {
      await db.from('mailboxes').update({ status: 'connected', last_error: null, display_name: displayName }).eq('id', mailboxId);
    }

    await saveMailboxCredentials(mailboxId, state.organizationId, {
      refresh_token: refreshToken,
      access_token: tokenPayload.access_token ?? null,
      expires_at: Date.now() + Number(tokenPayload.expires_in ?? 3600) * 1000,
      tenant: process.env.MICROSOFT_TENANT_ID || 'common',
    });

    return NextResponse.redirect(`${base}/app/mailboxes?connected=${encodeURIComponent(email)}`);
  } catch (error) {
    console.error('[oauth] callback failed', error instanceof Error ? error.message : error);
    return failure('The mailbox connection could not be completed. Please try again.');
  }
}
