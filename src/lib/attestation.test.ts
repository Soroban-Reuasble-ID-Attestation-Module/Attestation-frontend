import { afterEach, describe, expect, it, vi } from 'vitest';
import { deployment } from '@/config';
import {
  getAttestation,
  verifyAttestation,
  type AttestationRecord,
} from '@/lib/attestation';
import { getAttestationViaApi, isApiEnabled, verifyViaApi } from '@/lib/api';
import { simulateContractCall } from '@/lib/contract';

vi.mock('@/lib/api', () => ({
  isApiEnabled: vi.fn(),
  verifyViaApi: vi.fn(),
  getAttestationViaApi: vi.fn(),
}));

vi.mock('@/lib/contract', () => ({
  simulateContractCall: vi.fn(),
  submitContractCall: vi.fn(),
}));

const CONTRACT = deployment.attestationContract;
const SUBJECT = 'GAWNWSHQDTYETV6RS5AAQED5V27HAQL7MQPZMHKY65JAPFWW35WE7RV2';

const record: AttestationRecord = {
  id: 1,
  subject: SUBJECT,
  claim_type: 'kyc_verified',
  claim_hash: 'cd'.repeat(32),
  issuer: SUBJECT,
  issued_at: 1,
  expiry: 2,
  revoked: false,
};

afterEach(() => {
  vi.resetAllMocks();
});

describe('verifyAttestation', () => {
  it('uses the backend when it is configured and healthy', async () => {
    vi.mocked(isApiEnabled).mockReturnValue(true);
    vi.mocked(verifyViaApi).mockResolvedValue(true);

    await expect(
      verifyAttestation({ subject: SUBJECT, claimType: 'kyc_verified', source: SUBJECT }),
    ).resolves.toBe(true);
    expect(simulateContractCall).not.toHaveBeenCalled();
  });

  it('falls back to the contract when the backend fails', async () => {
    vi.mocked(isApiEnabled).mockReturnValue(true);
    vi.mocked(verifyViaApi).mockRejectedValue(new Error('backend down'));
    vi.mocked(simulateContractCall).mockResolvedValue(false);

    await expect(
      verifyAttestation({ subject: SUBJECT, claimType: 'kyc_verified', source: SUBJECT }),
    ).resolves.toBe(false);
    expect(simulateContractCall).toHaveBeenCalledTimes(1);
  });

  it('reads the contract directly when no backend is configured', async () => {
    vi.mocked(isApiEnabled).mockReturnValue(false);
    vi.mocked(simulateContractCall).mockResolvedValue(true);

    await expect(
      verifyAttestation({ subject: SUBJECT, claimType: 'kyc_verified', source: SUBJECT }),
    ).resolves.toBe(true);
    expect(verifyViaApi).not.toHaveBeenCalled();
  });

  it('ignores the backend for a contract other than the configured one', async () => {
    vi.mocked(isApiEnabled).mockReturnValue(true);
    vi.mocked(simulateContractCall).mockResolvedValue(true);

    const other = `C${'A'.repeat(55)}`;
    await verifyAttestation({
      subject: SUBJECT,
      claimType: 'kyc_verified',
      source: SUBJECT,
      contractId: other,
    });

    expect(verifyViaApi).not.toHaveBeenCalled();
    expect(simulateContractCall).toHaveBeenCalledWith(
      expect.objectContaining({ contractId: other }),
    );
  });
});

describe('getAttestation', () => {
  it('uses the backend record when available', async () => {
    vi.mocked(isApiEnabled).mockReturnValue(true);
    vi.mocked(getAttestationViaApi).mockResolvedValue(record);

    await expect(getAttestation(1, SUBJECT)).resolves.toEqual(record);
    expect(simulateContractCall).not.toHaveBeenCalled();
  });

  it('does not fall back when the backend definitively returns null', async () => {
    vi.mocked(isApiEnabled).mockReturnValue(true);
    vi.mocked(getAttestationViaApi).mockResolvedValue(null);

    await expect(getAttestation(1, SUBJECT)).resolves.toBeNull();
    expect(simulateContractCall).not.toHaveBeenCalled();
  });

  it('falls back to the contract when the backend errors', async () => {
    vi.mocked(isApiEnabled).mockReturnValue(true);
    vi.mocked(getAttestationViaApi).mockRejectedValue(new Error('backend down'));
    vi.mocked(simulateContractCall).mockResolvedValue(record);

    await expect(getAttestation(1, SUBJECT)).resolves.toEqual(record);
    expect(simulateContractCall).toHaveBeenCalledTimes(1);
  });

  it('returns null when the contract has no such attestation', async () => {
    vi.mocked(isApiEnabled).mockReturnValue(false);
    vi.mocked(simulateContractCall).mockRejectedValue(new Error('NotFound'));

    await expect(getAttestation(1, SUBJECT)).resolves.toBeNull();
  });

  it('only consults the backend for the configured contract', async () => {
    vi.mocked(isApiEnabled).mockReturnValue(true);
    vi.mocked(simulateContractCall).mockResolvedValue(record);

    await getAttestation(1, SUBJECT, CONTRACT);
    expect(getAttestationViaApi).toHaveBeenCalled();

    vi.mocked(getAttestationViaApi).mockClear();
    await getAttestation(1, SUBJECT, `C${'A'.repeat(55)}`);
    expect(getAttestationViaApi).not.toHaveBeenCalled();
  });
});
