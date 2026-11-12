'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Save, KeyRound, GripVertical } from 'lucide-react';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { useToast } from '@/components/shared/ToastProvider';
import { cn } from '@/lib/utils';
import type { AgentFieldDefinition, AgentFieldType } from '@/lib/agents/types';

interface AgentPayload {
  id: string;
  name: string;
  slug: string;
  description: string;
  purpose: string;
  icon: string;
  category: string;
  status: 'draft' | 'published' | 'disabled';
  agentType: 'builtin' | 'external';
  supportsOutreach: boolean;
  sortOrder: number;
  fields: AgentFieldDefinition[];
  apiConfig: {
    base_url?: string;
    path?: string;
    method?: 'POST' | 'GET';
    auth_type?: 'bearer' | 'header' | 'query' | 'none';
    header_name?: string;
    timeout_ms?: number;
    body_mode?: 'inputs' | 'flat';
    results_path?: string;
  };
  outreachDefaults: Record<string, unknown>;
  apiConfigured: boolean;
  credentialUpdatedAt: string | null;
  updatedAt: string;
}

const FIELD_TYPES: Array<{ value: AgentFieldType; label: string }> = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'email', label: 'Email' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Choice' },
  { value: 'multiselect', label: 'Multiple choice' },
  { value: 'boolean', label: 'Yes or no' },
  { value: 'date', label: 'Date' },
];

const inputCls = 'w-full px-3.5 py-2.5 rounded-[10px] border border-transparent bg-input text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50';
const labelCls = 'block text-[12px] font-medium text-muted-foreground mb-1.5';

