import { deployment } from '@/config';
import {
  simulateContractCall,
  submitContractCall,
  type ScValArg,
  type TxResult,
} from '@/lib/contract';
import {
  getAttestationViaApi,
  isApiEnabled,
  verifyViaApi,
} from '@/lib/api';

/**
 * Attestation contract facade — typed wrappers over the Soroban ABI.
 *
 * Mirrors the backend SDK's interface so the frontend can be swapped onto
 * the SDK service without UI changes.
 *
 * Read-only calls (`verify`, `get_attestation`) are served by the backend
 * REST API when `VITE_API_BASE_URL` is configured, and fall back to reading
 * the contract directly whenever the backend is unset or unhealthy. The
 * contract is the source of truth either way. Mutations always go straight
 * to the contract so the user's own wallet signs them.
 */

export interface AttestationRecord {
  id: number;
  subject: string;
  claim_type: string;
  claim_hash: string;
  issuer: string;
  issued_at: number;
  expiry: number;
  revoked: boolean;
}

export interface IssuanceOptions {
  issuer: string;
  subject: string;
  claimType: string;
  claimHash: string; // 64 hex chars
  expiry: number; // unix seconds
  signTransaction: (txXdr: string) => Promise<string>;
  contractId?: string;
}

export interface RevokeOptions {
  caller: string;
  attestationId: number;
  signTransaction: (txXdr: string) => Promise<string>;
  contractId?: string;
}

export interface VerifyOptions {
  subject: string;
  claimType: string;
  source: string;
  contractId?: string;
}

export interface SelectiveDisclosureOptions {
  subject: string;
  claimType: string;
  claimValue: string;
  salt: string;
  source: string;
  contractId?: string;
}

export interface IssuerOptions {
  caller: string;
  issuer: string;
  signTransaction: (txXdr: string) => Promise<string>;
  contractId?: string;
}

function args(...values: ScValArg[]): ScValArg[] {
  return values;
}

/**
 * True when the backend API is an acceptable source for `contractId`.
 *
 * The service is configured with a single `ATTESTATION_CONTRACT_ID`, so it
 * is only trustworthy when the caller is reading that same deployment — a
 * call against any other contract id must go to the chain directly.
 */
function canUseApi(contractId: string): boolean {
  return isApiEnabled() && contractId === deployment.attestationContract;
}

/** Issue a new attestation; returns the attestation id. */
export async function issueAttestation(
  options: IssuanceOptions,
): Promise<TxResult> {
  return submitContractCall({
    contractId: options.contractId ?? deployment.attestationContract,
    method: 'issue_attestation',
    args: args(
      { value: options.issuer, type: 'address' },
      { value: options.subject, type: 'address' },
      { value: options.claimType, type: 'symbol' },
      { value: options.claimHash, type: 'bytes' },
      { value: options.expiry.toString(), type: 'u64' },
    ),
    source: options.issuer,
    signTransaction: options.signTransaction,
  });
}

/** Revoke an attestation by id (issuing issuer or admin only). */
export async function revokeAttestation(
  options: RevokeOptions,
): Promise<TxResult> {
  return submitContractCall({
    contractId: options.contractId ?? deployment.attestationContract,
    method: 'revoke',
    args: args(
      { value: options.caller, type: 'address' },
      { value: options.attestationId, type: 'u32' },
    ),
    source: options.caller,
    signTransaction: options.signTransaction,
  });
}

/**
 * Read-only verification: true when the subject holds an active, unrevoked
 * attestation for the claim type. Never requires a signature.
 */
export async function verifyAttestation(
  options: VerifyOptions,
): Promise<boolean> {
  const contractId = options.contractId ?? deployment.attestationContract;

  if (canUseApi(contractId)) {
    try {
      return await verifyViaApi(options.subject, options.claimType);
    } catch {
      // Backend unavailable — verify against the contract instead.
    }
  }

  const result = await simulateContractCall({
    contractId,
    method: 'verify',
    args: args(
      { value: options.subject, type: 'address' },
      { value: options.claimType, type: 'symbol' },
    ),
    source: options.source,
  });
  return Boolean(result);
}

/** Fetch the full attestation record by id. */
export async function getAttestation(
  attestationId: number,
  source: string,
  contractId = deployment.attestationContract,
): Promise<AttestationRecord | null> {
  if (canUseApi(contractId)) {
    try {
      // A 404 from the API is definitive (absent from chain *and* index) and
      // resolves to null; only real failures reach the fallback below.
      return await getAttestationViaApi(attestationId);
    } catch {
      // Backend unavailable — read the contract instead.
    }
  }

  try {
    const result = await simulateContractCall({
      contractId,
      method: 'get_attestation',
      args: args({ value: attestationId, type: 'u32' }),
      source,
    });
    return result as AttestationRecord;
  } catch {
    return null; // NotFound — no attestation with this id.
  }
}

/**
 * Selective disclosure: prove that `claimValue` with `salt` matches the
 * stored commitment, without revealing anything else.
 */
export async function verifyClaimCommitment(
  options: SelectiveDisclosureOptions,
): Promise<boolean> {
  const result = await simulateContractCall({
    contractId: options.contractId ?? deployment.attestationContract,
    method: 'verify_claim_commitment',
    args: args(
      { value: options.subject, type: 'address' },
      { value: options.claimType, type: 'symbol' },
      { value: options.claimValue, type: 'bytes' },
      { value: options.salt, type: 'bytes' },
    ),
    source: options.source,
  });
  return Boolean(result);
}

/**
 * Read-only issuer check.
 *
 * Always reads the contract: the backend API exposes no issuer-registry
 * route (only `POST`/`DELETE /v1/issuers`, which are admin mutations).
 */
export async function isIssuer(
  address: string,
  source: string,
  contractId = deployment.attestationContract,
): Promise<boolean> {
  const result = await simulateContractCall({
    contractId,
    method: 'is_issuer',
    args: args({ value: address, type: 'address' }),
    source,
  });
  return Boolean(result);
}

/** Register an issuer (admin only). */
export async function addIssuer(options: IssuerOptions): Promise<TxResult> {
  return submitContractCall({
    contractId: options.contractId ?? deployment.attestationContract,
    method: 'add_issuer',
    args: args({ value: options.issuer, type: 'address' }),
    source: options.caller,
    signTransaction: options.signTransaction,
  });
}

/** Remove an issuer (admin only). */
export async function removeIssuer(options: IssuerOptions): Promise<TxResult> {
  return submitContractCall({
    contractId: options.contractId ?? deployment.attestationContract,
    method: 'remove_issuer',
    args: args({ value: options.issuer, type: 'address' }),
    source: options.caller,
    signTransaction: options.signTransaction,
  });
}