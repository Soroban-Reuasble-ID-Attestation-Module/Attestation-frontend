/**
 * Commitment scheme for the Attestation Protocol.
 *
 * `claim_hash = sha256(claim_value ‖ salt)`
 *
 * The contract recomputes the same digest on-chain in
 * `verify_claim_commitment`; the raw claim value and salt never touch the
 * ledger. This module must byte-for-byte reproduce the contract's
 * concatenation (`Bytes(claim_value) ++ Bytes(salt)`), which for UTF-8
 * strings is equivalent to hashing the concatenated encoded bytes.
 */

/** Compute the SHA-256 commitment hex digest of `value ‖ salt`. */
export async function computeCommitment(value: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const preimage = new Uint8Array([
    ...encoder.encode(value),
    ...encoder.encode(salt),
  ]);
  const digest = await crypto.subtle.digest('SHA-256', preimage);
  return bytesToHex(new Uint8Array(digest));
}

/** Generate a fresh, high-entropy salt (16 random bytes, hex-encoded). */
export function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}