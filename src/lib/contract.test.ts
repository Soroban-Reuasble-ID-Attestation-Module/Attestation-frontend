import { describe, expect, it } from 'vitest';
import { xdr, scValToNative } from '@stellar/stellar-sdk';
import { toScVal, hexToBytes } from '@/lib/contract';

describe('hexToBytes', () => {
  it('decodes hex into bytes', () => {
    expect(Array.from(hexToBytes('deadbeef'))).toEqual([0xde, 0xad, 0xbe, 0xef]);
  });

  it('pads odd-length hex', () => {
    expect(Array.from(hexToBytes('abc'))).toEqual([0x0a, 0xbc]);
  });
});

const VALID_ADDRESS = 'GAWNWSHQDTYETV6RS5AAQED5V27HAQL7MQPZMHKY65JAPFWW35WE7RV2';

function variantName(scVal: xdr.ScVal): string {
  return scVal.constructor.name;
}

describe('toScVal', () => {
  it('converts addresses to scvAddress', () => {
    const scVal = toScVal({ value: VALID_ADDRESS, type: 'address' });
    expect(variantName(scVal)).toBe('ScValAddress');
    expect(scValToNative(scVal)).toBe(VALID_ADDRESS);
  });

  it('converts symbols to scvSymbol', () => {
    const scVal = toScVal({ value: 'kyc_verified', type: 'symbol' });
    expect(variantName(scVal)).toBe('ScValSymbol');
    expect(scValToNative(scVal)).toBe('kyc_verified');
  });

  it('converts hex bytes to scvBytes', () => {
    const scVal = toScVal({ value: 'deadbeef', type: 'bytes' });
    expect(variantName(scVal)).toBe('ScValBytes');
    expect(Buffer.from(scValToNative(scVal) as Uint8Array).toString('hex')).toBe('deadbeef');
  });

  it('converts u64 numbers to scvU64', () => {
    const scVal = toScVal({ value: '1900000000', type: 'u64' });
    expect(variantName(scVal)).toBe('ScValU64');
    expect(String(scValToNative(scVal))).toBe('1900000000');
  });

  it('converts i128 amounts to scvI128', () => {
    const scVal = toScVal({ value: '1234567890123', type: 'i128' });
    expect(variantName(scVal)).toBe('ScValI128');
    expect(String(scValToNative(scVal))).toBe('1234567890123');
  });

  it('converts u32 ids to scvU32', () => {
    const scVal = toScVal({ value: 7, type: 'u32' });
    expect(variantName(scVal)).toBe('ScValU32');
    expect(scValToNative(scVal)).toBe(7);
  });
});