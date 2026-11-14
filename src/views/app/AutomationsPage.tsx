'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Zap, Play, Pause, Trash2, ArrowRight, Bot, Search, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { AgentIcon } from '@/components/agents/AgentIcon';
import { cn } from '@/lib/utils';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { useToast } from '@/components/shared/ToastProvider';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { useRouter } from 'next/navigation';

export interface AutomationsData {
  workflows: Array<{
    id: string;
    name: string;
    description: string;
    status: string;
    triggerType: string;
    agentId: string;
    agentName: string;
    agentSlug: string;
    agentIcon: string;
    steps: Array<{ id: string; order: number; type: string }>;
    createdAt: string;
  }>;
  executionCounts: Record<string, number>;
}

export interface AgentOption {
  id: string;
  slug: string;
  name: string;
  description: string;
  purpose: string;
  icon: string;
  category: string;
  supportsOutreach: boolean;
  apiConfigured: boolean;
}

const EXECUTION_STATUSES = ['running', 'waiting', 'completed', 'failed'] as const;

const runLabel: Record<string, string> = {
  running: 'Running now',
  waiting: 'Waiting',
  completed: 'Completed',
  failed: 'Failed',
};

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'muted' | 'info'> = {
  active: 'success',
  paused: 'warning',
  draft: 'muted',
  archived: 'muted',
};

const triggerLabel: Record<string, string> = {
  manual: 'Started manually',
  schedule: 'On a schedule',
  campaign_started: 'When a campaign starts',
  campaign_completed: 'When a campaign finishes',
  lead_replied: 'When a lead replies',
  lead_created: 'When a lead is added',
  webhook: 'From a webhook',
};

