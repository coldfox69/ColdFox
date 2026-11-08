'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { useToast } from '@/components/shared/ToastProvider';
import { Search } from 'lucide-react';

export interface AdminModuleProps {
  module: string;
  title: string;
  description: string;
  columns: Array<{ key: string; label: string }>;
  emptyState?: {
    title: string;
    description: string;
  };
}

export function AdminModulePage({
  module,
  title,
  description,
  columns,
  emptyState,
}: AdminModuleProps) {
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const result = await apiFetch<Record<string, unknown>[]>(`/api/admin/${module}`);
        if (mounted) setData(result);
      } catch (cause) {
        toast.show(errorMessage(cause), 'danger');
      }
    })();
    return () => { mounted = false; };
  }, [module, toast]);

  const filtered = data.filter((item) =>
    columns.some((col) => String(item[col.key] ?? '').toLowerCase().includes(query.toLowerCase())),
  );

  const removeItem = async (id: string) => {
    if (!window.confirm('Remove this item?')) return;
    setBusy(true);
    try {
      await apiFetch(`/api/admin/${module}/${id}`, { method: 'DELETE' });
      setData((list) => list.filter((i) => String(i.id) !== id));
      toast.show('Item removed.', 'success');
    } catch (cause) {
      toast.show(errorMessage(cause), 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader title={title} description={description} />

      <div className="neu-card rounded-2xl p-4 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-md">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${title.toLowerCase()}…`}
            aria-label={`Search ${title.toLowerCase()}`}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-muted text-sm border border-transparent focus:outline-none focus:border-ring focus:bg-card"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground flex items-center justify-center">
            <Search className="w-4 h-4" />
          </div>
        </div>
      </div>

      {data.length === 0 && !query ? (
        <EmptyState
          icon={<Search className="w-6 h-6" />}
          title={emptyState?.title ?? `No ${title.toLowerCase()}`}
          description={emptyState?.description ?? 'No records found.'}
        />
      ) : filtered.length === 0 ? (
        <div className="neu-card rounded-2xl p-8 text-center text-sm text-muted-foreground">No matching records.</div>
      ) : (
        <div className="neu-card rounded-2xl mt-4 overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                {columns.map((col) => (
                  <th key={col.key} className="px-4 py-3 font-medium">
                    {col.label}
                  </th>
                ))}
                <th className="px-4 py-3 font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((item) => (
                <tr key={String(item.id)} className="hover:bg-muted/40 transition-colors">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 text-foreground truncate max-w-xs">
                      {String(item[col.key] ?? '')}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => void removeItem(String(item.id))} disabled={busy} className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
