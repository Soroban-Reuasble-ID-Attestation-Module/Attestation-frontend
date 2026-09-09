/** Shorten a Stellar address for display: GABC…WXYZ. */
export function shortenAddress(address: string, head = 6, tail = 6): string {
  if (!address) return '';
  if (address.length <= head + tail + 1) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

/** Format a unix timestamp as a local date-time string. */
export function formatDate(unixSeconds: number | bigint): string {
  const secs = Number(unixSeconds);
  if (!Number.isFinite(secs) || secs <= 0) return '—';
  return new Date(secs * 1000).toLocaleString();
}

/**
 * Format a base-unit amount (7-decimal asset by default) for display.
 * Accepts bigint, number, or decimal string.
 */
export function formatAmount(
  amount: bigint | number | string,
  decimals = 7,
): string {
  const negative = String(amount).startsWith('-');
  const abs = String(amount).replace(/^-/, '');
  if (abs.length <= decimals) {
    return `${negative ? '-' : ''}0.${abs.padStart(decimals, '0')}`;
  }
  const whole = abs.slice(0, abs.length - decimals);
  const frac = abs.slice(-decimals).replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${frac ? `.${frac}` : ''}`;
}

/** Turn an unknown error into a readable message. */
export function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/** Validate a Stellar public key (G... or M...). */
export function isValidPublicKey(address: string): boolean {
  return /^[GMC][0-9A-Z]{55}$/.test(address);
}

/** Validate a Soroban contract id (C...). */
export function isValidContractId(contractId: string): boolean {
  return /^C[0-9A-Z]{55}$/.test(contractId);
}