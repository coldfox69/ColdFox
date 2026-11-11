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
const inputCls = 'w-full px-3.5 py-2.5 rounded-[10px] border border-transparent bg-input text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60';

type InputMode = 'file' | 'paste';

export function LeadImportStep({ onComplete }: { onComplete?: (result: ImportResult) => void }) {
  const [inputMode, setInputMode] = useState<InputMode>('file');
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [mapping, setMapping] = useState<Record<string, CrmField>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [listName, setListName] = useState('');
  const [pasted, setPasted] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

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
      <div className="space-y-6">
        <div className="neu-card rounded-[16px] p-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl neu-inset-sm flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-[var(--cf-success)]" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Import finished</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {result.created.toLocaleString()} lead{result.created === 1 ? '' : 's'} saved to <span className="font-medium text-foreground">{result.leadListName ?? 'your lead list'}</span> from {result.totalRows.toLocaleString()} rows.
              </p>
              {result.placeholders && result.placeholders.length > 0 && (
                <p className="text-[12px] text-muted-foreground mt-2">Variables: {result.placeholders.slice(0, 8).join(' · ')}{result.placeholders.length > 8 ? ` · +${result.placeholders.length - 8} more` : ''}</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Imported', value: result.created, tone: 'text-[var(--cf-success)]' },
            { label: 'Duplicates skipped', value: result.duplicates, tone: 'text-[var(--cf-warning)]' },
            { label: 'Invalid emails', value: result.invalid, tone: 'text-destructive' },
            { label: 'Rows in file', value: result.totalRows, tone: 'text-foreground' },
          ].map((stat) => (
            <div key={stat.label} className="neu-card rounded-xl p-3">
              <p className="text-[12px] text-muted-foreground">{stat.label}</p>
              <p className={cn('text-[17px] font-semibold', stat.tone)}>{stat.value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {result.limited && (
          <p className="text-sm text-[var(--cf-warning)] flex gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> Your plan&apos;s lead limit was reached partway through. The remaining rows were not imported.
          </p>
        )}
        {result.sampleInvalid.length > 0 && (
          <div className="neu-card rounded-[16px] p-4">
            <p className="text-sm font-medium text-foreground mb-2">Invalid addresses that were skipped</p>
            <p className="text-[12px] text-muted-foreground font-mono break-all">{result.sampleInvalid.join(', ')}</p>
          </div>
        )}

        <button type="button" onClick={reset} className="px-4 py-2.5 rounded-[10px] bg-card text-sm font-medium text-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:shadow-[var(--shadow-raised)] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50">
          Import another file
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!file && (
        <>
          <div className="inline-flex gap-1 rounded-[10px] bg-input p-1 shadow-[var(--shadow-inset-sm)]" role="tablist" aria-label="Import method">
            {([['file', 'Upload file'], ['paste', 'Paste data']] as const).map(([mode, label]) => (
              <button
                key={mode}
                role="tab"
                aria-selected={inputMode === mode}
                onClick={() => { setInputMode(mode); setError(''); }}
                className={cn('rounded-[8px] px-3 py-1.5 text-[12px] font-medium transition-[color,background-color,box-shadow] duration-[var(--dur)] ease-[var(--ease)]', inputMode === mode ? 'bg-card text-foreground shadow-[var(--shadow-raised-sm)]' : 'text-muted-foreground hover:text-foreground')}
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
                'rounded-[16px] border-2 border-dashed p-10 text-center cursor-pointer transition-colors',
                dragging ? 'border-primary bg-accent' : 'border-border hover:border-blue-400 hover:bg-muted/40',
              )}
            >
              <UploadCloud className="w-10 h-10 text-accent-foreground mx-auto mb-3" />
              <p className="font-semibold text-foreground">Drag and drop your lead file here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse. CSV, TSV, or XLSX up to 5 MB and 10,000 rows.</p>
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
            <div className="neu-card rounded-[16px] p-5 space-y-3">
              <label htmlFor="paste-data" className="text-sm font-medium flex items-center gap-2"><ClipboardPaste className="w-4 h-4" /> Paste your spreadsheet</label>
              <textarea
                id="paste-data"
                rows={10}
                className={cn(inputCls, 'font-mono text-[12px] leading-relaxed')}
                placeholder={'first_name,email,company_name\nAda,ada@acme.com,Acme Inc\nGrace,grace@globex.com,Globex'}
                value={pasted}
                onChange={(event) => setPasted(event.target.value)}
              />
              <div className="flex justify-end">
                <button type="button" onClick={analyzePasted} className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border border-border text-sm font-medium hover:bg-muted">
                  <FileSpreadsheet className="w-4 h-4" /> Analyze pasted data
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {analyzing && (
        <div className="neu-card rounded-[16px] p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Analysing columns and checking email syntax…
        </div>
      )}

      {!analyzing && analysis && file && (
        <>
          <div className="neu-card rounded-[16px] p-4 flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-[var(--cf-success)]" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{analysis.filename}</p>
              <p className="text-[12px] text-muted-foreground">
                {(file.size / 1024).toFixed(0)} KB · {analysis.totalRows.toLocaleString()} rows · {analysis.headers.length} columns
                {analysis.sheetName ? ` · ${analysis.sheetName}` : ''}
              </p>
            </div>
            <button type="button" onClick={reset} aria-label="Remove file" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Rows detected', value: analysis.totalRows, tone: 'text-foreground' },
              { label: 'Invalid emails', value: analysis.analysis.detected.invalidEmailRows, tone: 'text-destructive' },
              { label: 'Duplicates in file', value: analysis.analysis.detected.duplicateRows, tone: 'text-[var(--cf-warning)]' },
              { label: 'Empty rows', value: analysis.analysis.detected.emptyRows, tone: 'text-muted-foreground' },
            ].map((stat) => (
              <div key={stat.label} className="neu-card rounded-xl p-3">
                <p className="text-[12px] text-muted-foreground">{stat.label}</p>
                <p className={cn('text-[17px] font-semibold', stat.tone)}>{stat.value.toLocaleString()}</p>
              </div>
            ))}
          </div>

          <div className="rounded-[16px] p-5 neu-inset-sm">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-accent-foreground" />
              <h3 className="font-semibold text-sm text-foreground">
                {analysis.analysis.source === 'ai' ? 'AI column analysis' : 'Column analysis'}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
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

          <div className="neu-card rounded-[16px] p-5">
            <div>
              <label htmlFor="lead-list-name" className="text-sm font-semibold text-foreground mb-1.5 block">Lead list name</label>
              <input id="lead-list-name" className={inputCls} placeholder='e.g. "SaaS Founders" or "US Business Owners"' value={listName} onChange={(event) => setListName(event.target.value)} />
              <p className="text-[12px] text-muted-foreground mt-1.5">Every imported file becomes a named lead list with its own personalization variables.</p>
            </div>
          </div>

          <div className="neu-card rounded-[16px] p-5">
            <h3 className="font-semibold text-sm text-foreground mb-3">Column mapping</h3>
            <div className="space-y-2">
              {analysis.analysis.columns.map((column) => {
                const current = mapping[column.name] ?? 'ignore';
                return (
                  <div key={column.name} className="grid sm:grid-cols-[minmax(0,1fr)_260px] gap-2 sm:gap-4 sm:items-center rounded-xl border border-border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{column.name}</p>
                      <p className="text-[12px] text-muted-foreground">
                        {column.sample ? `e.g. ${column.sample}` : 'No sample value'}
                        {column.ambiguous ? ' · needs review' : ''}
                      </p>
                    </div>
                    <select
                      value={current}
                      onChange={(event) => setMapping((map) => ({ ...map, [column.name]: event.target.value as CrmField }))}
                      aria-label={`Map ${column.name} to a CRM field`}
                      className={cn(
                        'w-full px-3 py-2 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring',
                        current === 'email' ? 'border-emerald-400' : 'border-input',
                      )}
                    >
                      {FIELD_ORDER.map((field) => <option key={field} value={field}>{FIELD_LABELS[field]}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
            {!Object.values(mapping).includes('email') && (
              <p className="mt-3 text-sm text-destructive flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Map one column to Email to continue.
              </p>
            )}
            <p className="mt-3 text-[12px] text-muted-foreground">
              Columns set to “Personalization field” stay importable and appear as dynamically generated placeholders for this list (for example <code className="rounded bg-muted px-1">{'{{industry}}'}</code>).
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <p className="text-[12px] text-muted-foreground flex items-center gap-1.5">
              <Copy className="w-3.5 h-3.5" /> Duplicate addresses already in your CRM are skipped automatically.
            </p>
            <button
              type="button"
              onClick={() => void importLeads()}
              disabled={importing || !Object.values(mapping).includes('email') || listName.trim().length < 2}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing && <Loader2 className="w-4 h-4 animate-spin" />}
              {importing ? 'Importing…' : 'Import leads'}
            </button>
          </div>
        </>
      )}

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
