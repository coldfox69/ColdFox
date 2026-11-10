import 'server-only';
import { parse } from 'csv-parse/sync';
import { ApiError } from '@/lib/http';

export interface ParsedSpreadsheet {
  headers: string[];
  rows: (string | number | null)[][];
  filename: string;
  sheetName?: string;
}

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 10_000;
const MAX_COLUMNS = 60;

function cleanCell(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('text' in (value as Record<string, unknown>)) return cleanCell((value as Record<string, unknown>).text);
    if ('result' in (value as Record<string, unknown>)) return cleanCell((value as Record<string, unknown>).result);
    return null;
  }
  const text = String(value).trim();
  return text === '' ? null : text.slice(0, 2000);
}

export async function parseSpreadsheet(file: File): Promise<ParsedSpreadsheet> {
  if (file.size === 0) throw new ApiError(422, 'The uploaded file is empty.');
  if (file.size > MAX_BYTES) throw new ApiError(413, 'Files must be 5 MB or smaller.');
  const name = file.name || 'upload';
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = name.split('.').pop()?.toLowerCase();

  if (ext === 'csv' || ext === 'tsv' || file.type.includes('csv') || file.type.includes('tab-separated')) {
    let records: string[][];
    try {
      records = parse(buffer, {
        bom: true,
        skip_empty_lines: true,
        relax_column_count: true,
        delimiter: ext === 'tsv' ? '\t' : ',',
      }) as string[][];
    } catch {
      throw new ApiError(422, 'That CSV could not be parsed. Check the file and try again.');
    }
    return finalize(records, name);
  }

  if (ext === 'xlsx' || ext === 'xlsm' || file.type.includes('spreadsheet')) {
    // Loaded on demand: the spreadsheet reader is a large dependency and most
    // imports are plain CSV files.
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    } catch {
      throw new ApiError(422, 'That spreadsheet could not be read. Save it as .xlsx or CSV and retry.');
    }
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new ApiError(422, 'The workbook has no worksheets.');
    const records: (string | number | null)[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const values: (string | number | null)[] = [];
      for (let i = 1; i <= Math.min(sheet.columnCount, MAX_COLUMNS); i += 1) {
        values.push(cleanCell(row.getCell(i).value));
      }
      records.push(values);
    });
    return finalize(records, name, sheet.name);
  }

  throw new ApiError(415, 'Upload a .csv, .tsv or .xlsx file.');
}

function finalize(records: (string | number | null)[][], filename: string, sheetName?: string): ParsedSpreadsheet {
  const nonEmpty = records.filter((row) => row.some((cell) => cell !== null && String(cell).trim() !== ''));
  if (nonEmpty.length < 2) throw new ApiError(422, 'The file needs a header row and at least one lead row.');
  const rawHeaders = nonEmpty[0].map((h, i) => (h === null || String(h).trim() === '' ? `Column ${i + 1}` : String(h).trim().slice(0, 200)));
  const headers = rawHeaders.slice(0, MAX_COLUMNS);
  const seen = new Map<string, number>();
  const uniqueHeaders = headers.map((h) => {
    const count = seen.get(h) ?? 0;
    seen.set(h, count + 1);
    return count === 0 ? h : `${h} (${count + 1})`;
  });
  const rows = nonEmpty
    .slice(1, MAX_ROWS + 1)
    .map((row) => {
      const out: (string | number | null)[] = [];
      for (let i = 0; i < uniqueHeaders.length; i += 1) out.push(row[i] ?? null);
      return out;
    });
  if (rows.length === 0) throw new ApiError(422, 'No data rows were found.');
  return { headers: uniqueHeaders, rows, filename, sheetName };
}

export function sampleRows(rows: (string | number | null)[][], count = 8) {
  return rows.slice(0, count);
}
