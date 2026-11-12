'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Zap, Play, Pause, Trash2, Plus, ArrowRight, Bot } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { AgentIcon } from '@/components/agents/AgentIcon';
import { cn } from '@/lib/utils';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { useToast } from '@/components/shared/ToastProvider';
import { useDebouncedValue } from '@/hooks/use-debounce';

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

const EXECUTION_STATUSES = ['running', 'waiting', 'completed', 'failed'];

export default function AutomationsPage({ data, agents }: { data: AutomationsData; agents: AgentOption[] }) {
  const toast = useToast();
  const [workflows, setWorkflows] = useState(data.workflows);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);

  const filtered = workflows.filter(
    (w) =>
      !debouncedQuery ||
      w.name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      w.description.toLowerCase().includes(debouncedQuery.toLowerCase()),
  );

  const agentWorkflows = filtered.filter((w) => Boolean(w.agentSlug));

  const toggleStatus = async (workflow: (typeof filtered)[number], next: string) => {
    try {
      await apiFetch(`/api/automations/${workflow.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      setWorkflows((list) =>
        list.map((w) => (w.id === workflow.id ? { ...w, status: next } : w)),
      );
      toast.show(`Workflow ${next}.`, 'success');
    } catch (cause) {
      toast.show(errorMessage(cause), 'danger');
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Remove this automation?')) return;
    try {
      await apiFetch(`/api/automations/${id}`, { method: 'DELETE' });
      setWorkflows((list) => list.filter((w) => w.id !== id));
      toast.show('Workflow removed.', 'success');
    } catch (cause) {
      toast.show(errorMessage(cause), 'danger');
    }
  };

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8 max-w-[1440px] mx-auto space-y-6">
      <PageHeader
        title="Automations"
        description="AI agent tasks and campaign triggers. Start an agent, give it its inputs and decide when it runs."
      />

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-[15px] font-semibold text-foreground">AI agents</h2>
        </div>
        {agents.length === 0 ? (
          <div className="neu-card rounded-[16px]">
            <EmptyState
              icon={<Bot className="w-6 h-6" />}
              title="No agents available"
              description="An administrator has to publish an agent before it can be used here."
            />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <article key={agent.id} className="neu-card rounded-[16px] p-4 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent text-accent-foreground shrink-0">
                    <AgentIcon name={agent.icon} className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-foreground truncate">{agent.name}</p>
                    <p className="text-[12px] text-muted-foreground">{agent.category}</p>
                  </div>
                </div>
                <p className="text-[12px] text-muted-foreground line-clamp-2 flex-1">
                  {agent.description || agent.purpose}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className={cn(
                    'text-[11px] px-2 py-0.5 rounded-full',
                    agent.apiConfigured ? 'bg-[var(--cf-success)]/10 text-[var(--cf-success)]' : 'bg-muted text-muted-foreground',
                  )}>
                    {agent.apiConfigured ? 'Ready to run' : 'Waiting for API setup'}
                  </span>
                  <Link
                    href={`/app/agents/${agent.slug}?source=automation`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-primary text-[13px] font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)]"
                  >
                    Start task <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-[15px] font-semibold text-foreground">Workflows</h2>
        </div>

        <div className="neu-card rounded-[16px] p-4 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="relative flex-1 max-w-md">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search automations"
              aria-label="Search automations"
              className="w-full pl-9 pr-3 py-2 rounded-[10px] bg-input text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] focus:ring-[3px] focus:ring-ring/50"
            />
            <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="neu-card rounded-[16px]">
            <EmptyState
              icon={<Zap className="w-6 h-6" />}
              title="No automations"
              description="Start an agent task above, or create follow-up sequences and triggers for your campaigns."
            />
          </div>
        ) : (
          <div className="neu-card rounded-[16px] overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-[12px] text-muted-foreground border-b border-border">
                  <th className="px-4 py-3 font-medium">Workflow</th>
                  <th className="px-4 py-3 font-medium text-right">Trigger</th>
                  <th className="px-4 py-3 font-medium text-right">Steps</th>
                  <th className="px-4 py-3 font-medium text-right">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Created</th>
                  <th className="px-4 py-3 font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((w) => (
                  <tr key={w.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground flex items-center gap-2">
                        {w.agentSlug ? <AgentIcon name={w.agentIcon} className="w-4 h-4 text-muted-foreground" /> : null}
                        {w.name}
                      </p>
                      <p className="text-[12px] text-muted-foreground line-clamp-1">{w.description}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-right">{w.triggerType}</td>
                    <td className="px-4 py-3 text-foreground text-right">{w.steps.length}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`px-2 py-0.5 rounded text-[12px] font-medium ${
                        w.status === 'active'
                          ? 'neu-inset-sm text-muted-foreground'
                          : w.status === 'paused'
                            ? 'neu-inset-sm text-muted-foreground'
                            : 'bg-muted text-muted-foreground'
                      }`}>
                        {w.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-right">{w.createdAt.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {w.agentSlug ? (
                        <Link
                          href={`/app/agents/${w.agentSlug}?source=automation&automation=${w.id}`}
                          className="mr-2 inline-flex items-center gap-1 text-[12px] text-foreground hover:underline"
                        >
                          Open agent <ArrowRight className="w-3 h-3" />
                        </Link>
                      ) : null}
                      {w.status === 'active' ? (
                        <button
                          onClick={() => void toggleStatus(w, 'paused')}
                          className="p-1.5 rounded-lg hover:bg-muted text-[var(--cf-warning)]"
                          aria-label="Pause workflow"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => void toggleStatus(w, 'active')}
                          className="p-1.5 rounded-lg hover:bg-muted text-[var(--cf-success)]"
                          aria-label="Resume workflow"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => void remove(w.id)}
                        className="ml-2 p-1.5 rounded-lg hover:bg-muted text-destructive"
                        aria-label="Remove workflow"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
        {EXECUTION_STATUSES.map((status) => (
          <div key={status} className="neu-card rounded-xl p-3">
            <p className="text-[12px] text-muted-foreground">{status} runs</p>
            <p className="text-[16px] font-semibold text-foreground">
              {data.executionCounts[status] ?? 0}
            </p>
          </div>
        ))}
      </div>

      {agentWorkflows.length === 0 && workflows.length > 0 ? (
        <p className="text-[12px] text-muted-foreground">
          Workflows that are not bound to an agent keep running as before.
        </p>
      ) : null}
    </div>
  );
}
