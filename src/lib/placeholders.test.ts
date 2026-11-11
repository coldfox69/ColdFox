import { describe, expect, it } from 'vitest';
import {
  buildLeadListColumns,
  extractRawVariables,
  findUnresolvedPlaceholders,
  leadListPlaceholders,
  normalizeColumnKey,
  renderPlaceholders,
  validateVariablesAgainstList,
} from '@/lib/placeholders';

describe('normalizeColumnKey', () => {
  it('normalises headers into snake_case keys', () => {
    expect(normalizeColumnKey('First Name')).toBe('first_name');
    expect(normalizeColumnKey('  Company-Name ')).toBe('company_name');
    expect(normalizeColumnKey('Job Title!')).toBe('job_title');
    expect(normalizeColumnKey('Émail_Address')).toBe('email_address');
  });

  it('falls back when the header has no usable characters', () => {
    expect(normalizeColumnKey('!!!')).toBe('column');
    expect(normalizeColumnKey('')).toBe('column');
  });
});

describe('buildLeadListColumns', () => {
  it('generates one placeholder per column and deduplicates collisions', () => {
    const columns = buildLeadListColumns([
      { header: 'First Name', samples: ['Ada'] },
      { header: 'Company Name', samples: ['Acme'] },
      { header: 'company_name', samples: ['Duplicate'] },
      { header: 'job_title', samples: ['CEO'] },
    ]);
    expect(columns.map((c) => c.key)).toEqual(['first_name', 'company_name', 'company_name_2', 'job_title']);
    expect(leadListPlaceholders(columns)).toEqual([
      '{{first_name}}',
      '{{company_name}}',
      '{{company_name_2}}',
      '{{job_title}}',
    ]);
  });

  it('marks mapped CRM fields and keeps examples', () => {
    const [first] = buildLeadListColumns([{ header: 'e-mail', samples: ['a@b.co'], mappedField: 'email' }]);
    expect(first.mapped).toBe(true);
    expect(first.example).toBe('a@b.co');
  });
});

describe('renderPlaceholders', () => {
  const values = { first_name: 'Ada', company_name: 'Acme', email: 'ada@acme.test' };

  it('replaces known placeholders and leaves nothing unresolved', () => {
    const { text, missing } = renderPlaceholders('Hi {{first_name}} at {{company}}', values);
    expect(text).toBe('Hi Ada at Acme');
    expect(missing).toEqual([]);
    expect(findUnresolvedPlaceholders(text)).toEqual([]);
  });

  it('reports missing values instead of rendering undefined', () => {
    const { text, missing } = renderPlaceholders('Hi {{last_name}}', values);
    expect(text).toBe('Hi {{last_name}}');
    expect(missing).toEqual(['last_name']);
  });

  it('supports per-key fallbacks', () => {
    const { text, missing } = renderPlaceholders('Hi {{last_name}}', values, { last_name: 'there' });
    expect(text).toBe('Hi there');
    expect(missing).toEqual([]);
  });
});

describe('findUnresolvedPlaceholders', () => {
  it('finds leftover placeholders after rendering', () => {
    expect(findUnresolvedPlaceholders('Hi Ada', '{{company_name}}')).toEqual(['company_name']);
  });
});

describe('validateVariablesAgainstList', () => {
  const columns = buildLeadListColumns([
    { header: 'first_name', samples: ['Ada'], mappedField: 'first_name' },
    { header: 'company', samples: ['Acme'], mappedField: 'company' },
    { header: 'Industry', samples: ['Software'] },
  ]);

  it('accepts direct and mapped keys', () => {
    const checks = validateVariablesAgainstList(['first_name', 'company_name', 'industry'], columns);
    expect(checks.every((c) => c.supported)).toBe(true);
  });

  it('flags unsupported placeholders', () => {
    const checks = validateVariablesAgainstList(['salary'], columns);
    expect(checks[0]).toEqual({ key: 'salary', supported: false });
  });

  it('always supports sender variables', () => {
    const checks = validateVariablesAgainstList(['sender_name', 'sender_company'], columns);
    expect(checks.every((c) => c.supported)).toBe(true);
  });
});

describe('extractRawVariables', () => {
  it('collects unique placeholders in sorted order', () => {
    expect(extractRawVariables('{{b}} {{a}} {{a}}', '{{c}}')).toEqual(['a', 'b', 'c']);
  });
});
