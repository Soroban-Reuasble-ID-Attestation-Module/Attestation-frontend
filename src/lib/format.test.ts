import { describe, expect, it } from 'vitest';
import {
  shortenAddress,
  formatAmount,
  formatDate,
  isValidPublicKey,
  isValidContractId,
} from '@/lib/format';

describe('shortenAddress', () => {
  it('shortens long addresses with an ellipsis', () => {
    const address = 'GBD3L2FRMS3XZNOYV3ATX7KRW2HPGNXPK4KSDMU4GTXKUIH4F22XR3AA';
    expect(shortenAddress(address)).toBe('GBD3L2…2XR3AA');
  });

  it('leaves short strings untouched', () => {
    expect(shortenAddress('abc')).toBe('abc');
  });
});

describe('formatAmount', () => {
  it('formats base units with 7 decimals by default', () => {
    expect(formatAmount(123_456_789n)).toBe('12.3456789');
  });

  it('pads sub-unit amounts', () => {
    expect(formatAmount(5n)).toBe('0.0000005');
  });

  it('handles negative amounts', () => {
    expect(formatAmount(-123456789n)).toBe('-12.3456789');
  });

  it('respects a custom decimals count', () => {
    expect(formatAmount(1_000_000n, 6)).toBe('1');
  });
});

describe('formatDate', () => {
  it('formats unix seconds as a readable date', () => {
    const out = formatDate(1_700_000_000);
    expect(out).not.toBe('—');
    expect(out).toContain('2023');
  });

  it('returns an em dash for invalid input', () => {
    expect(formatDate(0)).toBe('—');
  });
});

describe('address validation', () => {
  it('accepts valid Stellar public keys', () => {
    expect(isValidPublicKey(`G${'A'.repeat(55)}`)).toBe(true);
  });

  it('rejects malformed keys', () => {
    expect(isValidPublicKey('not-an-address')).toBe(false);
    expect(isValidPublicKey('A123456789012345678901234567890123456789012345678901234567890')).toBe(
      false,
    );
  });

  it('accepts Soroban contract ids', () => {
    expect(
      isValidContractId('CB2MGYTG6MIIDYWVB5BV4FLEF7KRDEF556JMVZXSZ22XALB7MUC7LU2S'),
    ).toBe(true);
  });
});