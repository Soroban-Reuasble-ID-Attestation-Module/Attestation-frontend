/**
 * Backend REST API client (Attestation-backend-sdk `services/api`).
 *
 * The Soroban contract remains the source of truth for every verification.
 * This client is an *optional* accelerator in front of it: when
 * `VITE_API_BASE_URL` is configured, read-only queries can be served by the
 * backend service (which queries the same contract and keeps a convenience
 * Postgres index) instead of the browser talking to Soroban RPC directly.
 *
 * Scope rules:
 *
 * - **Reads only.** Only read-only routes are implemented here. Mutations
 *   (issue, revoke, add/remove issuer, escrow deposit/release/withdraw) stay
 *   in `lib/contract.ts` so the user's own wallet signs them — the frontend
 *   never asks the backend to act on a user's behalf.
 * - **Public routes only.** Read routes on the API are public by default
 *   (`PUBLIC_READS=true`). If an operator sets `PUBLIC_READS=false`, reads
 *   require a verifier JWT, which would mean shipping an API key inside the
 *   browser bundle. We deliberately do not support that; such a deployment
 *   simply falls back to reading the contract directly.
 * - **Graceful degradation.** Callers in `lib/attestation.ts` treat any
 *   error from this module as "backend unavailable" and read the contract
 *   instead, so the app is fully functional with no backend at all.
 *
 * The backend must be configured with the same `ATTESTATION_CONTRACT_ID` as
 * this deployment (`src/config/deployments/testnet.json`).
 */

import type { AttestationRecord } from '@/lib/attestation';
import { formatError } from '@/lib/format';

/** Read `VITE_API_BASE_URL` at call time so tests can stub it. */
function rawBaseUrl(): string {
  const value = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return typeof value === 'string' ? value.trim() : '';
}

/** The configured backend base URL without a trailing slash ('' when unset). */
export function apiBaseUrl(): string {
  return rawBaseUrl().replace(/\/+$/, '');
}

/** True when a backend base URL is configured. */
export function isApiEnabled(): boolean {
  return apiBaseUrl().length > 0;
}

/**
 * A request timeout. A backend that accepts a connection but never answers
 * must not hang the UI — the caller falls back to the contract instead.
 */
const REQUEST_TIMEOUT_MS = 5_000;

/** An error raised by the backend API layer. Never surfaced verbatim to users. */
export class ApiError extends Error {
  /** HTTP status when the server answered; undefined for transport failures. */
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function apiGet<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new ApiError(`API responded ${response.status} for ${path}`, response.status);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(`API request to ${path} timed out`);
    }
    throw new ApiError(`API request to ${path} failed: ${formatError(error)}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Shape of a record as returned by the API (`GET /v1/attestations/:id`). */
interface ApiAttestationRecord {
  id: number;
  subject: string;
  claim_type: string;
  claim_hash: string;
  issuer: string;
  issued_at: number;
  expiry: number;
  revoked: boolean;
  /** 'contract' when read live from Soroban, 'index' when served from Postgres. */
  source?: string;
}

function toRecord(row: ApiAttestationRecord): AttestationRecord {
  return {
    id: Number(row.id),
    subject: String(row.subject),
    claim_type: String(row.claim_type),
    claim_hash: String(row.claim_hash),
    issuer: String(row.issuer),
    issued_at: Number(row.issued_at),
    expiry: Number(row.expiry),
    revoked: Boolean(row.revoked),
  };
}

/**
 * `GET /v1/accounts/:address/exists` — whether the account exists on-chain.
 * (Not wired into the UI: Horizon stays the canonical source for account
 * state because balances come from the same call.)
 */
export async function accountExistsViaApi(address: string): Promise<boolean> {
  const result = await apiGet<{ exists?: boolean } | boolean>(
    `/v1/accounts/${encodeURIComponent(address)}/exists`,
  );
  return typeof result === 'boolean' ? result : Boolean(result?.exists);
}

/**
 * `GET /v1/accounts/:address/attestations/:claimType/verify` — authoritative
 * verification (the service calls `verify()` on the contract itself).
 *
 * A `false` result is a definitive answer, not a failure: only transport and
 * HTTP errors are thrown, so callers only fall back when the backend is
 * genuinely unusable.
 */
export async function verifyViaApi(
  subject: string,
  claimType: string,
): Promise<boolean> {
  const payload = await apiGet<{ valid?: boolean }>(
    `/v1/accounts/${encodeURIComponent(subject)}/attestations/${encodeURIComponent(claimType)}/verify`,
  );
  return Boolean(payload?.valid);
}

/**
 * `GET /v1/attestations/:id` — a single record, read live from the contract
 * with the Postgres index as a documented fallback.
 *
 * Returns `null` for a 404 (definitively unknown), and throws for any other
 * failure so the caller can fall back to the contract.
 */
export async function getAttestationViaApi(
  attestationId: number,
): Promise<AttestationRecord | null> {
  try {
    const row = await apiGet<ApiAttestationRecord>(`/v1/attestations/${attestationId}`);
    return toRecord(row);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
