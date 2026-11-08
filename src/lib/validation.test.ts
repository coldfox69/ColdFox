import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { emailSchema, passwordSchema, campaignInputSchema, aiEmailRequestSchema } from '@/lib/validation';

describe('validation schemas', () => {
  it('emailSchema accepts valid emails', async () => {
    await expect(emailSchema.parseAsync('test@example.com')).resolves.toBe('test@example.com');
    await expect(emailSchema.parseAsync('USER@Example.COM')).resolves.toBe('user@example.com');
  });

  it('emailSchema rejects invalid emails', async () => {
    await expect(emailSchema.parseAsync('not-an-email')).rejects.toThrow();
    await expect(emailSchema.parseAsync('')).rejects.toThrow();
  });

  it('passwordSchema requires complexity', async () => {
    await expect(passwordSchema.parseAsync('Abc12345')).resolves.toBe('Abc12345');
    await expect(passwordSchema.parseAsync('abc12345')).rejects.toThrow();
    await expect(passwordSchema.parseAsync('ABC12345')).rejects.toThrow();
    await expect(passwordSchema.parseAsync('Abcdefgh')).rejects.toThrow();
  });

  it('campaignInputSchema validates fields', async () => {
    const input = await campaignInputSchema.parseAsync({
      name: 'Test Campaign',
      daily_limit: 100,
      lead_ids: [],
    });
    expect(input.name).toBe('Test Campaign');
    expect(input.daily_limit).toBe(100);
    expect(input.timezone).toBe('UTC');
  });

  it('aiEmailRequestSchema supports all modes', async () => {
    for (const mode of ['generate', 'rewrite', 'optimize', 'subjects', 'follow_up'] as const) {
      const input = await aiEmailRequestSchema.parseAsync({ mode, prompt: 'Test prompt' });
      expect(input.mode).toBe(mode);
    }
  });
});
