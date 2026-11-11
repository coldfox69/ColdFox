'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Check, ChevronDown, ChevronLeft, ChevronRight, Download,
  Loader2, Plus, RefreshCw, Search, SlidersHorizontal, X,
} from 'lucide-react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton } from '@/components/shared/Skeleton';
import { useToast } from '@/components/shared/ToastProvider';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import {
  fieldCls, ghostBtnCls, primaryBtnCls, secondaryBtnCls,
} from '@/lib/ui-classes';
import {
  ADMIN_MODULES,
  formatDateValue,
  formatDateTimeValue,
  formatMoney,
  hasAdminPermission,
  humanize,
  statusTone,
  type AdminDetailResponse,
  type AdminListResponse,
} from '@/lib/admin/shared';
import type {
  AdminActionConfig,
  AdminColumnConfig,
  AdminFormField,
  AdminModuleConfig,
  AdminOption,
} from '@/lib/admin/config';
import { useAdminPermissions } from '@/components/admin/AdminPermissions';

type Row = Record<string, unknown>;
type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'outline';

function rowId(row: Row) {
  return String(row.id ?? row.key ?? row.user_id ?? '');
}

function isBlank(value: unknown) {
  return value === null || value === undefined || value === '';
}

function toInputValue(value: unknown) {
  if (isBlank(value)) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 2);
}

function toDateTimeInput(value: unknown) {
  if (!value) return '';
  const raw = String(value);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatCell(value: unknown, column: AdminColumnConfig) {
  if (isBlank(value)) return <span className="text-muted-foreground">Not set</span>;
  switch (column.type) {
    case 'status':
      return (
        <StatusBadge variant={statusTone(value) as BadgeVariant}>
          {humanize(value)}
        </StatusBadge>
      );
    case 'bool':
      return (
        <StatusBadge variant={value ? 'success' : 'muted'}>
          {value ? 'Yes' : 'No'}
        </StatusBadge>
      );
    case 'date':
      return <span className="tabular-nums">{formatDateValue(value)}</span>;
    case 'datetime':
      return <span className="tabular-nums">{formatDateTimeValue(value)}</span>;
    case 'money':
      return <span className="tabular-nums">{formatMoney(value)}</span>;
    case 'currency':
      return <span className="tabular-nums">{new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value))}</span>;
    case 'micros':
      return <span className="tabular-nums">{formatMoney(Number(value) / 10_000)}</span>;
    case 'number':
      return <span className="tabular-nums">{Number(value).toLocaleString()}</span>;
    case 'json': {
      const text = typeof value === 'string' ? value : JSON.stringify(value);
      return <span className="block max-w-[18rem] truncate font-mono text-[12px]" title={text}>{text}</span>;
    }
    case 'truncate': {
      const text = String(value);
      return <span className="block max-w-[22rem] truncate" title={text}>{text}</span>;
    }
    case 'email':
      return <span className="block max-w-[20rem] truncate" title={String(value)}>{String(value)}</span>;
    default:
      return <span className="block max-w-[22rem] truncate" title={String(value)}>{String(value)}</span>;
  }
}

function summaryValue(value: unknown, type?: 'number' | 'money' | 'currency' | 'micros') {
  if (isBlank(value)) return '0';
  if (type === 'money') return formatMoney(value);
  if (type === 'currency') return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value));
  if (type === 'micros') return formatMoney(Number(value) / 10_000);
  return Number(value).toLocaleString();
}


interface ModalState {
  kind: 'create' | 'row' | 'bulk';
  action: AdminActionConfig;
  row?: Row;
  title: string;
}

interface ConfirmState {
  action: AdminActionConfig;
  row?: Row;
}

