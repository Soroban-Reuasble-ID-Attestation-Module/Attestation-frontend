import { useState } from 'react';
import { useWalletStore } from '@/store/wallet';
import { verifyClaimCommitment } from '@/lib/attestation';
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
import { isValidPublicKey } from '@/lib/format';

/**
 * Selective disclosure: prove that a claim value (with its salt) matches
 * the on-chain commitment — without revealing the value to the ledger.
 * The contract recomputes sha256(value ‖ salt) and compares it to the
 * stored commitment.
 */
export function SelectiveDisclosure() {
  const address = useWalletStore((s) => s.address);

  const [subject, setSubject] = useState('');
  const [claimType, setClaimType] = useState('kyc_verified');
  const [claimValue, setClaimValue] = useState('');
  const [salt, setSalt] = useState(generateSalt);
  const [checked, setChecked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<boolean | null>(null);
  const [computedHash, setComputedHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canCheck =
    Boolean(address) &&
    isValidPublicKey(subject) &&
    claimType.trim().length > 0 &&
    claimValue.trim().length > 0 &&
    salt.trim().length > 0;

  async function runCheck() {
    if (!canCheck || !address) return;
    setChecking(true);
    setError(null);
    setChecked(false);
    try {
      // Show the local commitment for transparency, then ask the contract.
      setComputedHash(await computeCommitment(claimValue, salt));
      const valid = await verifyClaimCommitment({
        subject,
        claimType,
        claimValue,
        salt,
        source: address,
      });
      setResult(valid);
      setChecked(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Selective Disclosure</h1>
        <p className="mt-1 text-sm text-slate-400">
          Prove a claim without revealing it. The contract recomputes{' '}
          <code>sha256(claim_value ‖ salt)</code> and compares it to the
          commitment stored at issuance — the raw value and salt never touch
          the ledger.
        </p>
      </div>

      {!address && (
        <ErrorBanner message="Connect your Freighter wallet to run the on-chain check (read-only)." />
      )}

      <Card title="Prove a commitment">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void runCheck();
          }}
        >
          <Field label="Subject address">
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
          <Field label="Claim value" hint="The value you claim to hold — kept in this browser only.">
            <Input
              value={claimValue}
              onChange={(e) => setClaimValue(e.target.value)}
              placeholder="passport:AB123"
              autoComplete="off"
            />
          </Field>
          <Field label="Salt" hint="The secret salt used at issuance.">
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
          <div className="sm:col-span-2">
            <Button type="submit" disabled={!canCheck || checking}>
              {checking ? <Spinner label="Checking…" /> : 'Verify commitment on-chain'}
            </Button>
          </div>
        </form>

        {computedHash && (
          <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
            <span className="text-xs text-slate-400">
              Local commitment (computed in this browser, never sent):{' '}
            </span>
            <code className="mono block break-all text-xs text-slate-200">{computedHash}</code>
          </div>
        )}

        {checked && result !== null && (
          <div className="mt-4">
            {result ? (
              <Badge tone="green">MATCH — the supplied value+ salt reproduces the on-chain commitment</Badge>
            ) : (
              <Badge tone="red">NO MATCH — wrong value, wrong salt, or the attestation is revoked/expired</Badge>
            )}
          </div>
        )}
      </Card>

      {error && <ErrorBanner message={error} />}
    </div>
  );
}