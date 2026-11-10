'use client';

import { useState } from 'react';
import { Zap, Play, Pause, Trash2, Plus, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
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
    steps: Array<{ id: string; order: number; type: string }>;
    createdAt: string;
  }>;
  executionCounts: Record<string, number>;
}

export default function AutomationsPage({ data }: { data: AutomationsData }) {
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

  const toggleStatus = async (workflow: (typeof filtered)[number], next: string) => {
    try {
      await apiFetch(`/api/admin/automations/${workflow.id}`, {
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
      await apiFetch(`/api/admin/automations/${id}`, { method: 'DELETE' });
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
        description="Follow-up sequences and campaign triggers."
        actions={
          <button
            onClick={() => toast.show('Automation builder coming in the next release.', 'info')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> New automation
          </button>
        }
      />

      <div className="neu-card rounded-[16px] p-4 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-md">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search automations"
            aria-label="Search automations"
            className="w-full pl-9 pr-3 py-2 rounded-[10px] bg-input py-2 pl-9 pr-3 text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] focus:border-ring focus:ring-[3px] focus:ring-ring/50"
          />
          <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Zap className="w-6 h-6" />}
          title="No automations"
          description="Create follow-up sequences and triggers for your campaigns."
        />
      ) : (
        <div className="neu-card rounded-[16px] mt-4 overflow-x-auto">
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
                    <p className="font-medium text-foreground">{w.name}</p>
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
                  <td className="px-4 py-3 text-right">
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
        {['draft', 'active', 'paused', 'archived'].map((status) => (
          <div key={status} className="neu-card rounded-xl p-3">
            <p className="text-[12px] text-muted-foreground">{status} workflows</p>
            <p className="text-[16px] font-semibold text-foreground">
              {data.executionCounts[status] ?? 0}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
