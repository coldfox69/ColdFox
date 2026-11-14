'use client';

import { useRef, useState } from 'react';
import {
  UploadCloud, FileSpreadsheet, AlertTriangle, Copy, Sparkles, X, CheckCircle2, Loader2, ClipboardPaste,
} from 'lucide-react';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { cn } from '@/lib/utils';

export type CrmField =
  | 'first_name' | 'last_name' | 'email' | 'company' | 'job_title' | 'website'
  | 'industry' | 'phone' | 'linkedin_url' | 'city' | 'country' | 'custom' | 'ignore';

export interface AnalyzedColumn {
  name: string;
  mappedField: Exclude<CrmField, 'custom'>;
  confidence: number;
  ambiguous: boolean;
  reason: string;
  sample?: string;
}

interface AnalyzeResponse {
  filename: string;
  sheetName: string | null;
  headers: string[];
  totalRows: number;
  preview: (string | number | null)[][];
  analysis: {
    source: 'ai' | 'heuristic';
    columns: AnalyzedColumn[];
    missingFields: string[];
    suggestedVariables: string[];
    ambiguousColumns: string[];
    notes: string[];
    detected: { emailColumn: string | null; totalRows: number; invalidEmailRows: number; duplicateRows: number; emptyRows: number };
  };
}

export interface ImportResult {
  created: number;
  duplicates: number;
  invalid: number;
  sampleInvalid: string[];
  limited: boolean;
  totalRows: number;
  leadIds: string[];
  leadListId?: string;
  leadListName?: string;
  placeholders?: string[];
}

const FIELD_LABELS: Record<CrmField, string> = {
  first_name: 'First name',
  last_name: 'Last name',
  email: 'Email',
  company: 'Company',
  job_title: 'Job title',
  website: 'Website',
  industry: 'Industry',
  phone: 'Phone',
  linkedin_url: 'LinkedIn URL',
  city: 'City',
  country: 'Country',
  custom: 'Personalization field (keep as {{column}})',
  ignore: 'Do not import',
};

const FIELD_ORDER: CrmField[] = [
  'email', 'first_name', 'last_name', 'company', 'job_title', 'website',
  'industry', 'phone', 'linkedin_url', 'city', 'country', 'custom', 'ignore',
];

const MAX_BYTES = 5 * 1024 * 1024;
const inputCls = 'w-full rounded-[10px] border border-border bg-input px-3.5 py-2.5 text-[13px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-60';
const primaryBtn = 'inline-flex items-center justify-center gap-2 rounded-[10px] bg-primary px-5 py-2.5 text-[13px] font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[filter] hover:brightness-105 disabled:pointer-events-none disabled:opacity-50';
const secondaryBtn = 'inline-flex items-center gap-2 rounded-[10px] border border-border bg-card px-4 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted';

type InputMode = 'file' | 'paste';

