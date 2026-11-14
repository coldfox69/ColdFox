'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Search, Bot, Wand2, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { AgentIcon } from '@/components/agents/AgentIcon';
import { cn } from '@/lib/utils';

export interface AgentCard {
  id: string;
  slug: string;
  name: string;
  description: string;
  purpose: string;
  icon: string;
  category: string;
  status: string;
  agentType: string;
  supportsOutreach: boolean;
  apiConfigured: boolean;
  updatedAt: string;
}

export default function AgentsPage({ agents }: { agents: AgentCard[] }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((agent) =>
      agent.name.toLowerCase().includes(q)
      || agent.description.toLowerCase().includes(q)
      || agent.category.toLowerCase().includes(q)
      || agent.purpose.toLowerCase().includes(q),
    );
  }, [agents, query]);

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-6 py-6 lg:px-8 lg:py-8">
      <PageHeader
        title="AI agents"
        description="Specialised assistants that research prospects and prepare outreach. Pick one, give it what it needs, and it runs in the background."
        actions={
          <Link href="/app/automations" className="inline-flex items-center gap-2 rounded-[10px] border border-border bg-card px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted">
            <Bot className="h-4 w-4" /> View automations
          </Link>
        }
      />

      {agents.length > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search agents by name or category"
            aria-label="Search agents"
            className="w-full rounded-[10px] border border-border bg-input py-2.5 pl-9 pr-3 text-[13px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/15"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="neu-card rounded-[16px]">
          <EmptyState
            icon={<Wand2 className="h-6 w-6" />}
            title={agents.length ? 'No agent matches that search' : 'No agents published yet'}
            description={agents.length ? 'Try a different word or clear the search.' : 'A platform administrator has to publish an agent before it shows up here.'}
            action={agents.length ? <button onClick={() => setQuery('')} className="rounded-[10px] border border-border bg-card px-4 py-2 text-[13px] font-medium text-foreground hover:bg-muted">Clear search</button> : undefined}
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((agent) => (
            <article key={agent.id} className="neu-card flex flex-col gap-4 rounded-[16px] p-5">
              <div className="flex items-start gap-3">
                <span className="icon-tile-ai h-10 w-10 shrink-0 rounded-[10px]">
                  <AgentIcon name={agent.icon} />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-[15px] font-semibold text-foreground">{agent.name}</h2>
                  <p className="text-[12px] text-muted-foreground">{agent.category}</p>
                </div>
              </div>

              <p className="line-clamp-3 flex-1 text-[13px] leading-relaxed text-muted-foreground">
                {agent.description || agent.purpose}
              </p>

              <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                <span className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                  agent.apiConfigured ? 'bg-[var(--success-soft)] text-[var(--success)]' : 'bg-muted text-muted-foreground',
                )}>
                  {agent.apiConfigured && <CheckCircle2 className="h-3 w-3" />}
                  {agent.apiConfigured ? 'Ready to run' : 'Waiting for API setup'}
                </span>
                <Link
                  href={`/app/agents/${agent.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-[10px] bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[filter] hover:brightness-105"
                >
                  Use agent <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