export function AgentEditorPage({ agentId }: { agentId: string }) {
  const toast = useToast();
  const [agent, setAgent] = useState<AgentPayload | null>(null);
  const [fields, setFields] = useState<AgentFieldDefinition[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ agent: AgentPayload }>(`/api/admin/agents/${agentId}`);
      setAgent(data.agent);
      setFields(data.agent.fields ?? []);
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    } finally {
      setLoading(false);
    }
  }, [agentId, toast]);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ agent: AgentPayload }>(`/api/admin/agents/${agentId}`)
      .then((data) => {
        if (cancelled) return;
        setAgent(data.agent);
        setFields(data.agent.fields ?? []);
      })
      .catch((error) => {
        if (!cancelled) toast.show(errorMessage(error), 'danger');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agentId, toast]);

  if (loading) {
    return <div className="px-6 py-8 text-[13px] text-muted-foreground">Loading the agent…</div>;
  }
  if (!agent) {
    return (
      <div className="px-6 py-8">
        <p className="text-[13px] text-muted-foreground">This agent could not be loaded.</p>
        <Link href="/admin/ai-agents" className="mt-3 inline-flex items-center gap-2 text-[13px] text-foreground hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to AI agents
        </Link>
      </div>
    );
  }

  const set = (key: keyof AgentPayload, value: unknown) => {
    setAgent((current) => (current ? { ...current, [key]: value } : current));
  };

  const setApi = (key: string, value: unknown) => {
    setAgent((current) => (current ? { ...current, apiConfig: { ...current.apiConfig, [key]: value } } : current));
  };

  const updateField = (index: number, patch: Partial<AgentFieldDefinition>) => {
    setFields((current) => current.map((field, position) => (position === index ? { ...field, ...patch } : field)));
  };

  const addField = () => {
    setFields((current) => [
      ...current,
      { key: `field_${current.length + 1}`, label: 'New field', type: 'text', required: false },
    ]);
  };

  const removeField = (index: number) => {
    setFields((current) => current.filter((_, position) => position !== index));
  };

  const moveField = (index: number, direction: -1 | 1) => {
    setFields((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const save = async () => {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/agents/${agentId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: agent.name,
          slug: agent.slug,
          description: agent.description,
          purpose: agent.purpose,
          icon: agent.icon,
          category: agent.category,
          agent_type: agent.agentType,
          status: agent.status,
          supports_outreach: agent.supportsOutreach,
          sort_order: agent.sortOrder,
          input_schema: fields,
          api_config: agent.apiConfig,
          outreach_defaults: agent.outreachDefaults,
        }),
        dedupe: false,
      });
      toast.show('Agent saved.', 'success');
      await load();
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const saveKey = async () => {
    if (!apiKey.trim()) {
      toast.show('Enter the API key first.', 'danger');
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/admin/agents/${agentId}/credential`, {
        method: 'POST',
        body: JSON.stringify({ api_key: apiKey.trim() }),
        dedupe: false,
      });
      setApiKey('');
      toast.show('API key stored.', 'success');
      await load();
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const removeKey = async () => {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/agents/${agentId}/credential`, { method: 'DELETE', dedupe: false });
      toast.show('API key removed.', 'success');
      await load();
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8 max-w-[1200px] mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/ai-agents" className="inline-flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> AI agents
          </Link>
          <h1 className="mt-2 text-[22px] font-semibold text-foreground">{agent.name}</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {agent.status === 'published' ? 'Published for every workspace.' : `Status: ${agent.status}.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={agent.status}
            onChange={(event) => set('status', event.target.value as AgentPayload['status'])}
            aria-label="Agent status"
            className={cn(inputCls, 'w-auto')}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="disabled">Disabled</option>
          </select>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:opacity-60"
          >
            <Save className="w-4 h-4" /> Save agent
          </button>
        </div>
      </div>

      <section className="neu-card rounded-[16px] p-5 space-y-4">
        <h2 className="text-[15px] font-semibold text-foreground">What the agent does</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="block">
            <span className={labelCls}>Name</span>
            <input value={agent.name} onChange={(event) => set('name', event.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Slug</span>
            <input value={agent.slug} onChange={(event) => set('slug', event.target.value)} className={inputCls} />
            <span className="mt-1 block text-[11px] text-muted-foreground">Used in the user page URL.</span>
          </label>
          <label className="block md:col-span-2">
            <span className={labelCls}>Description</span>
            <textarea rows={3} value={agent.description} onChange={(event) => set('description', event.target.value)} className={inputCls} />
            <span className="mt-1 block text-[11px] text-muted-foreground">Shown on the agent card in the user panel.</span>
          </label>
          <label className="block md:col-span-2">
            <span className={labelCls}>Purpose</span>
            <textarea rows={2} value={agent.purpose} onChange={(event) => set('purpose', event.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Icon</span>
            <input value={agent.icon} onChange={(event) => set('icon', event.target.value)} className={inputCls} placeholder="shopping-bag" />
          </label>
          <label className="block">
            <span className={labelCls}>Category</span>
            <input value={agent.category} onChange={(event) => set('category', event.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Type</span>
            <select value={agent.agentType} onChange={(event) => set('agentType', event.target.value as AgentPayload['agentType'])} className={inputCls}>
              <option value="external">External API</option>
              <option value="builtin">Built in</option>
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Order</span>
            <input
              type="number"
              value={agent.sortOrder}
              onChange={(event) => set('sortOrder', Number(event.target.value))}
              className={inputCls}
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-[13px] text-foreground">
          <input
            type="checkbox"
            checked={agent.supportsOutreach}
            onChange={(event) => set('supportsOutreach', event.target.checked)}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          This agent can hand its results to the email outreach pipeline
        </label>
      </section>

      <section className="neu-card rounded-[16px] p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">Input fields</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">The user panel renders these fields on the agent page.</p>
          </div>
          <button
            type="button"
            onClick={addField}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-[10px] bg-card text-[13px] font-medium text-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:shadow-[var(--shadow-raised)] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)]"
          >
            <Plus className="w-4 h-4" /> Add field
          </button>
        </div>

        {fields.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No fields yet. Add the information this agent needs from the user.</p>
        ) : (
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={`${field.key}-${index}`} className="rounded-[12px] border border-border p-4 space-y-3">
                <div className="grid md:grid-cols-4 gap-3">
                  <label className="block">
                    <span className={labelCls}>Label</span>
                    <input value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} className={inputCls} />
                  </label>
                  <label className="block">
                    <span className={labelCls}>Key</span>
                    <input value={field.key} onChange={(event) => updateField(index, { key: event.target.value })} className={inputCls} />
                  </label>
                  <label className="block">
                    <span className={labelCls}>Type</span>
                    <select value={field.type} onChange={(event) => updateField(index, { type: event.target.value as AgentFieldType })} className={inputCls}>
                      {FIELD_TYPES.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-end gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(field.required)}
                      onChange={(event) => updateField(index, { required: event.target.checked })}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                    <span className="text-[12px] text-muted-foreground mb-2.5">Required</span>
                  </label>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <label className="block">
                    <span className={labelCls}>Placeholder</span>
                    <input value={field.placeholder ?? ''} onChange={(event) => updateField(index, { placeholder: event.target.value })} className={inputCls} />
                  </label>
                  <label className="block">
                    <span className={labelCls}>Help text</span>
                    <input value={field.help ?? ''} onChange={(event) => updateField(index, { help: event.target.value })} className={inputCls} />
                  </label>
                </div>
                {field.type === 'select' || field.type === 'multiselect' ? (
                  <label className="block">
                    <span className={labelCls}>Options (one per line, as value | label)</span>
                    <textarea
                      rows={3}
                      value={(field.options ?? []).map((option) => `${option.value} | ${option.label}`).join('\n')}
                      onChange={(event) => {
                        const options = event.target.value
                          .split('\n')
                          .map((line) => line.trim())
                          .filter(Boolean)
                          .map((line) => {
                            const [value, ...rest] = line.split('|');
                            return { value: value.trim(), label: (rest.join('|') || value).trim() };
                          });
                        updateField(index, { options });
                      }}
                      className={cn(inputCls, 'font-mono text-[12px]')}
                    />
                  </label>
                ) : null}
                <div className="flex items-center justify-end gap-2">
                  <button type="button" onClick={() => moveField(index, -1)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" aria-label="Move field up">
                    <GripVertical className="w-4 h-4 rotate-90" />
                  </button>
                  <button type="button" onClick={() => moveField(index, 1)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" aria-label="Move field down">
                    <GripVertical className="w-4 h-4 -rotate-90" />
                  </button>
                  <button type="button" onClick={() => removeField(index)} className="p-1.5 rounded-lg hover:bg-muted text-destructive" aria-label="Remove field">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="neu-card rounded-[16px] p-5 space-y-4">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">Agent API</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Where ColdFox sends the user inputs, and how it authenticates. The key itself is stored encrypted on the server.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="block">
            <span className={labelCls}>Base URL</span>
            <input
              value={agent.apiConfig.base_url ?? ''}
              onChange={(event) => setApi('base_url', event.target.value)}
              className={inputCls}
              placeholder="https://api.example.com"
            />
          </label>
          <label className="block">
            <span className={labelCls}>Path</span>
            <input
              value={agent.apiConfig.path ?? ''}
              onChange={(event) => setApi('path', event.target.value)}
              className={inputCls}
              placeholder="/v1/leads"
            />
          </label>
          <label className="block">
            <span className={labelCls}>Method</span>
            <select value={agent.apiConfig.method ?? 'POST'} onChange={(event) => setApi('method', event.target.value)} className={inputCls}>
              <option value="POST">POST</option>
              <option value="GET">GET</option>
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Authentication</span>
            <select value={agent.apiConfig.auth_type ?? 'bearer'} onChange={(event) => setApi('auth_type', event.target.value)} className={inputCls}>
              <option value="bearer">Bearer token</option>
              <option value="header">Custom header</option>
              <option value="query">Query parameter</option>
              <option value="none">No authentication</option>
            </select>
          </label>
          {agent.apiConfig.auth_type === 'header' ? (
            <label className="block">
              <span className={labelCls}>Header name</span>
              <input
                value={agent.apiConfig.header_name ?? ''}
                onChange={(event) => setApi('header_name', event.target.value)}
                className={inputCls}
                placeholder="X-Api-Key"
              />
            </label>
          ) : null}
          <label className="block">
            <span className={labelCls}>Request body</span>
            <select value={agent.apiConfig.body_mode ?? 'inputs'} onChange={(event) => setApi('body_mode', event.target.value)} className={inputCls}>
              <option value="inputs">Wrap the answers in an inputs object</option>
              <option value="flat">Send the answers as the body</option>
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Leads path in the answer</span>
            <input
              value={agent.apiConfig.results_path ?? ''}
              onChange={(event) => setApi('results_path', event.target.value)}
              className={inputCls}
              placeholder="data.leads"
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">Leave empty to look for leads, results, items, data or contacts.</span>
          </label>
          <label className="block">
            <span className={labelCls}>Timeout (ms)</span>
            <input
              type="number"
              value={agent.apiConfig.timeout_ms ?? 60000}
              onChange={(event) => setApi('timeout_ms', Number(event.target.value))}
              className={inputCls}
            />
          </label>
        </div>

        <div className="rounded-[12px] border border-border p-4 space-y-3">
          <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
            <KeyRound className="w-4 h-4" />
            API key
            <span className={cn('text-[11px] px-2 py-0.5 rounded-full', agent.apiConfigured ? 'bg-[var(--cf-success)]/10 text-[var(--cf-success)]' : 'bg-muted text-muted-foreground')}>
              {agent.apiConfigured ? 'Connected' : 'Not connected'}
            </span>
          </div>
          <p className="text-[12px] text-muted-foreground">
            The key is encrypted with the same key that protects mailbox credentials. It is never returned to the browser.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={agent.apiConfigured ? 'Enter a new key to replace the stored one' : 'Paste the API key of the agent'}
              className={cn(inputCls, 'flex-1 min-w-[240px]')}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => void saveKey()}
              disabled={busy}
              className="px-3 py-2 rounded-[10px] bg-card text-[13px] font-medium text-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:opacity-60"
            >
              Store key
            </button>
            {agent.apiConfigured ? (
              <button
                type="button"
                onClick={() => void removeKey()}
                disabled={busy}
                className="px-3 py-2 rounded-[10px] bg-card text-[13px] font-medium text-destructive shadow-[var(--shadow-raised-sm)] transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:opacity-60"
              >
                Remove key
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
