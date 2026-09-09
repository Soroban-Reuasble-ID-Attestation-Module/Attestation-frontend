import { useQuery } from '@tanstack/react-query';
import { deployment } from '@/config';
import {
  verifyAttestation,
  getAttestation,
  isIssuer,
  type AttestationRecord,
} from '@/lib/attestation';
import { isValidPublicKey } from '@/lib/format';

/** Read-only verify() query — auto-refreshes so revocations show up. */
export function useVerify(
  subject: string | null,
  claimType: string,
  source: string | null,
  contractId = deployment.attestationContract,
) {
  return useQuery({
    queryKey: ['verify', contractId, subject ?? '', claimType],
    enabled: Boolean(
      subject && isValidPublicKey(subject) && claimType && source,
    ),
    refetchInterval: 10_000,
    queryFn: () =>
      verifyAttestation({
        subject: subject as string,
        claimType,
        source: source as string,
        contractId,
      }),
  });
}

/** Fetch a single attestation record by id (null when it does not exist). */
export function useAttestation(
  attestationId: number | null,
  source: string | null,
  contractId = deployment.attestationContract,
) {
  return useQuery<AttestationRecord | null>({
    queryKey: ['attestation', contractId, attestationId],
    enabled: Boolean(attestationId && source),
    queryFn: () => getAttestation(attestationId as number, source as string, contractId),
  });
}

/** Read-only issuer check for an address. */
export function useIsIssuer(
  address: string | null,
  source: string | null,
  contractId = deployment.attestationContract,
) {
  return useQuery({
    queryKey: ['is_issuer', contractId, address ?? ''],
    enabled: Boolean(address && isValidPublicKey(address) && source),
    queryFn: () => isIssuer(address as string, source as string, contractId),
  });
}