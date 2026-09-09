import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWalletStore } from '@/store/wallet';
import { useTxStore, toHistoryEntry } from '@/store/tx';
import { issueAttestation } from '@/lib/attestation';
import { computeCommitment, generateSalt } from '@/lib/commitment';
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  Field,
  Input,
  Spinner,
} from '@/components/ui';
import { TxPanel } from '@/components/TxPanel';
import { deployment } from '@/config';
import { formatDate, isValidPublicKey } from '@/lib/format';
import type { TxResult } from '@/lib/contract';

const DEFAULT_EXPIRY_DAYS = 365;

/**
 * Issue an attestation. Only the commitment (SHA-256 of value ‖ salt) is
 * written on-chain — the raw claim value never leaves this browser.
 */
export function IssueAttestation() {
  const { address, sign } = useWalletStore();
  const recordTx = useTxStore((s) => s.record);
  const queryClient = useQueryClient();

  const [issuer, setIssuer] = useState('');
  const [subject, setSubject] = useState('');
  const [claimType, setClaimType] = useState('kyc_verified');
  const [claimValue, setClaimValue] = useState('');
  const [salt, setSalt] = useState(generateSalt);
  const [expiryDays, setExpiryDays] = useState(DEFAULT_EXPIRY_DAYS);
  const [commitment, setCommitment] = useState<string | null>(null);

  const mutation = useMutation<TxResult, Error>({
    mutationFn: async () => {
      const claimHash = await computeCommitment(claimValue, salt);
      setCommitment(claimHash);
      return issueAttestation({
        issuer,
        subject,
        claimType,
        claimHash,
        expiry: Math.floor(Date.now() / 1000) + expiryDays * 86_400,
        signTransaction: sign,
      });
    },
    onSuccess: (result) => {
      recordTx(toHistoryEntry(result, deployment.attestationContract, 'issue_attestation', `Issue ${claimType} for ${subject}`));
      void queryClient.invalidateQueries({ queryKey: ['verify'] });
    },
  });

  const canSubmit =
    Boolean(address) &&
    isValidPublicKey(issuer) &&
    isValidPublicKey(subject) &&
    claimType.trim().length > 0 &&
    claimValue.trim().length > 0 &&
    salt.trim().length > 0 &&
    expiryDays > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Issue Attestation</h1>
        <p className="mt-1 text-sm text-slate-400">
          Authorized issuers bind a cryptographic commitment to a subject's
          Stellar address. Only <code>sha256(claim_value ‖ salt)</code> is
          written on-chain — never the raw value.
        </p>
      </div>

      {!address && (
        <ErrorBanner message="Connect your Freighter wallet first — the issuing account must be a registered issuer." />
      )}

      <Card title="Issuance form">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <Field label="Issuer address" hint="Must be registered in the issuer registry (admin adds issuers).">
            <Input
              value={issuer}
              onChange={(e) => setIssuer(e.target.value.trim())}
              placeholder="G…"
              autoComplete="off"
            />
          </Field>
          <Field label="Subject address" hint="The Stellar identity the attestation is bound to.">
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value.trim())}
              placeholder="G…"
              autoComplete="off"
            />
          </Field>
          <Field label="Claim type" hint="e.g. kyc_verified, accredited_investor, liveness.">
            <Input
              value={claimType}
              onChange={(e) => setClaimType(e.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field label="Claim value" hint="Never stored or sent to the ledger — only its digest is.">
            <Input
              value={claimValue}
              onChange={(e) => setClaimValue(e.target.value)}
              placeholder="passport:AB123"
              autoComplete="off"
            />
          </Field>
          <Field
            label="Salt"
            hint="High-entropy, unique per claim. Auto-generated (16 random bytes); keep it secret for selective disclosure."
          >
            <div className="flex gap-2">
              <Input
                value={salt}
                onChange={(e) => setSalt(e.target.value)}
                className="mono"
                autoComplete="off"
              />
              <Button type="button" variant="secondary" onClick={() => setSalt(generateSalt())}>
                Regenerate
              </Button>
            </div>
          </Field>
          <Field label={`Expiry (${expiryDays} days → ${formatDate(Math.floor(Date.now() / 1000) + expiryDays * 86_400)})`}>
            <Input
              type="number"
              min={1}
              max={3650}
              value={expiryDays}
              onChange={(e) => setExpiryDays(Number(e.target.value))}
            />
          </Field>

          {commitment && (
            <div className="sm:col-span-2">
              <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-400">Commitment written on-chain</span>
                  <Badge tone="blue">sha256(value ‖ salt)</Badge>
                </div>
                <code className="mono mt-1 block break-all text-xs text-slate-200">{commitment}</code>
              </div>
            </div>
          )}

          <div className="sm:col-span-2">
            <Button type="submit" disabled={!canSubmit || mutation.isPending}>
              {mutation.isPending ? <Spinner label="Submitting…" /> : 'Issue attestation'}
            </Button>
          </div>
        </form>
      </Card>

      {mutation.error && <ErrorBanner message={mutation.error.message} />}
      {mutation.data && (
        <TxPanel result={mutation.data} contractLabel="Attestation contract" methodLabel="issue_attestation" />
      )}
    </div>
  );
}