'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Search, Wand2 } from 'lucide-react';
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
    <div className="px-6 py-6 lg:px-8 lg:py-8 max-w-[1440px] mx-auto space-y-6">
      <PageHeader
        title="AI agents"
        description="Specialised agents that find prospects and hand them to your email outreach. Pick one, give it what it needs, and it runs in the background."
      />

      {agents.length > 0 ? (
        <div className="neu-card rounded-[16px] p-4 flex items-center gap-3 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search agents"
              aria-label="Search agents"
              className="w-full pl-9 pr-3 py-2 rounded-[10px] bg-input text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] focus:ring-[3px] focus:ring-ring/50"
            />
          </div>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="neu-card rounded-[16px]">
          <EmptyState
            icon={<Wand2 className="w-6 h-6" />}
            title={agents.length ? 'No agent matches that search' : 'No agents published yet'}
            description={agents.length ? 'Try a different word.' : 'An administrator has to publish an agent before it shows up here.'}
          />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((agent) => (
            <article key={agent.id} className="neu-card rounded-[16px] p-5 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-accent text-accent-foreground shrink-0">
                  <AgentIcon name={agent.icon} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold text-foreground truncate">{agent.name}</h2>
                  <p className="text-[12px] text-muted-foreground">{agent.category}</p>
                </div>
              </div>

              <p className="text-[13px] text-muted-foreground line-clamp-3 flex-1">
                {agent.description || agent.purpose}
              </p>

              <div className="flex items-center justify-between gap-3">
                <span className={cn(
                  'text-[11px] px-2 py-0.5 rounded-full',
                  agent.apiConfigured
                    ? 'bg-[var(--cf-success)]/10 text-[var(--cf-success)]'
                    : 'bg-muted text-muted-foreground',
                )}>
                  {agent.apiConfigured ? 'Ready to run' : 'Waiting for API setup'}
                </span>
                <Link
                  href={`/app/agents/${agent.slug}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-primary text-[13px] font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)]"
                >
                  Use agent <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
