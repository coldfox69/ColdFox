import { NextResponse } from 'next/server';
import { sha256 } from '@/lib/crypto';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

function page(input: { title: string; message: string; token?: string; confirm?: boolean }) {
  const form = input.confirm && input.token
    ? `<form method="post"><input type="hidden" name="token" value="${input.token.replace(/"/g, '&quot;')}" /><button type="submit">Confirm unsubscribe</button></form>`
    : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="robots" content="noindex" /><title>${input.title} · ColdFox</title>
  <style>body{font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;background:#f8fafc;color:#0f172a;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}.card{max-width:520px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:32px;box-shadow:0 10px 40px rgba(15,23,42,.06)}h1{font-size:22px;margin:0 0 12px}p{line-height:1.6;color:#475569}button{margin-top:20px;background:#2563eb;border:0;color:#fff;padding:11px 18px;border-radius:10px;font-weight:600;cursor:pointer}a{color:#2563eb}.small{font-size:12px;color:#94a3b8;margin-top:24px}</style></head>
  <body><main class="card"><h1>${input.title}</h1><p>${input.message}</p>${form}<p class="small">ColdFox · <a href="/">coldfox</a></p></main></body></html>`;
}

function html(body: string, status = 200) {
  return new NextResponse(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}

async function process(token: string) {
  if (!token || token.length < 20) return { result: 'invalid', organization_name: null };
  const { data, error } = await createServiceClient().rpc('process_unsubscribe', { p_token_hash: sha256(token) });
  if (error) {
    console.error('[unsubscribe] rpc failed', error.message);
    return { result: 'error', organization_name: null };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { result: row?.result ?? 'invalid', organization_name: row?.organization_name ?? null };
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  if (!token) return html(page({ title: 'Unsubscribe', message: 'This unsubscribe link is missing its token. Use the link from the original email.' }), 400);
  const result = await process(token);
  if (result.result === 'invalid') return html(page({ title: 'Link not recognised', message: 'This unsubscribe link is invalid. It may have been truncated by your email client.' }), 400);
  if (result.result === 'expired') return html(page({ title: 'Link expired', message: 'This unsubscribe link has expired. Reply to the original email and ask to be removed.' }), 410);
  if (result.result === 'already_unsubscribed') return html(page({ title: 'Already unsubscribed', message: 'You are already on the suppression list and will not receive more marketing email from this sender.' }));
  return html(page({ title: 'Confirm unsubscribe', message: `Confirm that you want to stop receiving outreach email${result.organization_name ? ` from ${result.organization_name}` : ''}.`, token, confirm: true }));
}

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';
  let token = new URL(request.url).searchParams.get('token') ?? '';
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const body = await request.text();
    const params = new URLSearchParams(body);
    token = token || params.get('token') || '';
  }
  const result = await process(token);
  if (result.result === 'invalid' || result.result === 'error') return html(page({ title: 'Unsubscribe failed', message: 'This link could not be processed. Reply to the original email and ask to be removed.' }), 400);
  return html(page({ title: 'Unsubscribed', message: 'You have been added to the suppression list. You will not receive more marketing email from this sender.' }));
}
