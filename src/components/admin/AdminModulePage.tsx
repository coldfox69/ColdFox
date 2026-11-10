'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { useToast } from '@/components/shared/ToastProvider';
import { Search } from 'lucide-react';
import { useDebouncedValue } from '@/hooks/use-debounce';


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
  const debouncedQuery = useDebouncedValue(query, 250);

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
    columns.some((col) => String(item[col.key] ?? '').toLowerCase().includes(debouncedQuery.toLowerCase())),
  );

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 px-6 py-6 lg:px-8 lg:py-8">
      <PageHeader title={title} description={description} />

      <div className="neu-card flex flex-col gap-3 rounded-[16px] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-md flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${title.toLowerCase()}`}
            aria-label={`Search ${title.toLowerCase()}`}
            className="w-full rounded-[10px] bg-input py-2 pl-9 pr-3 text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] focus:border-ring focus:ring-[3px] focus:ring-ring/50"
          />
          <div className="absolute left-3 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-muted-foreground">
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
        <div className="neu-card rounded-[16px] p-8 text-center text-[13px] text-muted-foreground">No matching records</div>
      ) : (
        <div className="neu-card mt-4 overflow-x-auto rounded-[16px]">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[12px] text-muted-foreground">
                {columns.map((col) => (
                  <th key={col.key} className="px-4 py-3 font-medium">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((item, index) => (
                <tr key={String(item.id ?? index)} className="transition-colors duration-[var(--dur)] hover:bg-muted/40">
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
