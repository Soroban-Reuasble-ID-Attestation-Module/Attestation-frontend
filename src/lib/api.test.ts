import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  apiBaseUrl,
  getAttestationViaApi,
  isApiEnabled,
  verifyViaApi,
} from '@/lib/api';

const API = 'https://api.example';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', API);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('api configuration', () => {
  it('reports the API as enabled and normalizes the base URL', () => {
    expect(isApiEnabled()).toBe(true);
    expect(apiBaseUrl()).toBe(API);
  });

  it('strips trailing slashes from the base URL', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example///');
    expect(apiBaseUrl()).toBe(API);
  });

  it('is disabled when no base URL is configured', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    expect(isApiEnabled()).toBe(false);
    expect(apiBaseUrl()).toBe('');
  });
});

describe('verifyViaApi', () => {
  it('returns the valid flag from the API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ valid: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(verifyViaApi('GSUBJECT', 'kyc_verified')).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API}/v1/accounts/GSUBJECT/attestations/kyc_verified/verify`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('treats a false result as a definitive answer, not an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ valid: false })));
    await expect(verifyViaApi('GSUBJECT', 'kyc_verified')).resolves.toBe(false);
  });

  it('throws on a server error so the caller can fall back to the contract', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 500)));
    await expect(verifyViaApi('GSUBJECT', 'kyc_verified')).rejects.toBeInstanceOf(ApiError);
  });

  it('surfaces a transport failure as an ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));
    await expect(verifyViaApi('GSUBJECT', 'kyc_verified')).rejects.toBeInstanceOf(ApiError);
  });

  it('reports an aborted (timed out) request distinctly', async () => {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort));

    await expect(verifyViaApi('GSUBJECT', 'kyc_verified')).rejects.toThrow(/timed out/);
  });
});

describe('getAttestationViaApi', () => {
  const expected = {
    id: 4,
    subject: 'GSUBJECT',
    claim_type: 'kyc_verified',
    claim_hash: 'ab'.repeat(32),
    issuer: 'GISSUER',
    issued_at: 1_700_000_000,
    expiry: 1_900_000_000,
    revoked: false,
  };

  // Verbatim shape served when the record is read live from the contract
  // (`source: "contract"`): the SDK's Attestation type is camelCase.
  const contractRow = {
    id: 4,
    subject: 'GSUBJECT',
    claimType: 'kyc_verified',
    claimHash: 'ab'.repeat(32),
    issuer: 'GISSUER',
    issuedAt: 1_700_000_000,
    expiry: 1_900_000_000,
    revoked: false,
    source: 'contract',
  };

  // Verbatim shape of the Postgres-index fallback (`source: "index"`), which
  // the service serializes with toRowJson and therefore stays snake_case.
  const indexRow = {
    id: 4,
    subject: 'GSUBJECT',
    claim_type: 'kyc_verified',
    claim_hash: 'ab'.repeat(32),
    issuer: 'GISSUER',
    issued_at: 1_700_000_000,
    expiry: 1_900_000_000,
    revoked: false,
    source: 'index',
  };

  it('maps a contract-served (camelCase) row onto the record shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(contractRow)));
    await expect(getAttestationViaApi(4)).resolves.toEqual(expected);
  });

  it('maps an index-served (snake_case) row onto the record shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(indexRow)));
    await expect(getAttestationViaApi(4)).resolves.toEqual(expected);
  });

  it('never renders a missing field as "undefined" or NaN', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ ...contractRow, claimType: undefined, issuedAt: undefined }),
      ),
    );

    const record = await getAttestationViaApi(4);
    expect(record?.claim_type).toBe('');
    expect(Number.isNaN(record?.issued_at)).toBe(false);
  });

  it('returns null for a 404 instead of throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 404)));
    await expect(getAttestationViaApi(99)).resolves.toBeNull();
  });

  it('throws for a non-404 failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 503)));
    await expect(getAttestationViaApi(4)).rejects.toBeInstanceOf(ApiError);
  });
});