export function AdminConsole({ config }: { config: AdminModuleConfig }) {
  const permissions = useAdminPermissions();
  const { show } = useToast();
  const access = ADMIN_MODULES[config.module];
  const canManage = !config.readOnly && hasAdminPermission(permissions, access?.manage);
  const canDelete = !config.readOnly && hasAdminPermission(permissions, access?.remove ?? access?.manage);
  const canRead = hasAdminPermission(permissions, access?.read);

  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 25, total: 0, pageCount: 1 });
  const [summary, setSummary] = useState<Record<string, string | number | null>>({});
  const [facets, setFacets] = useState<Record<string, AdminOption[]>>({});
  const [secondary, setSecondary] = useState<AdminListResponse['secondary']>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 320);
  const [statusFilter, setStatusFilter] = useState('');
  const [facetFilter, setFacetFilter] = useState('');
  const [sort, setSort] = useState(config.defaultSort ?? '');
  const [dir, setDir] = useState<'asc' | 'desc'>(config.defaultDir ?? 'desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [refreshToken, setRefreshToken] = useState(0);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState('');
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);

  const closeMenu = () => {
    setMenuOpen('');
    setMenuAnchor(null);
  };

  const toggleMenu = (event: React.MouseEvent<HTMLButtonElement>, id: string) => {
    if (menuOpen === id) {
      closeMenu();
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 208; // w-52
    const estimatedHeight = Math.min(72 * 4, 16 + 40 * 6);
    const openUp = rect.bottom + estimatedHeight + 8 > window.innerHeight && rect.top - estimatedHeight - 8 > 0;
    const y = openUp ? rect.top - estimatedHeight - 6 : rect.bottom + 6;
    const x = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
    setMenuAnchor({ x, y });
    setMenuOpen(id);
  };

  // Close the menu on viewport changes so it never detaches from its row.
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => closeMenu();
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [menuOpen]);
  const [detailId, setDetailId] = useState('');
  const [detail, setDetail] = useState<AdminDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [modal, setModal] = useState<ModalState | null>(null);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [formError, setFormError] = useState('');
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [busy, setBusy] = useState(false);

  const statusFilterConfig = config.filters?.find((filter) => filter.param === 'status');
  const facetFilterConfig = config.filters?.find((filter) => filter.param === 'filter');
  const facetOptions = facetFilterConfig?.options
    ?? (facetFilterConfig?.facet ? facets[facetFilterConfig.facet] ?? [] : []);

  const refresh = useCallback(() => {
    setLoading(true);
    setError('');
    setSelected(new Set());
    setMenuOpen('');
    setRefreshToken((token) => token + 1);
  }, []);

  const beginRequest = useCallback(() => {
    setLoading(true);
    setError('');
    setSelected(new Set());
    setMenuOpen('');
  }, []);

  const openDetail = useCallback((id: string) => {
    setDetailId(id);
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const control = new AbortController();

    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (debouncedQ) params.set('q', debouncedQ);
    if (statusFilter) params.set('status', statusFilter);
    if (facetFilter) params.set('filter', facetFilter);
    if (sort) params.set('sort', sort);
    if (dir) params.set('dir', dir);

    apiFetch<AdminListResponse>(`/api/admin/console/${config.module}?${params.toString()}`, {
      signal: control.signal,
    })
      .then((data) => {
        if (cancelled) return;
        setRows(data.rows ?? []);
        setMeta({ page: data.page, pageSize: data.pageSize, total: data.total, pageCount: data.pageCount });
        setSummary(data.summary ?? {});
        setFacets((data.facets ?? {}) as Record<string, AdminOption[]>);
        setSecondary(data.secondary);
      })
      .catch((fetchError) => {
        if (cancelled || control.signal.aborted) return;
        setError(errorMessage(fetchError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      control.abort();
    };
  }, [config.module, page, pageSize, debouncedQ, statusFilter, facetFilter, sort, dir, refreshToken]);

  useEffect(() => {
    if (!detailId) return;
    let cancelled = false;
    const control = new AbortController();
    apiFetch<AdminDetailResponse>(`/api/admin/console/${config.module}?id=${encodeURIComponent(detailId)}`, {
      signal: control.signal,
    })
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((fetchError) => {
        if (!cancelled && !control.signal.aborted) setDetailError(errorMessage(fetchError));
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
      control.abort();
    };
  }, [config.module, detailId, refreshToken]);

  const secondaryOptions: AdminOption[] = useMemo(() => {
    return (secondary?.rows ?? []).map((row) => ({
      value: String(row.key ?? row.id ?? ''),
      label: String(row.name ?? row.key ?? ''),
    })).filter((option) => option.value);
  }, [secondary]);

  const optionsFor = useCallback((field: AdminFormField): AdminOption[] => {
    if (field.options) return field.options;
    if (field.optionsFromSecondary) return secondaryOptions;
    if (field.optionsFromFacet) return facets[field.optionsFromFacet] ?? [];
    return [];
  }, [facets, secondaryOptions]);

  const openModal = useCallback((state: ModalState) => {
    const seed: Record<string, unknown> = {};
    const fields: AdminFormField[] = state.kind === 'create'
      ? config.createFields ?? []
      : state.action.fields ?? [];
    for (const field of fields) {
      let value: unknown = field.defaultValue ?? '';
      if (state.row && state.row[field.key] !== undefined) {
        value = state.row[field.key];
      }
      seed[field.key] = field.type === 'datetime'
        ? toDateTimeInput(value)
        : field.type === 'checkbox'
          ? Boolean(value)
          : field.type === 'json'
            ? toInputValue(value)
            : value;
    }
    setFormValues(seed);
    setFormError('');
    setModal(state);
  }, [config.createFields]);

  const closeModal = () => {
    if (busy) return;
    setModal(null);
    setFormError('');
  };

  const runMutation = useCallback(async (input: {
    action: string;
    row?: Row;
    ids?: string[];
    values?: Record<string, unknown>;
    method?: 'POST' | 'PATCH' | 'DELETE';
    successMessage: string;
  }) => {
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        action: input.action,
        values: input.values ?? {},
      };
      if (input.row) body.id = rowId(input.row);
      if (input.ids?.length) body.ids = input.ids;
      await apiFetch(`/api/admin/console/${config.module}`, {
        method: input.method ?? (input.action === 'delete' ? 'DELETE' : 'PATCH'),
        body: JSON.stringify(body),
        dedupe: false,
      });
      show(input.successMessage, 'success');
      setModal(null);
      setConfirmState(null);
      setSelected(new Set());
      setDetailId('');
      refresh();
    } catch (mutationError) {
      const message = errorMessage(mutationError);
      if (message) {
        if (modal) setFormError(message);
        else show(message, 'danger');
      }
    } finally {
      setBusy(false);
    }
  }, [config.module, modal, refresh, show]);

  const startAction = useCallback((action: AdminActionConfig, row?: Row) => {
    setMenuOpen('');
    if (action.fields?.length) {
      openModal({
        kind: row ? 'row' : 'bulk',
        action,
        row,
        title: action.label,
      });
      return;
    }
    if (action.confirm) {
      setConfirmState({ action, row });
      return;
    }
    const ids = row ? [rowId(row)] : [];
    void runMutation({
      action: action.action,
      row,
      ids: row ? undefined : [...selected],
      successMessage: `${action.label} completed.`,
    });
  }, [openModal, runMutation, selected]);

  const submitModal = async () => {
    if (!modal) return;
    const fields = modal.kind === 'create' ? config.createFields ?? [] : modal.action.fields ?? [];
    for (const field of fields) {
      if (field.required && isBlank(formValues[field.key])) {
        setFormError(`${field.label} is required.`);
        return;
      }
    }
    const values: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = formValues[field.key];
      if (field.type === 'json') {
        if (isBlank(raw)) {
          values[field.key] = field.required ? undefined : field.key === 'features' ? [] : {};
          continue;
        }
        try {
          values[field.key] = typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch {
          setFormError(`${field.label} must be valid JSON.`);
          return;
        }
      } else if (field.type === 'checkbox') {
        values[field.key] = Boolean(raw);
      } else if (field.type === 'number') {
        values[field.key] = raw === '' ? undefined : Number(raw);
      } else {
        values[field.key] = raw;
      }
    }
    if (modal.kind === 'create') {
      await runMutation({
        action: config.createAction ?? 'create',
        values,
        method: 'POST',
        successMessage: 'Record created.',
      });
      return;
    }
    if (modal.kind === 'bulk') {
      await runMutation({
        action: modal.action.action,
        ids: [...selected],
        values,
        successMessage: `${modal.action.label} completed.`,
      });
      return;
    }
    const row = modal.row;
    if (!row) return;
    if (modal.action.action === 'delete') {
      await runMutation({
        action: 'delete',
        row,
        method: 'DELETE',
        successMessage: 'Record deleted.',
      });
      return;
    }
    await runMutation({
      action: modal.action.action,
      row,
      values,
      successMessage: `${modal.action.label} completed.`,
    });
  };

  const detailAction = (actionKey: string) => {
    const action = config.rowActions?.find((item) => item.action === actionKey || item.key === actionKey);
    if (action) {
      startAction(action, detail ? { id: detailId } : undefined);
      return;
    }
    void runMutation({ action: actionKey, row: { id: detailId }, successMessage: 'Action completed.' });
  };

  const allOnPageSelected = rows.length > 0 && rows.every((row) => selected.has(rowId(row)));
  const toggleAll = () => {
    if (allOnPageSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(rows.map(rowId)));
  };
  const toggleRow = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const changeSort = (column: AdminColumnConfig) => {
    if (!column.sortable) return;
    beginRequest();
    if (sort === column.key) setDir((current) => (current === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(column.key);
      setDir('desc');
    }
  };

  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set('q', debouncedQ);
    if (statusFilter) params.set('status', statusFilter);
    if (facetFilter) params.set('filter', facetFilter);
    return `/api/admin/console/export/${config.module}?${params.toString()}`;
  }, [config.module, debouncedQ, statusFilter, facetFilter]);

  const activeFilterCount = Number(Boolean(statusFilter)) + Number(Boolean(facetFilter)) + Number(Boolean(debouncedQ));
  const availableRowActions = (config.rowActions ?? []).filter((action) => {
    if (!canManage) return false;
    if ((action.action === 'delete' || action.action === 'remove_admin') && !canDelete) return false;
    return true;
  });
  const activeMenuRow = menuOpen ? rows.find((row) => rowId(row) === menuOpen) ?? null : null;

  if (!canRead) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 py-8">
        <EmptyState
          title="No access to this module"
          description="Your administrator role does not include permission to read this section. Ask a super admin to grant the matching permission."
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[26px] font-semibold leading-tight text-foreground">{config.title}</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">{config.description}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button type="button" onClick={refresh} className={cn(secondaryBtnCls, 'h-9 px-3')} aria-label="Refresh data">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </button>
          {config.exportable !== false && (
            <a href={exportHref} className={cn(secondaryBtnCls, 'h-9 px-3')} download>
              <Download className="h-4 w-4" />
              Export CSV
            </a>
          )}
          {canManage && config.createFields?.length ? (
            <button
              type="button"
              onClick={() => openModal({ kind: 'create', action: { key: 'create', label: config.createLabel ?? 'Create', action: config.createAction ?? 'create' }, title: config.createLabel ?? 'Create record' })}
              className={cn(primaryBtnCls, 'h-9 px-4')}
            >
              <Plus className="h-4 w-4" />
              {config.createLabel ?? 'Create'}
            </button>
          ) : null}
        </div>
      </div>

      {config.summaryKeys?.length ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {config.summaryKeys.map((item) => (
            <div key={item.key} className="neu-card rounded-[14px] px-4 py-3">
              <p className="text-[12px] font-medium text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-[22px] font-medium leading-none tabular-nums text-foreground">
                {summaryValue(summary[item.key], item.type)}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="neu-card overflow-hidden rounded-[16px]">
        <div className="flex flex-col gap-3 border-b border-border p-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(event) => { beginRequest(); setQ(event.target.value); setPage(1); }}
              placeholder={config.searchPlaceholder ?? 'Search'}
              aria-label={config.searchPlaceholder ?? 'Search'}
              className={cn(fieldCls, 'h-9 w-full pl-9 pr-3')}
            />
          </div>

          {statusFilterConfig ? (
            <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <span className="sr-only">{statusFilterConfig.label}</span>
              <select
                value={statusFilter}
                onChange={(event) => { beginRequest(); setStatusFilter(event.target.value); setPage(1); }}
                className={cn(fieldCls, 'h-9 min-w-[9.5rem] px-2.5')}
              >
                <option value="">{statusFilterConfig.allLabel ?? `All ${statusFilterConfig.label.toLowerCase()}`}</option>
                {(statusFilterConfig.options ?? []).map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          ) : null}

          {facetFilterConfig ? (
            <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <span className="sr-only">{facetFilterConfig.label}</span>
              <select
                value={facetFilter}
                onChange={(event) => { beginRequest(); setFacetFilter(event.target.value); setPage(1); }}
                className={cn(fieldCls, 'h-9 min-w-[10rem] max-w-[15rem] px-2.5')}
              >
                <option value="">{facetFilterConfig.allLabel ?? `All ${facetFilterConfig.label.toLowerCase()}`}</option>
                {facetOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          ) : null}

          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={() => { beginRequest(); setQ(''); setStatusFilter(''); setFacetFilter(''); setPage(1); }}
              className={cn(ghostBtnCls, 'h-9 px-2.5')}
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          ) : (
            <span className="hidden items-center gap-1.5 text-[12px] text-muted-foreground lg:flex">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {meta.total.toLocaleString()} records
            </span>
          )}
        </div>

        {selected.size > 0 && config.bulkActions?.length && canManage ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-accent/40 px-3 py-2">
            <span className="text-[12px] font-medium text-accent-foreground">{selected.size} selected</span>
            {config.bulkActions.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={() => startAction(action)}
                className={cn(
                  'h-8 rounded-[8px] px-2.5 text-[12px] font-medium shadow-[var(--shadow-raised-sm)]',
                  action.tone === 'danger' ? 'text-destructive' : 'text-foreground',
                  'bg-card hover:shadow-[var(--shadow-raised)]',
                )}
              >
                {action.label}
              </button>
            ))}
            <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-[12px] text-muted-foreground hover:text-foreground">
              Clear selection
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <p className="text-sm font-medium text-foreground">Could not load this module</p>
            <p className="max-w-md text-[13px] text-muted-foreground">{error}</p>
            <button type="button" onClick={refresh} className={cn(secondaryBtnCls, 'mt-1 h-9 px-3')}>
              Try again
            </button>
          </div>
        ) : loading && rows.length === 0 ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 7 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<Search className="h-5 w-5" />}
            title={config.emptyTitle ?? 'No records found'}
            description={config.emptyDescription ?? 'Try a different search or clear the filters. Nothing here is hidden by the interface.'}
            action={activeFilterCount > 0 ? (
              <button type="button" onClick={() => { setQ(''); setStatusFilter(''); setFacetFilter(''); }} className={cn(secondaryBtnCls, 'h-9 px-3')}>
                Clear filters
              </button>
            ) : undefined}
          />
        ) : (
          <div className={cn('overflow-x-auto transition-opacity', loading && 'opacity-60')}>
            <table className="w-full min-w-[64rem] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-border text-[12px] text-muted-foreground">
                  {canManage && config.bulkActions?.length ? (
                    <th scope="col" className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        aria-label="Select all rows on this page"
                        checked={allOnPageSelected}
                        onChange={toggleAll}
                        className="h-3.5 w-3.5 accent-[var(--primary)]"
                      />
                    </th>
                  ) : null}
                  {config.columns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className={cn('whitespace-nowrap px-3 py-2.5 font-medium', column.secondary && 'hidden xl:table-cell')}
                      style={column.width ? { width: column.width } : undefined}
                    >
                      {column.sortable ? (
                        <button
                          type="button"
                          onClick={() => changeSort(column)}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          {column.label}
                          <ChevronDown className={cn(
                            'h-3 w-3 transition-transform',
                            sort === column.key ? 'text-foreground' : 'opacity-0',
                            sort === column.key && dir === 'asc' && 'rotate-180',
                          )} />
                        </button>
                      ) : column.label}
                    </th>
                  ))}
                  <th scope="col" className="w-28 px-3 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const id = rowId(row);
                  const actions = availableRowActions.filter((action) => !action.visibleWhen || action.visibleWhen(row));
                  return (
                    <tr
                      key={id || JSON.stringify(row).slice(0, 40)}
                      className={cn(
                        'border-b border-border/70 transition-colors last:border-0',
                        selected.has(id) ? 'bg-accent/30' : 'hover:bg-muted/50',
                      )}
                    >
                      {canManage && config.bulkActions?.length ? (
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            aria-label="Select row"
                            checked={selected.has(id)}
                            onChange={() => toggleRow(id)}
                            className="h-3.5 w-3.5 accent-[var(--primary)]"
                          />
                        </td>
                      ) : null}
                      {config.columns.map((column) => (
                        <td key={column.key} className={cn(
                          'px-3 py-2 align-middle text-foreground',
                          column.secondary && 'hidden xl:table-cell',
                        )}>
                          {formatCell(row[column.key], column)}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!config.disableDetail ? (
                            <button
                              type="button"
                              onClick={() => openDetail(id)}
                              className="rounded-[7px] px-2 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                              View
                            </button>
                          ) : null}
                          {actions.length ? (
                            <button
                              type="button"
                              aria-label="Row actions"
                              aria-expanded={menuOpen === id}
                              onClick={(event) => toggleMenu(event, id)}
                              className="flex h-7 w-7 items-center justify-center rounded-[7px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                            >
                              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', menuOpen === id && 'rotate-180')} />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-border px-3 py-2.5 text-[12px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span>
              {meta.total === 0 ? '0 records' : `${(meta.page - 1) * meta.pageSize + 1}-${Math.min(meta.page * meta.pageSize, meta.total)} of ${meta.total.toLocaleString()}`}
            </span>
            <select
              value={pageSize}
              onChange={(event) => { beginRequest(); setPageSize(Number(event.target.value)); setPage(1); }}
              aria-label="Rows per page"
              className={cn(fieldCls, 'h-7 px-1.5 text-[12px]')}
            >
              {[10, 25, 50, 100].map((value) => <option key={value} value={value}>{value} per page</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => { beginRequest(); setPage((current) => Math.max(1, current - 1)); }}
              disabled={meta.page <= 1}
              className={cn(secondaryBtnCls, 'h-7 w-7 p-0')}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-1 tabular-nums">Page {meta.page} of {meta.pageCount}</span>
            <button
              type="button"
              onClick={() => { beginRequest(); setPage((current) => Math.min(meta.pageCount, current + 1)); }}
              disabled={meta.page >= meta.pageCount}
              className={cn(secondaryBtnCls, 'h-7 w-7 p-0')}
              aria-label="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Fixed-position row-actions menu: escapes the table's overflow-x clip. */}
      {menuOpen && menuAnchor ? (
        <>
          <button type="button" aria-label="Close actions" className="fixed inset-0 z-30 cursor-default bg-transparent" onClick={() => closeMenu()} />
          <div
            role="menu"
            aria-label="Row actions"
            className="fixed z-40 max-h-72 w-52 overflow-y-auto overscroll-contain rounded-[12px] border border-border bg-popover p-1.5 shadow-[var(--shadow-raised-lg)]"
            style={{ top: menuAnchor.y, left: menuAnchor.x }}
          >
            {activeMenuRow ? availableRowActions.filter((action) => !action.visibleWhen || action.visibleWhen(activeMenuRow)).map((action) => (
              <button
                key={action.key}
                role="menuitem"
                type="button"
                onClick={() => startAction(action, activeMenuRow)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[13px] leading-snug transition-colors hover:bg-muted',
                  action.tone === 'danger' ? 'text-destructive hover:bg-destructive/10' : 'text-foreground',
                )}
              >
                {action.label}
              </button>
            )) : (
              <div className="px-2.5 py-3 text-[12px] text-muted-foreground">This record no longer exists in this list.</div>
            )}
          </div>
        </>
      ) : null}

      {secondary?.rows?.length ? (
        <div className="neu-card overflow-hidden rounded-[16px]">
          <div className="border-b border-border px-4 py-2.5">
            <h2 className="text-[13px] font-medium text-foreground">{config.secondaryTitle ?? secondary.label}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-[13px]">
              <thead>
                <tr className="border-b border-border text-[12px] text-muted-foreground">
                  {secondary.columns.map((column) => (
                    <th key={column.key} scope="col" className="px-3 py-2 font-medium">{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {secondary.rows.map((row, index) => (
                  <tr key={String(row.id ?? row.key ?? index)} className="border-b border-border/70 last:border-0">
                    {secondary.columns.map((column) => (
                      <td key={column.key} className="px-3 py-2 align-middle">
                        {formatCell(row[column.key], { key: column.key, label: column.label, type: column.type })}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {detailId ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" aria-label="Close detail" className="absolute inset-0 bg-black/40" onClick={() => { if (!busy) setDetailId(''); }} />
          <aside className="relative flex h-full w-full max-w-xl flex-col bg-card shadow-[var(--shadow-raised-lg)]">
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <h2 className="truncate text-[17px] font-semibold text-foreground">{detail?.title ?? 'Loading record'}</h2>
                <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{detail?.subtitle ?? config.title}</p>
              </div>
              <button type="button" onClick={() => setDetailId('')} aria-label="Close detail" className="rounded-[8px] p-1.5 text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
              {detailLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-9 w-full" />)}
                </div>
              ) : detailError ? (
                <div className="rounded-[10px] border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
                  {detailError}
                </div>
              ) : detail ? (
                <>
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                    {detail.fields.map((field) => (
                      <div key={field.key} className={cn(field.type === 'json' && 'sm:col-span-2')}>
                        <dt className="text-[12px] text-muted-foreground">{field.label}</dt>
                        <dd className="mt-0.5 break-words text-[13px] text-foreground">
                          {field.type === 'json'
                            ? <pre className="max-h-48 overflow-auto rounded-[8px] bg-input p-2 font-mono text-[11px]">{JSON.stringify(field.value ?? null, null, 2)}</pre>
                            : formatCell(field.value, { key: field.key, label: field.label, type: field.type })}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  {detail.sections.map((section) => (
                    <section key={section.title} className="space-y-2">
                      <div>
                        <h3 className="text-[13px] font-medium text-foreground">{section.title}</h3>
                        {section.description ? <p className="text-[12px] text-muted-foreground">{section.description}</p> : null}
                      </div>
                      {section.fields?.length ? (
                        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                          {section.fields.map((field) => (
                            <div key={field.key}>
                              <dt className="text-[12px] text-muted-foreground">{field.label}</dt>
                              <dd className="mt-0.5 text-[13px] text-foreground">
                                {formatCell(field.value, { key: field.key, label: field.label, type: field.type })}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                      {section.rows?.length && section.columns?.length ? (
                        <div className="overflow-x-auto rounded-[10px] border border-border">
                          <table className="w-full text-left text-[12px]">
                            <thead className="bg-muted/60 text-muted-foreground">
                              <tr>
                                {section.columns.map((column) => (
                                  <th key={column.key} scope="col" className="whitespace-nowrap px-2 py-1.5 font-medium">{column.label}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {section.rows.map((row, index) => (
                                <tr key={String(row.id ?? index)} className="border-t border-border/60">
                                  {section.columns!.map((column) => (
                                    <td key={column.key} className="px-2 py-1.5 align-top">
                                      {formatCell(row[column.key], { key: column.key, label: column.label, type: column.type })}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                      {!section.fields?.length && !section.rows?.length ? (
                        <p className="text-[12px] text-muted-foreground">No records.</p>
                      ) : null}
                    </section>
                  ))}
                </>
              ) : null}
            </div>

            {detail?.actions?.length && canManage ? (
              <div className="flex flex-wrap gap-2 border-t border-border px-5 py-3">
                {detail.actions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    onClick={() => detailAction(action.key)}
                    className={cn(
                      action.tone === 'danger' ? 'text-destructive' : 'text-foreground',
                      'h-8 rounded-[8px] bg-card px-3 text-[12px] font-medium shadow-[var(--shadow-raised-sm)] hover:shadow-[var(--shadow-raised)]',
                    )}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close form" className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <form
            className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[16px] bg-card shadow-[var(--shadow-raised-lg)]"
            onSubmit={(event) => { event.preventDefault(); void submitModal(); }}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <div>
                <h2 className="text-[16px] font-semibold text-foreground">{modal.title}</h2>
                <p className="text-[12px] text-muted-foreground">
                  {modal.kind === 'bulk' ? `${selected.size} selected records` : modal.kind === 'create' ? 'New record' : 'Update record'}
                </p>
              </div>
              <button type="button" onClick={closeModal} aria-label="Close form" className="rounded-[8px] p-1.5 text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto px-5 py-4 sm:grid-cols-2">
              {(modal.kind === 'create' ? config.createFields ?? [] : modal.action.fields ?? []).map((field) => {
                const value = formValues[field.key];
                const inputId = `admin-field-${field.key}`;
                const options = optionsFor(field);
                return (
                  <div key={field.key} className={cn(field.fullWidth || field.type === 'textarea' || field.type === 'json' ? 'sm:col-span-2' : '')}>
                    <label htmlFor={inputId} className="mb-1 block text-[12px] font-medium text-muted-foreground">
                      {field.label}{field.required ? <span className="text-destructive"> *</span> : null}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        id={inputId}
                        value={String(value ?? '')}
                        onChange={(event) => setFormValues((current) => ({ ...current, [field.key]: event.target.value }))}
                        rows={4}
                        placeholder={field.placeholder}
                        className={cn(fieldCls, 'w-full px-3 py-2')}
                      />
                    ) : field.type === 'json' ? (
                      <textarea
                        id={inputId}
                        value={String(value ?? '')}
                        onChange={(event) => setFormValues((current) => ({ ...current, [field.key]: event.target.value }))}
                        rows={4}
                        placeholder={field.placeholder}
                        className={cn(fieldCls, 'w-full px-3 py-2 font-mono text-[12px]')}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        id={inputId}
                        value={String(value ?? '')}
                        onChange={(event) => setFormValues((current) => ({ ...current, [field.key]: event.target.value }))}
                        className={cn(fieldCls, 'h-9 w-full px-2.5')}
                      >
                        <option value="">Select {field.label.toLowerCase()}</option>
                        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    ) : field.type === 'checkbox' ? (
                      <label htmlFor={inputId} className="flex h-9 items-center gap-2 text-[13px] text-foreground">
                        <input
                          id={inputId}
                          type="checkbox"
                          checked={Boolean(value)}
                          onChange={(event) => setFormValues((current) => ({ ...current, [field.key]: event.target.checked }))}
                          className="h-4 w-4 accent-[var(--primary)]"
                        />
                        Enabled
                      </label>
                    ) : (
                      <input
                        id={inputId}
                        type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : field.type === 'datetime' ? 'datetime-local' : 'text'}
                        value={String(value ?? '')}
                        onChange={(event) => setFormValues((current) => ({ ...current, [field.key]: event.target.value }))}
                        placeholder={field.placeholder}
                        className={cn(fieldCls, 'h-9 w-full px-3')}
                      />
                    )}
                    {field.help ? <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{field.help}</p> : null}
                  </div>
                );
              })}
            </div>

            {modal.action.confirm || formError ? (
              <div className="px-5 pb-2">
                {modal.action.confirm ? (
                  <p className="flex items-start gap-2 rounded-[8px] bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {modal.action.confirm}
                  </p>
                ) : null}
                {formError ? <p className="mt-2 text-[12px] text-destructive">{formError}</p> : null}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              <button type="button" onClick={closeModal} className={cn(secondaryBtnCls, 'h-9 px-4')} disabled={busy}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className={cn(modal.action.tone === 'danger' ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground', 'inline-flex h-9 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-medium shadow-[var(--shadow-raised-sm)] transition-[transform,box-shadow] hover:-translate-y-px active:translate-y-0 disabled:opacity-60')}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {modal.kind === 'create' ? 'Create' : modal.action.label}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {confirmState ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Cancel confirmation" className="absolute inset-0 bg-black/40" onClick={() => { if (!busy) setConfirmState(null); }} />
          <div className="relative w-full max-w-md rounded-[16px] bg-card p-5 shadow-[var(--shadow-raised-lg)]">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-[15px] font-semibold text-foreground">{confirmState.action.label}</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{confirmState.action.confirm}</p>
                {confirmState.row ? (
                  <p className="mt-2 text-[12px] text-foreground">
                    Target: {String(confirmState.row.email ?? confirmState.row.name ?? confirmState.row.subject ?? confirmState.row.email_address ?? rowId(confirmState.row))}
                  </p>
                ) : (
                  <p className="mt-2 text-[12px] text-foreground">{selected.size} selected records</p>
                )}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmState(null)} disabled={busy} className={cn(secondaryBtnCls, 'h-9 px-4')}>
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runMutation({
                  action: confirmState.action.action,
                  row: confirmState.row,
                  ids: confirmState.row ? undefined : [...selected],
                  method: confirmState.action.action === 'delete' ? 'DELETE' : 'PATCH',
                  successMessage: `${confirmState.action.label} completed.`,
                })}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-[10px] bg-destructive px-4 text-sm font-medium text-destructive-foreground shadow-[var(--shadow-raised-sm)] disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {confirmState.action.tone === 'danger' ? 'Confirm' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
