import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { computeCommitment, generateSalt } from '@/lib/commitment';

describe('computeCommitment', () => {
  it('produces sha256(value ‖ salt) matching node crypto', async () => {
    const value = 'passport:AB123';
    const salt = 's3cret';
    const expected = createHash('sha256')
      .update(value + salt)
      .digest('hex');
    expect(await computeCommitment(value, salt)).toBe(expected);
  });

  it('matches the contract concatenation for multibyte UTF-8 values', async () => {
    const value = 'café-ünïcode';
    const salt = 'random-salt-123456';
    const expected = createHash('sha256')
      .update(Buffer.from(value, 'utf8'))
      .update(Buffer.from(salt, 'utf8'))
      .digest('hex');
    expect(await computeCommitment(value, salt)).toBe(expected);
  });

  it('is deterministic for the same inputs', async () => {
    const a = await computeCommitment('x', 'y');
    const b = await computeCommitment('x', 'y');
    expect(a).toBe(b);
  });

  it('differs when the salt changes', async () => {
    const a = await computeCommitment('x', 'salt-a');
    const b = await computeCommitment('x', 'salt-b');
    expect(a).not.toBe(b);
  });
});

describe('generateSalt', () => {
  it('returns 32 hex characters (16 random bytes)', () => {
    expect(generateSalt()).toMatch(/^[0-9a-f]{32}$/);
  });

  it('is unique across calls', () => {
    const salts = new Set(Array.from({ length: 50 }, () => generateSalt()));
    expect(salts.size).toBe(50);
  });
});