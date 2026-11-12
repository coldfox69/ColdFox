import { describe, expect, it } from 'vitest';
import {
  agentSlug,
  coerceAgentInputs,
  emptyInputs,
  extractLeadRows,
  readPath,
  validateAgentInputs,
} from '@/lib/agents/inputs';
import type { AgentFieldDefinition } from '@/lib/agents/types';

const FIELDS: AgentFieldDefinition[] = [
  { key: 'country', label: 'Target country', type: 'text', required: true },
  { key: 'niche', label: 'Store niche', type: 'text' },
  { key: 'lead_limit', label: 'Maximum leads', type: 'number', min: 1, max: 100 },
  { key: 'contact', label: 'Contact email', type: 'email' },
  { key: 'platform', label: 'Platform', type: 'select', options: [{ value: 'shopify', label: 'Shopify' }] },
  { key: 'keywords', label: 'Keywords', type: 'multiselect' },
  { key: 'verified', label: 'Verified only', type: 'boolean' },
];

describe('validateAgentInputs', () => {
  it('reports a missing required field', () => {
    const errors = validateAgentInputs(FIELDS, { niche: 'apparel' });
    expect(errors).toContain('Target country is required.');
  });

  it('accepts a complete answer', () => {
    const errors = validateAgentInputs(FIELDS, {
      country: 'United States',
      lead_limit: 50,
      contact: 'buyer@example.com',
      platform: 'shopify',
    });
    expect(errors).toEqual([]);
  });

  it('rejects an invalid email', () => {
    const errors = validateAgentInputs(FIELDS, { country: 'US', contact: 'not-an-email' });
    expect(errors).toContain('Contact email must be an email address.');
  });

  it('rejects a number outside the range', () => {
    expect(validateAgentInputs(FIELDS, { country: 'US', lead_limit: 500 })).toContain(
      'Maximum leads cannot be higher than 100.',
    );
    expect(validateAgentInputs(FIELDS, { country: 'US', lead_limit: 0 })).toContain(
      'Maximum leads cannot be lower than 1.',
    );
  });

  it('rejects a value outside the listed options', () => {
    const errors = validateAgentInputs(FIELDS, { country: 'US', platform: 'woocommerce' });
    expect(errors).toContain('Platform must be one of the listed options.');
  });
});

describe('coerceAgentInputs', () => {
  it('keeps numbers as numbers and trims strings', () => {
    const values = coerceAgentInputs(FIELDS, { country: '  Germany  ', lead_limit: '25' });
    expect(values.country).toBe('Germany');
    expect(values.lead_limit).toBe(25);
  });

  it('turns checkbox values into booleans', () => {
    expect(coerceAgentInputs(FIELDS, { verified: 'true' }).verified).toBe(true);
    expect(coerceAgentInputs(FIELDS, { verified: '1' }).verified).toBe(true);
    expect(coerceAgentInputs(FIELDS, { verified: '' }).verified).toBe(false);
  });

  it('normalises a multiple choice answer', () => {
    const values = coerceAgentInputs(FIELDS, { keywords: ['shopify store', ' shopify apps '] });
    expect(values.keywords).toEqual(['shopify store', 'shopify apps']);
  });

  it('drops values that are not part of the schema', () => {
    const values = coerceAgentInputs(FIELDS, { country: 'US', somethingElse: 'x' });
    expect(values).not.toHaveProperty('somethingElse');
  });
});

describe('emptyInputs', () => {
  it('seeds the defaults of the schema', () => {
    const values = emptyInputs(FIELDS);
    expect(values.country).toBe('');
    expect(values.verified).toBe(false);
    expect(values.keywords).toEqual([]);
  });
});

describe('readPath', () => {
  it('reads a dotted path', () => {
    expect(readPath({ data: { leads: [1, 2] } }, 'data.leads')).toEqual([1, 2]);
  });

  it('returns the payload when no path is given', () => {
    expect(readPath({ a: 1 })).toEqual({ a: 1 });
  });

  it('returns undefined for a missing path', () => {
    expect(readPath({ data: {} }, 'data.leads')).toBeUndefined();
  });
});

describe('extractLeadRows', () => {
  it('reads leads from a named path', () => {
    const rows = extractLeadRows({ data: { leads: [{ email: 'a@example.com', first_name: 'Ada' }] } }, 'data.leads');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ email: 'a@example.com', first_name: 'Ada' });
  });

  it('looks in the usual list keys', () => {
    const rows = extractLeadRows({ results: [{ email_address: 'b@example.com' }] });
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe('b@example.com');
  });

  it('accepts a plain array answer', () => {
    expect(extractLeadRows([{ email: 'c@example.com' }])).toHaveLength(1);
  });

  it('drops rows without a usable email', () => {
    const rows = extractLeadRows([{ email: 'nope' }, { email: 'd@example.com' }, { name: 'no email here' }]);
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe('d@example.com');
  });

  it('removes duplicates', () => {
    const rows = extractLeadRows([{ email: 'e@example.com' }, { email: 'E@example.com' }]);
    expect(rows).toHaveLength(1);
  });

  it('keeps unknown columns as extra values', () => {
    const rows = extractLeadRows([{ email: 'f@example.com', store_rating: 4.8 }]);
    expect(rows[0].extra).toMatchObject({ store_rating: '4.8' });
  });

  it('returns nothing for an answer without leads', () => {
    expect(extractLeadRows({ status: 'ok' })).toEqual([]);
    expect(extractLeadRows(null)).toEqual([]);
  });

  it('maps the common field names', () => {
    const rows = extractLeadRows([
      {
        email: 'g@example.com',
        firstName: 'Grace',
        lastName: 'Hopper',
        companyName: 'Navy',
        jobTitle: 'Engineer',
        website: 'https://example.com',
        industry: 'retail',
        city: 'Dhaka',
        country: 'BD',
      },
    ]);
    expect(rows[0]).toMatchObject({
      first_name: 'Grace',
      last_name: 'Hopper',
      company_name: 'Navy',
      job_title: 'Engineer',
      website: 'https://example.com',
      industry: 'retail',
      city: 'Dhaka',
      country: 'BD',
    });
  });
});

describe('agentSlug', () => {
  it('builds a url friendly slug', () => {
    expect(agentSlug('Shopify Lead Generation')).toBe('shopify-lead-generation');
  });

  it('falls back when there is nothing usable', () => {
    expect(agentSlug('***')).toBe('agent');
  });
});