export function LeadImportStep({
  onComplete,
  nameFirst = false,
  listName: controlledName,
  onListNameChange,
}: {
  onComplete?: (result: ImportResult) => void;
  /** When true the name field is shown first and the upload area lives under it. */
  nameFirst?: boolean;
  listName?: string;
  onListNameChange?: (value: string) => void;
}) {
  const [inputMode, setInputMode] = useState<InputMode>('file');
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [mapping, setMapping] = useState<Record<string, CrmField>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [listNameState, setListNameState] = useState('');
  const [pasted, setPasted] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const listName = controlledName ?? listNameState;
  const setListName = (value: string) => {
    if (controlledName !== undefined) onListNameChange?.(value);
    else setListNameState(value);
  };

  const reset = () => {
    setFile(null);
    setAnalysis(null);
    setMapping({});
    setError('');
    setResult(null);
    setPasted('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const analyze = async (next: File) => {
    setError('');
    setResult(null);
    setAnalyzing(true);
    setFile(next);
    try {
      const form = new FormData();
      form.append('file', next);
      const data = await apiFetch<AnalyzeResponse>('/api/leads/import/analyze', { method: 'POST', body: form });
      setAnalysis(data);
      setMapping(Object.fromEntries(data.analysis.columns.map((column) => [column.name, column.mappedField])));
    } catch (cause) {
      setFile(null);
      setAnalysis(null);
      setError(errorMessage(cause));
    } finally {
      setAnalyzing(false);
    }
  };

  const analyzePasted = () => {
    const trimmed = pasted.trim();
    if (trimmed.length < 3) {
      setError('Paste at least a header row and one lead row from your spreadsheet.');
      return;
    }
    // Treat pasted content as a CSV; Excel clipboard output is tab-separated, which csv-parse handles as TSV when the extension is .tsv.
    const delimiter = trimmed.includes('\t') && !trimmed.split('\n')[0].includes(',') ? '\t' : ',';
    const ext = delimiter === '\t' ? 'pasted.tsv' : 'pasted.csv';
    const blob = new File([trimmed], ext, { type: delimiter === '\t' ? 'text/tab-separated-values' : 'text/csv' });
    void analyze(blob);
  };

  const pickFile = (next: File | undefined) => {
    if (!next) return;
    if (!/\.(csv|tsv|xlsx)$/i.test(next.name)) {
      setError('Choose a .csv, .tsv, or .xlsx file.');
      return;
    }
    if (next.size > MAX_BYTES) {
      setError('The file is larger than 5 MB. Split it into smaller files.');
      return;
    }
    void analyze(next);
  };

  const importLeads = async () => {
    if (!file || !analysis) return;
    if (!Object.values(mapping).includes('email')) {
      setError('Map one column to Email before importing.');
      return;
    }
    if (listName.trim().length < 2) {
      setError('Give this lead list a name, for example "SaaS Founders".');
      return;
    }
    setError('');
    setImporting(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('lead_list_name', listName.trim());
      form.append('mapping', JSON.stringify(Object.entries(mapping).map(([header, field]) => ({ header, field }))));
      const data = await apiFetch<ImportResult>('/api/leads/import/confirm', { method: 'POST', body: form });
      setResult(data);
      onComplete?.(data);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setImporting(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-5">
        <div className="rounded-[12px] border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <div className="icon-tile-success h-10 w-10 shrink-0 rounded-[10px]">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-foreground">Import finished</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                {result.created.toLocaleString()} lead{result.created === 1 ? '' : 's'} saved to <span className="font-medium text-foreground">{result.leadListName ?? 'your lead list'}</span> from {result.totalRows.toLocaleString()} rows.
              </p>
              {result.placeholders && result.placeholders.length > 0 && (
                <p className="mt-2 text-[12px] text-muted-foreground">Variables: {result.placeholders.slice(0, 8).join(' · ')}{result.placeholders.length > 8 ? ` · +${result.placeholders.length - 8} more` : ''}</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Imported', value: result.created, tone: 'text-[var(--success)]' },
            { label: 'Duplicates skipped', value: result.duplicates, tone: 'text-[var(--warning)]' },
            { label: 'Invalid emails', value: result.invalid, tone: 'text-[var(--danger)]' },
            { label: 'Rows in file', value: result.totalRows, tone: 'text-foreground' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-[12px] border border-border bg-card p-3">
              <p className="text-[12px] text-muted-foreground">{stat.label}</p>
              <p className={cn('mt-0.5 text-[17px] font-semibold tabular-nums', stat.tone)}>{stat.value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {result.limited && (
          <p className="flex gap-2 rounded-[10px] border border-[var(--warning-border)] bg-[var(--warning-soft)] p-3 text-[12px] text-[var(--warning)]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Your plan&apos;s lead limit was reached partway through. The remaining rows were not imported.
          </p>
        )}
        {result.sampleInvalid.length > 0 && (
          <div className="rounded-[12px] border border-border bg-card p-4">
            <p className="mb-2 text-[13px] font-medium text-foreground">Invalid addresses that were skipped</p>
            <p className="break-all font-mono text-[12px] text-muted-foreground">{result.sampleInvalid.join(', ')}</p>
          </div>
        )}

        <button type="button" onClick={reset} className={secondaryBtn}>
          Import another file
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {nameFirst && (
        <div className="rounded-[12px] border border-border bg-card p-5">
          <label htmlFor="lead-list-name-top" className="mb-1.5 block text-[13px] font-semibold text-foreground">Lead list name</label>
          <input
            id="lead-list-name-top"
            autoFocus
            className={inputCls}
            placeholder='e.g. "SaaS Founders" or "US Business Owners"'
            value={listName}
            onChange={(event) => setListName(event.target.value)}
          />
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">Name the list first, then upload the lead sheet or paste it below.</p>
        </div>
      )}
      {!file && (
        <>
          <div className="inline-flex gap-1 rounded-[10px] border border-border bg-muted p-1" role="tablist" aria-label="Import method">
            {([['file', 'Upload file'], ['paste', 'Paste data']] as const).map(([mode, label]) => (
              <button
                key={mode}
                role="tab"
                aria-selected={inputMode === mode}
                onClick={() => { setInputMode(mode); setError(''); }}
                className={cn('rounded-[8px] px-3 py-1.5 text-[12px] font-medium transition-colors', inputMode === mode ? 'bg-card text-foreground shadow-[var(--shadow-raised-sm)]' : 'text-muted-foreground hover:text-foreground')}
              >
                {label}
              </button>
            ))}
          </div>

          {inputMode === 'file' ? (
            <div
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => { event.preventDefault(); setDragging(false); pickFile(event.dataTransfer.files[0]); }}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click(); }}
              role="button"
              tabIndex={0}
              aria-label="Upload a lead file"
              className={cn(
                'cursor-pointer rounded-[14px] border-2 border-dashed p-8 text-center transition-colors sm:p-10',
                dragging ? 'border-primary bg-primary/[0.04]' : 'border-border bg-card hover:border-primary/40 hover:bg-muted/40',
              )}
            >
              <UploadCloud className="mx-auto mb-3 h-9 w-9 text-primary/70" />
              <p className="text-[14px] font-semibold text-foreground">Drop your lead file here</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">or click to browse. CSV, TSV, or XLSX up to 5 MB and 10,000 rows.</p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.tsv,.xlsx"
                className="hidden"
                onChange={(event) => pickFile(event.target.files?.[0])}
                aria-label="Choose lead file"
              />
            </div>
          ) : (
            <div className="space-y-3 rounded-[12px] border border-border bg-card p-5">
              <label htmlFor="paste-data" className="flex items-center gap-2 text-[13px] font-medium text-foreground"><ClipboardPaste className="h-4 w-4 text-primary" /> Paste your spreadsheet</label>
              <p className="-mt-1 text-[12px] leading-relaxed text-muted-foreground">Copy the header row and data rows from Excel or Google Sheets, then paste here.</p>
              <textarea
                id="paste-data"
                rows={10}
                className={cn(inputCls, 'font-mono text-[12px] leading-relaxed')}
                placeholder={'first_name,email,company_name\nAda,ada@acme.com,Acme Inc\nGrace,grace@globex.com,Globex'}
                value={pasted}
                onChange={(event) => setPasted(event.target.value)}
              />
              <div className="flex justify-end">
                <button type="button" onClick={analyzePasted} className={secondaryBtn}>
                  <FileSpreadsheet className="h-4 w-4" /> Analyze pasted data
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {analyzing && (
        <div className="flex items-center gap-3 rounded-[12px] border border-border bg-card p-6 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Analysing columns and checking email syntax…
        </div>
      )}

      {!analyzing && analysis && file && (
        <>
          <div className="flex items-center gap-3 rounded-[12px] border border-border bg-card p-4">
            <FileSpreadsheet className="h-8 w-8 shrink-0 text-[var(--cf-success)]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-foreground">{analysis.filename}</p>
              <p className="text-[12px] text-muted-foreground">
                {(file.size / 1024).toFixed(0)} KB · {analysis.totalRows.toLocaleString()} rows · {analysis.headers.length} columns
                {analysis.sheetName ? ` · ${analysis.sheetName}` : ''}
              </p>
            </div>
            <button type="button" onClick={reset} aria-label="Remove file" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Rows detected', value: analysis.totalRows, tone: 'text-foreground' },
              { label: 'Invalid emails', value: analysis.analysis.detected.invalidEmailRows, tone: 'text-destructive' },
              { label: 'Duplicates in file', value: analysis.analysis.detected.duplicateRows, tone: 'text-[var(--cf-warning)]' },
              { label: 'Empty rows', value: analysis.analysis.detected.emptyRows, tone: 'text-muted-foreground' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-[12px] border border-border bg-card p-3">
                <p className="text-[12px] text-muted-foreground">{stat.label}</p>
                <p className={cn('mt-0.5 text-[17px] font-semibold tabular-nums', stat.tone)}>{stat.value.toLocaleString()}</p>
              </div>
            ))}
          </div>

          <div className="rounded-[12px] border border-border bg-card p-5">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent-foreground" />
              <h3 className="text-[13px] font-semibold text-foreground">
                {analysis.analysis.source === 'ai' ? 'AI column analysis' : 'Column analysis'}
              </h3>
            </div>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              {analysis.analysis.source === 'ai'
                ? 'AI suggested the mappings below from masked headers and samples. Verify every field; the AI can be wrong.'
                : 'AI was unavailable, so deterministic header matching was used. Verify every field before importing.'}
            </p>
            {analysis.analysis.notes.length > 0 && (
              <ul className="mt-2 space-y-1 text-[12px] text-muted-foreground">
                {analysis.analysis.notes.map((note) => <li key={note}>{note}</li>)}
              </ul>
            )}
          </div>

          {!nameFirst && (
          <div className="rounded-[12px] border border-border bg-card p-5">
            <div>
              <label htmlFor="lead-list-name" className="mb-1.5 block text-[13px] font-semibold text-foreground">Lead list name</label>
              <input id="lead-list-name" className={inputCls} placeholder='e.g. "SaaS Founders" or "US Business Owners"' value={listName} onChange={(event) => setListName(event.target.value)} />
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">Every imported file becomes a named lead list with its own personalization variables.</p>
            </div>
          </div>
          )}

          <div className="rounded-[12px] border border-border bg-card p-5">
            <h3 className="mb-1 text-[13px] font-semibold text-foreground">Check the column mapping</h3>
            <p className="mb-3 text-[12px] leading-relaxed text-muted-foreground">Tell ColdFox what each column means. At least one column must be Email.</p>
            <div className="space-y-2">
              {analysis.analysis.columns.map((column) => {
                const current = mapping[column.name] ?? 'ignore';
                return (
                  <div key={column.name} className="grid gap-2 rounded-[10px] border border-border bg-muted/30 p-3 sm:grid-cols-[minmax(0,1fr)_240px] sm:items-center sm:gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-foreground">{column.name}</p>
                      <p className="text-[12px] text-muted-foreground">
                        {column.sample ? `e.g. ${column.sample}` : 'No sample value'}
                        {column.ambiguous ? ' · needs review' : ''}
                      </p>
                    </div>
                    <select
                      value={current}
                      onChange={(event) => setMapping((map) => ({ ...map, [column.name]: event.target.value as CrmField }))}
                      aria-label={`Map ${column.name} to a CRM field`}
                      className={cn(inputCls, current === 'email' ? 'border-[var(--cf-success)]' : '')}
                    >
                      {FIELD_ORDER.map((field) => <option key={field} value={field}>{FIELD_LABELS[field]}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
            {!Object.values(mapping).includes('email') && (
              <p className="mt-3 flex items-center gap-2 text-[12px] text-destructive">
                <AlertTriangle className="h-4 w-4" /> Map one column to Email to continue.
              </p>
            )}
            <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
              Columns set to “Personalization field” stay importable and appear as variables for this list (for example <code className="rounded bg-muted px-1 py-0.5">{'{{industry}}'}</code>).
            </p>
          </div>

          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <Copy className="h-3.5 w-3.5" /> Duplicate addresses already in your CRM are skipped automatically.
            </p>
            <button
              type="button"
              onClick={() => void importLeads()}
              disabled={importing || !Object.values(mapping).includes('email') || listName.trim().length < 2}
              className={primaryBtn}
            >
              {importing && <Loader2 className="h-4 w-4 animate-spin" />}
              {importing ? 'Importing…' : 'Import leads'}
            </button>
          </div>
        </>
      )}

      {error && <p role="alert" className="rounded-[10px] border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">{error}</p>}
    </div>
  );
}
