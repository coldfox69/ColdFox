'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/shared/Skeleton';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { cn } from '@/lib/utils';
import { formatDateTimeValue, humanize, statusTone } from '@/lib/admin/shared';
import { secondaryBtnCls } from '@/lib/ui-classes';

interface Integration {
  key: string;
  label: string;
  configured: boolean;
  detail: string;
}

interface HealthData {
  jobs: Record<string, number>;
  mailboxes: Record<string, number>;
  campaigns: Record<string, number>;
  errorsLast24h: number;
  failedJobs: number;
  mailboxErrors: number;
  integrations: Integration[];
  recentErrors: Array<Record<string, unknown>>;
  recentAudit: Array<Record<string, unknown>>;
}

function Stat({ label, value, tone, caption }: { label: string; value: number; tone?: 'danger' | 'warning'; caption: string }) {
  return (
    <div className="neu-card rounded-[14px] px-4 py-3.5">
      <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
      <p className={cn('mt-1.5 text-[23px] font-medium leading-none tabular-nums', tone === 'danger' ? 'text-destructive' : tone === 'warning' ? 'text-[var(--cf-warning)]' : 'text-foreground')}>
        {value.toLocaleString()}
      </p>
      <p className="mt-1.5 text-[11px] text-muted-foreground">{caption}</p>
    </div>
  );
}

export function AdminSystemHealth() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState(0);

  const refresh = useCallback(() => {
    setLoading(true);
    setError('');
    setToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const control = new AbortController();
    apiFetch<HealthData>('/api/admin/console/system-health', { signal: control.signal })
      .then((payload) => { if (!cancelled) setData(payload); })
      .catch((fetchError) => { if (!cancelled && !control.signal.aborted) setError(errorMessage(fetchError)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; control.abort(); };
  }, [token]);

  if (error) {
    return (
      <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-3 px-6 py-20 text-center">
        <AlertTriangle className="h-6 w-6 text-destructive" />
        <p className="text-sm font-medium text-foreground">System health could not be loaded</p>
        <p className="max-w-md text-[13px] text-muted-foreground">{error}</p>
        <button type="button" onClick={refresh} className={cn(secondaryBtnCls, 'h-9 px-4')}>Try again</button>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-[14px]" />)}
        </div>
        <Skeleton className="h-64 rounded-[16px]" />
      </div>
    );
  }

  if (!data) return null;

  const configured = data.integrations.filter((integration) => integration.configured).length;

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[26px] font-semibold leading-tight text-foreground">System health</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            Worker queues, mailbox connection state and recent server errors. Integration status is read from server configuration.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/api/health" target="_blank" className={cn(secondaryBtnCls, 'h-9 px-3')}>
            <CheckCircle2 className="h-4 w-4" />
            Health endpoint
          </Link>
          <button type="button" onClick={refresh} className={cn(secondaryBtnCls, 'h-9 px-3')}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Failed jobs" value={data.failedJobs} tone={data.failedJobs ? 'danger' : undefined} caption={`${data.jobs.queued ?? 0} queued, ${data.jobs.processing ?? 0} processing`} />
        <Stat label="Mailboxes in error" value={data.mailboxErrors} tone={data.mailboxErrors ? 'danger' : undefined} caption={`${data.mailboxes.connected ?? 0} of ${Object.values(data.mailboxes).reduce((sum, value) => sum + value, 0)} connected`} />
        <Stat label="Errors, 24 hours" value={data.errorsLast24h} tone={data.errorsLast24h ? 'warning' : undefined} caption="Captured by the API and workers" />
        <Stat label="Configured integrations" value={configured} caption={`${data.integrations.length} services checked`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="neu-card rounded-[16px] p-4">
          <h2 className="text-[14px] font-medium text-foreground">Integrations</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Presence of the environment variables each service needs.</p>
          <ul className="mt-3 space-y-2">
            {data.integrations.map((integration) => (
              <li key={integration.key} className="flex items-center justify-between gap-3 rounded-[8px] px-1 py-1.5">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-foreground">{integration.label}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{integration.detail}</p>
                </div>
                <StatusBadge variant={integration.configured ? 'success' : 'muted'}>
                  {integration.configured ? 'Configured' : 'Missing'}
                </StatusBadge>
              </li>
            ))}
          </ul>
        </section>

        <section className="neu-card rounded-[16px] p-4">
          <h2 className="text-[14px] font-medium text-foreground">Queue and campaign state</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Background job and campaign counts by status.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[12px] font-medium text-muted-foreground">Background jobs</p>
              <ul className="space-y-1.5">
                {Object.entries(data.jobs).map(([status, count]) => (
                  <li key={status} className="flex items-center justify-between text-[12px]">
                    <StatusBadge variant={statusTone(status) as 'success' | 'warning' | 'danger' | 'info' | 'muted'}>{humanize(status)}</StatusBadge>
                    <span className="tabular-nums text-foreground">{count.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1.5 text-[12px] font-medium text-muted-foreground">Campaigns</p>
              <ul className="space-y-1.5">
                {Object.entries(data.campaigns).map(([status, count]) => (
                  <li key={status} className="flex items-center justify-between text-[12px]">
                    <StatusBadge variant={statusTone(status) as 'success' | 'warning' | 'danger' | 'info' | 'muted'}>{humanize(status)}</StatusBadge>
                    <span className="tabular-nums text-foreground">{count.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
            <Link href="/admin/jobs" className="text-[12px] font-medium text-accent-foreground hover:underline">Manage jobs</Link>
            <span className="text-muted-foreground">·</span>
            <Link href="/admin/errors" className="text-[12px] font-medium text-accent-foreground hover:underline">Error log</Link>
            <span className="text-muted-foreground">·</span>
            <Link href="/admin/mailboxes" className="text-[12px] font-medium text-accent-foreground hover:underline">Mailboxes</Link>
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="neu-card overflow-hidden rounded-[16px]">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-[14px] font-medium text-foreground">Recent errors</h2>
            <Link href="/admin/errors" className="text-[12px] font-medium text-accent-foreground hover:underline">All errors</Link>
          </div>
          <div className="divide-y divide-border">
            {data.recentErrors.length === 0 ? (
              <p className="px-4 py-8 text-center text-[12px] text-muted-foreground">No errors recorded.</p>
            ) : data.recentErrors.map((entry) => (
              <div key={String(entry.id)} className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <StatusBadge variant={statusTone(entry.level) as 'success' | 'warning' | 'danger' | 'info' | 'muted'}>{String(entry.level)}</StatusBadge>
                  <p className="min-w-0 flex-1 truncate text-[12px] text-foreground">{String(entry.message)}</p>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTimeValue(entry.created_at)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="neu-card overflow-hidden rounded-[16px]">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-[14px] font-medium text-foreground">Recent admin activity</h2>
            <Link href="/admin/audit" className="text-[12px] font-medium text-accent-foreground hover:underline">Audit log</Link>
          </div>
          <div className="divide-y divide-border">
            {data.recentAudit.length === 0 ? (
              <p className="px-4 py-8 text-center text-[12px] text-muted-foreground">No administrative changes recorded.</p>
            ) : data.recentAudit.map((entry) => (
              <div key={String(entry.id)} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium text-foreground">{String(entry.action)}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{String(entry.actor_email ?? 'System')}</p>
                </div>
                <p className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{formatDateTimeValue(entry.created_at)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