export default function AutomationsPage({ data, agents }: { data: AutomationsData; agents: AgentOption[] }) {
  const toast = useToast();
  const router = useRouter();
  const [workflows, setWorkflows] = useState(data.workflows);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const filtered = workflows.filter(
    (w) =>
      !debouncedQuery ||
      w.name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      w.description.toLowerCase().includes(debouncedQuery.toLowerCase()),
  );
  const running = workflows.filter(w => w.status === 'active').length;

  const toggleStatus = async (workflow: AutomationsData['workflows'][number], next: string) => {
    setBusy(workflow.id);
    try {
      await apiFetch(`/api/automations/${workflow.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      setWorkflows((list) => list.map((w) => (w.id === workflow.id ? { ...w, status: next } : w)));
      toast.show(next === 'active' ? 'Automation resumed.' : 'Automation paused.', 'success');
      router.refresh();
    } catch (cause) {
      toast.show(errorMessage(cause), 'danger');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    setBusy(id);
    try {
      await apiFetch(`/api/automations/${id}`, { method: 'DELETE' });
      setWorkflows((list) => list.filter((w) => w.id !== id));
      setConfirmId(null);
      toast.show('Automation removed.', 'success');
      router.refresh();
    } catch (cause) {
      toast.show(errorMessage(cause), 'danger');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 px-6 py-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Automations"
        description="Start an AI agent task, or manage the workflows that run agents for you. Each run records its own result."
      />

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-[15px] font-semibold text-foreground">AI agents</h2>
        </div>
        {agents.length === 0 ? (
          <div className="neu-card rounded-[16px]">
            <EmptyState
              icon={<Bot className="h-6 w-6" />}
              title="No agents available"
              description="A platform administrator has to publish an agent before it can be used here."
            />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {agents.map((agent) => (
              <article key={agent.id} className="neu-card flex flex-col gap-3 rounded-[16px] p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-accent text-accent-foreground">
                    <AgentIcon name={agent.icon} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-foreground">{agent.name}</p>
                    <p className="text-[12px] text-muted-foreground">{agent.category}</p>
                  </div>
                </div>
                <p className="line-clamp-2 flex-1 text-[12px] leading-relaxed text-muted-foreground">
                  {agent.description || agent.purpose}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                    agent.apiConfigured ? 'bg-[var(--cf-success)]/10 text-[var(--cf-success)]' : 'bg-muted text-muted-foreground',
                  )}>
                    {agent.apiConfigured ? <CheckCircle2 className="h-3 w-3" /> : null}
                    {agent.apiConfigured ? 'Ready to run' : 'Waiting for API setup'}
                  </span>
                  <Link
                    href={`/app/agents/${agent.slug}?source=automation`}
                    className="inline-flex items-center gap-1.5 rounded-[10px] bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[filter] hover:brightness-105"
                  >
                    Start task <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[15px] font-semibold text-foreground">Workflows</h2>
            {workflows.length > 0 && (
              <span className="text-[12px] text-muted-foreground">{running} active of {workflows.length}</span>
            )}
          </div>
          {workflows.length > 0 && (
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search automations"
                aria-label="Search automations"
                className="w-full rounded-[10px] border border-border bg-input py-2 pl-9 pr-3 text-[13px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/15"
              />
            </div>
          )}
        </div>

        {workflows.length === 0 ? (
          <div className="neu-card rounded-[16px]">
            <EmptyState
              icon={<Zap className="h-6 w-6" />}
              title="No automations yet"
              description="Start an agent task above to create your first automation. Its runs will appear here."
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="neu-card rounded-[16px]">
            <EmptyState
              size="sm"
              icon={<Search className="h-5 w-5" />}
              title="No automations match"
              description={`Nothing matches “${query}”. Try a shorter search.`}
              action={<button onClick={() => setQuery('')} className="rounded-[10px] border border-border bg-card px-4 py-2 text-[13px] font-medium text-foreground hover:bg-muted">Clear search</button>}
            />
          </div>
        ) : (
          <div className="neu-card overflow-hidden rounded-[16px]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">Automation</th>
                    <th className="px-4 py-3 font-semibold">Trigger</th>
                    <th className="px-4 py-3 text-right font-semibold">Steps</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="hidden px-4 py-3 text-right font-semibold lg:table-cell">Created</th>
                    <th className="px-4 py-3 text-right font-semibold"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((w) => {
                    const isBusy = busy === w.id;
                    return (
                      <tr key={w.id} className="transition-colors hover:bg-muted/40">
                        <td className="px-4 py-3">
                          <p className="flex items-center gap-2 font-medium text-foreground">
                            {w.agentSlug ? <AgentIcon name={w.agentIcon} className="h-4 w-4 text-muted-foreground" /> : null}
                            {w.name}
                          </p>
                          <p className="line-clamp-1 text-[12px] text-muted-foreground">{w.description || 'No description'}</p>
                        </td>
                        <td className="px-4 py-3 text-[12px] text-muted-foreground">{triggerLabel[w.triggerType] ?? w.triggerType}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-foreground">{w.steps.length}</td>
                        <td className="px-4 py-3">
                          <StatusBadge variant={statusVariant[w.status] ?? 'muted'} size="sm">
                            {w.status.charAt(0).toUpperCase() + w.status.slice(1)}
                          </StatusBadge>
                        </td>
                        <td className="hidden px-4 py-3 text-right text-muted-foreground lg:table-cell">{w.createdAt.slice(0, 10)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {w.agentSlug && (
                              <Link
                                href={`/app/agents/${w.agentSlug}?source=automation&automation=${w.id}`}
                                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] font-medium text-accent-foreground hover:bg-muted"
                              >
                                Open agent <ArrowRight className="h-3 w-3" />
                              </Link>
                            )}
                            {w.status === 'active' ? (
                              <button
                                onClick={() => void toggleStatus(w, 'paused')}
                                disabled={isBusy}
                                className="rounded-lg p-1.5 text-[var(--cf-warning)] hover:bg-muted disabled:opacity-50"
                                aria-label={`Pause ${w.name}`}
                              >
                                <Pause className="h-4 w-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => void toggleStatus(w, 'active')}
                                disabled={isBusy}
                                className="rounded-lg p-1.5 text-[var(--cf-success)] hover:bg-muted disabled:opacity-50"
                                aria-label={`Resume ${w.name}`}
                              >
                                <Play className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => setConfirmId(confirmId === w.id ? null : w.id)}
                              className="rounded-lg p-1.5 text-destructive hover:bg-muted"
                              aria-label={`Remove ${w.name}`}
                              aria-expanded={confirmId === w.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          {confirmId === w.id && (
                            <div className="mt-2 flex flex-wrap items-center justify-end gap-2 rounded-[8px] border border-destructive/30 bg-destructive/5 px-2.5 py-2">
                              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                              <span className="text-[11px] text-foreground">Remove this automation?</span>
                              <button onClick={() => void remove(w.id)} disabled={isBusy} className="rounded-md bg-destructive px-2 py-1 text-[11px] font-medium text-destructive-foreground disabled:opacity-50">
                                {isBusy ? 'Removing…' : 'Remove'}
                              </button>
                              <button onClick={() => setConfirmId(null)} className="rounded-md border border-border px-2 py-1 text-[11px] font-medium">Keep</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-[15px] font-semibold text-foreground">Agent run history</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {EXECUTION_STATUSES.map((status) => (
            <div key={status} className="neu-card rounded-[12px] p-3">
              <p className="text-[12px] text-muted-foreground">{runLabel[status]}</p>
              <p className="mt-0.5 text-[20px] font-semibold tabular-nums text-foreground">{data.executionCounts[status] ?? 0}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
