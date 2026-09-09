import { useState } from 'react';
import { useWalletStore } from '@/store/wallet';
import { useVerify, useAttestation } from '@/hooks/useAttestation';
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  Field,
  Input,
  Spinner,
} from '@/components/ui';
import { isValidPublicKey, formatDate } from '@/lib/format';
import { explorerAccountUrl, explorerContractUrl } from '@/lib/network';
import { shortenAddress } from '@/lib/format';
import { deployment } from '@/config';

/**
 * Verify an attestation against the actual Soroban contract. The result
 * reflects live on-chain state: missing, revoked, and expired attestations
 * all fail verification.
 */
export function VerifyAttestation() {
  const address = useWalletStore((s) => s.address);
  const [subject, setSubject] = useState('');
  const [claimType, setClaimType] = useState('kyc_verified');
  const [searched, setSearched] = useState(false);
  const [attestationId, setAttestationId] = useState('');

  const verify = useVerify(
    searched ? subject : null,
    claimType,
    address,
  );
  const record = useAttestation(
    attestationId ? Number(attestationId) : null,
    address,
  );

  const ready = Boolean(address) && isValidPublicKey(subject) && claimType.trim();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Verify Attestation</h1>
        <p className="mt-1 text-sm text-slate-400">
          Query the live Soroban contract: verification fails for missing,
          revoked, or expired attestations.
        </p>
      </div>

      {!address && (
        <ErrorBanner message="Connect your Freighter wallet to query the contract (read-only)." />
      )}

      <Card title="Verification">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSearched(true);
          }}
        >
          <Field label="Subject address" hint="The Stellar identity to check.">
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value.trim())}
              placeholder="G…"
              autoComplete="off"
            />
          </Field>
          <Field label="Claim type">
            <Input
              value={claimType}
              onChange={(e) => setClaimType(e.target.value)}
              autoComplete="off"
            />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={!ready || verify.isFetching}>
              {verify.isFetching ? <Spinner label="Verifying…" /> : 'Verify on-chain'}
            </Button>
          </div>
        </form>

        {searched && verify.data !== undefined && (
          <div className="mt-4">
            {verify.data ? (
              <Badge tone="green">VALID — active attestation confirmed on-chain</Badge>
            ) : (
              <Badge tone="red">INVALID — no active attestation for this pair</Badge>
            )}
            <p className="mt-2 text-xs text-slate-500">
              <code>verify({shortenAddress(subject)}, {claimType})</code> — result from the
              attestation contract at{' '}
              <a
                href={explorerContractUrl(deployment.attestationContract)}
                target="_blank"
                rel="noreferrer"
                className="mono text-brand-500 hover:underline"
              >
                {shortenAddress(deployment.attestationContract, 10, 6)}
              </a>
              . Auto-refreshes every 10s, so a revocation is reflected immediately.
            </p>
          </div>
        )}
      </Card>

      <Card title="Attestation record lookup" description="Fetch a full record by id (commitment only — no raw claims).">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            record.refetch();
          }}
        >
          <Field label="Attestation id">
            <Input
              type="number"
              min={1}
              value={attestationId}
              onChange={(e) => setAttestationId(e.target.value)}
              placeholder="1"
              className="w-40"
            />
          </Field>
          <Button type="submit" variant="secondary" disabled={!attestationId || record.isFetching}>
            Fetch
          </Button>
        </form>

        {record.data && (
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">Subject</dt>
              <dd className="mono mt-0.5">
                <a href={explorerAccountUrl(record.data.subject)} target="_blank" rel="noreferrer" className="text-slate-200 hover:underline">
                  {shortenAddress(record.data.subject)}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Issuer</dt>
              <dd className="mono mt-0.5 text-slate-200">{shortenAddress(record.data.issuer)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Claim type</dt>
              <dd className="mt-0.5 text-slate-200">{record.data.claim_type}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Status</dt>
              <dd className="mt-0.5">
                <Badge tone={record.data.revoked ? 'red' : 'green'}>
                  {record.data.revoked ? 'revoked' : 'active'}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Issued</dt>
              <dd className="mt-0.5 text-slate-200">{formatDate(record.data.issued_at)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Expires</dt>
              <dd className="mt-0.5 text-slate-200">{formatDate(record.data.expiry)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-slate-500">Commitment (sha256)</dt>
              <dd className="mono mt-0.5 break-all text-slate-200">{record.data.claim_hash}</dd>
            </div>
          </dl>
        )}
        {record.isFetched && !record.data && (
          <p className="mt-4 text-sm text-slate-500">No attestation with that id.</p>
        )}
      </Card>
    </div>
  );
}