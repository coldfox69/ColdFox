import { describe, it, expect } from 'vitest';
import {
  extractVariables,
  renderText,
  renderHtml,
  escapeHtml,
  validateVariables,
} from '@/lib/email/template';

describe('template rendering', () => {
  it('extracts variables from templates', () => {
    const vars = extractVariables('Hi {{first_name}}, welcome to {{company}}!');
    expect(vars).toEqual(['company', 'first_name']);
  });

  it('renders text with variables', () => {
    const result = renderText('Hi {{first_name}}', { first_name: 'Sarah' });
    expect(result).toBe('Hi Sarah');
  });

  it('leaves unknown variables unchanged', () => {
    const result = renderText('Hi {{missing}}', {});
    expect(result).toBe('Hi {{missing}}');
  });

  it('escapes HTML in variable values', () => {
    const result = renderHtml('Hi {{name}}', { name: '<b>hi</b>' });
    expect(result).toBe('Hi &lt;b&gt;hi&lt;/b&gt;');
  });

  it('escapeHtml function works directly', () => {
    expect(escapeHtml('<b>hi</b>')).toBe('&lt;b&gt;hi&lt;/b&gt;');
  });

  it('validates used required variables', () => {
    const issues = validateVariables(
      ['Hi {{first_name}}'],
      { first_name: 'Sarah' },
      ['first_name'],
    );
    const firstNameIssue = issues.find((i) => i.variable === 'first_name');
    expect(firstNameIssue?.missing).toBe(false);
  });

  it('flags missing required variables', () => {
    const issues = validateVariables(
      ['Hi {{first_name}}'],
      {},
      ['first_name'],
    );
    const firstNameIssue = issues.find((i) => i.variable === 'first_name');
    expect(firstNameIssue?.missing).toBe(true);
  });
});
