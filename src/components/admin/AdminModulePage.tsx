'use client';

import { useEffect, useState } from 'react';
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
  /**
   * Key inside a non-array payload that holds the rows. Modules such as
   * `overview` return a summary object instead of a list.
   */
  rowsKey?: string;
  emptyState?: {
    title: string;
    description: string;
  };
}

type Row = Record<string, unknown>;

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.length ? `${value.length} records` : '0';
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length) return '';
    return entries.map(([key, item]) => `${key}: ${String(item)}`).join(', ');
  }
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return String(value);
}

/**
 * Normalises the different admin payload shapes into a list of rows.
 * List endpoints return an array; summary endpoints return an object.
 */
export function toRows(payload: unknown, rowsKey: string | undefined, columns: Array<{ key: string; label: string }>): Row[] {
  let source: unknown = payload;

  if (
    rowsKey &&
    source &&
    !Array.isArray(source) &&
    typeof source === 'object'
  ) {
    source = (source as Record<string, unknown>)[rowsKey];
  }

  if (Array.isArray(source)) {
    return source.filter((item): item is Row => Boolean(item) && typeof item === 'object');
  }

  if (source && typeof source === 'object') {
    const record = source as Record<string, unknown>;
    const row: Row = {};
    for (const column of columns) {
      row[column.key] = formatValue(record[column.key]);
    }
    return [row];
  }

  return [];
}

export function AdminModulePage({
  module,
  title,
  description,
  columns,
  rowsKey,
  emptyState,
}: AdminModuleProps) {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const payload = await apiFetch<unknown>(`/api/admin/${module}`);
        if (mounted) setRows(toRows(payload, rowsKey, columns));
      } catch (cause) {
        toast.show(errorMessage(cause), 'danger');
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module, rowsKey]);

  const filtered = rows.filter((item) =>
    columns.some((col) => String(item[col.key] ?? '').toLowerCase().includes(query.toLowerCase())),
  );

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
            className="w-full pl-9 pr-3 py-2 rounded-xl neu-inset-sm text-sm focus:outline-none focus:border-ring"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground flex items-center justify-center">
            <Search className="w-4 h-4" />
          </div>
        </div>
      </div>

      {rows.length === 0 && !query ? (
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
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((item, index) => (
                <tr key={String(item.id ?? index)} className="hover:bg-muted/40 transition-colors">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 text-foreground truncate max-w-xs">
                      {formatValue(item[col.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
