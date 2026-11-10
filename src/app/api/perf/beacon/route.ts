import { NextResponse } from 'next/server';
import { withApi } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';
import { getSessionContext } from '@/lib/auth/context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type VitalPayload = {
  path: string;
  metric: string;
  value: number;
  rating?: string;
  navigationType?: string;
};

/**
 * Real-user performance beacon. The browser reports Core Web Vitals and we
 * store them so we can see how the app actually feels on real devices and
 * networks, not just on our own laptops.
 */
export async function POST(request: Request) {
  return withApi(async () => {
    let payload: VitalPayload | null = null;
    try {
      payload = (await request.json()) as VitalPayload;
    } catch {
      return NextResponse.json({ ok: true });
    }

    if (!payload?.metric || typeof payload.value !== 'number') {
      return NextResponse.json({ ok: true });
    }

    const headers = request.headers;
    const session = await getSessionContext().catch(() => null);

    const deviceType = /mobile|android|iphone/i.test(headers.get('user-agent') ?? '')
      ? 'mobile'
      : /tablet|ipad/i.test(headers.get('user-agent') ?? '')
        ? 'tablet'
        : 'desktop';

    await createServiceClient()
      .from('web_vitals')
      .insert({
        organization_id: session?.organization?.id ?? null,
        path: String(payload.path ?? '/').slice(0, 300),
        metric: String(payload.metric).slice(0, 40),
        value: payload.value,
        rating: payload.rating ? String(payload.rating).slice(0, 20) : null,
        navigation_type: payload.navigationType ? String(payload.navigationType).slice(0, 40) : null,
        user_agent: (headers.get('user-agent') ?? '').slice(0, 500),
        country: headers.get('x-vercel-ip-country') ?? headers.get('cf-ipcountry') ?? null,
        device_type: deviceType,
        connection_type: headers.get('x-vercel-ip-connection-type') ?? null,
      })
      .then(() => undefined, () => undefined);

    return NextResponse.json({ ok: true });
  });
}
