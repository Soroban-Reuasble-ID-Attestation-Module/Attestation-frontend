import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWalletStore } from '@/store/wallet';
import { useTxStore, toHistoryEntry } from '@/store/tx';
import { useEscrowState, escrowReady } from '@/hooks/useEscrow';
import { deposit, release, withdraw } from '@/lib/escrow';
import { ContractDiagram } from '@/components/ContractDiagram';
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
import { deployment, isDeployed } from '@/config';
import { explorerContractUrl } from '@/lib/network';
import { shortenAddress, formatAmount } from '@/lib/format';
import type { TxResult } from '@/lib/contract';

const USDC_DECIMALS = 7;

/**
 * USDC escrow demonstration.
 *
 * Flow: subject deposits USDC → escrow holds funds → release() is
 * triggered → the ESCROW contract itself calls the attestation contract's
 * verify() on-chain → valid: funds transfer to the beneficiary; invalid:
 * release fails with AttestationNotVerified. The frontend can only trigger
 * release — it can never bypass the gate.
 */
export function EscrowDemo() {
  const { address, sign } = useWalletStore();
  const recordTx = useTxStore((s) => s.record);
  const queryClient = useQueryClient();

  const escrow = useEscrowState(address);
  const ready = escrowReady();

  const [depositAmount, setDepositAmount] = useState('');
  const [releaseAmount, setReleaseAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [verifying, setVerifying] = useState(false);

  const amountToBaseUnits = (value: string): bigint =>
    BigInt(Math.round(Number(value) * 10 ** USDC_DECIMALS) || 0);

  const depositMutation = useMutation<TxResult, Error>({
    mutationFn: () =>
      deposit({
        from: address as string,
        amount: amountToBaseUnits(depositAmount),
        signTransaction: sign,
      }),
    onSuccess: (result) => {
      recordTx(toHistoryEntry(result, deployment.escrowContract, 'deposit', `Deposit ${depositAmount} USDC`));
      void queryClient.invalidateQueries({ queryKey: ['escrow'] });
    },
  });

  const releaseMutation = useMutation<TxResult, Error>({
    mutationFn: async () => {
      setVerifying(true);
      try {
        return await release({
          source: address as string,
          amount: amountToBaseUnits(releaseAmount || escrow.data?.balance.toString() || '0'),
          signTransaction: sign,
        });
      } finally {
        setVerifying(false);
      }
    },
    onSuccess: (result) => {
      recordTx(toHistoryEntry(result, deployment.escrowContract, 'release', 'Release escrow funds'));
      void queryClient.invalidateQueries({ queryKey: ['escrow'] });
      void queryClient.invalidateQueries({ queryKey: ['verify'] });
    },
  });

  const withdrawMutation = useMutation<TxResult, Error>({
    mutationFn: () =>
      withdraw({
        from: address as string,
        amount: amountToBaseUnits(withdrawAmount),
        signTransaction: sign,
      }),
    onSuccess: (result) => {
      recordTx(toHistoryEntry(result, deployment.escrowContract, 'withdraw', `Withdraw ${withdrawAmount} USDC`));
      void queryClient.invalidateQueries({ queryKey: ['escrow'] });
    },
  });

  const balanceDisplay = useMemo(
    () => (escrow.data ? formatAmount(escrow.data.balance, USDC_DECIMALS) : '—'),
    [escrow.data],
  );
  const depositDisplay = useMemo(
    () => (escrow.data ? formatAmount(escrow.data.deposit, USDC_DECIMALS) : '—'),
    [escrow.data],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">USDC Escrow Demonstration</h1>
        <p className="mt-1 text-sm text-slate-400">
          Funds are released only when the <strong>escrow contract itself</strong>{' '}
          confirms the subject's attestation on-chain — never at this
          frontend's instruction.
        </p>
      </div>

      {!isDeployed(deployment.escrowContract) && (
        <ErrorBanner message="The escrow contract is not deployed for this network yet. Deploy it with `make deploy-escrow-testnet` in the contracts repo, then update src/config/deployments/testnet.json." />
      )}

      <ContractDiagram state={{ verifying, releasing: Boolean(releaseMutation.data) }} />

      {ready && escrow.data && (
        <Card title="Escrow configuration" description="Bound atomically at deployment.">
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-slate-500">Asset</dt>
              <dd className="mono mt-0.5 text-slate-200">{shortenAddress(escrow.data.config?.asset ?? deployment.escrowAsset, 10, 6)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Subject (must hold attestation)</dt>
              <dd className="mono mt-0.5 text-slate-200">{shortenAddress(escrow.data.config?.subject ?? deployment.escrowSubject, 10, 6)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Required claim</dt>
              <dd className="mt-0.5 text-slate-200">{escrow.data.config?.claim_type ?? deployment.escrowClaimType}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Beneficiary (receives on release)</dt>
              <dd className="mono mt-0.5 text-slate-200">{shortenAddress(escrow.data.config?.beneficiary ?? deployment.escrowBeneficiary, 10, 6)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Attestation contract</dt>
              <dd className="mono mt-0.5">
                <a href={explorerContractUrl(deployment.attestationContract)} target="_blank" rel="noreferrer" className="text-brand-500 hover:underline">
                  {shortenAddress(deployment.attestationContract, 10, 6)}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Lifecycle</dt>
              <dd className="mt-0.5">
                <Badge tone={escrow.data.released ? 'red' : 'green'}>
                  {escrow.data.released ? 'released — escrow closed' : 'open for deposits'}
                </Badge>
              </dd>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Escrow balance" description="Live on-chain state (USDC, 7 decimals).">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-6">
              <div className="text-2xl font-bold text-slate-100">{balanceDisplay}</div>
              <div className="mt-1 text-xs text-slate-500">total held</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-6">
              <div className="text-2xl font-bold text-slate-100">{depositDisplay}</div>
              <div className="mt-1 text-xs text-slate-500">your deposit</div>
            </div>
          </div>
          {!address && (
            <p className="mt-3 text-xs text-slate-500">Connect a wallet to deposit and release.</p>
          )}
        </Card>

        <Card title="Actions" description="Each action is a signed Soroban transaction.">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              depositMutation.mutate();
            }}
          >
            <Field label="Deposit amount (USDC)">
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.0000001"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="100"
                />
                <Button type="submit" disabled={!address || !depositAmount || depositMutation.isPending || escrow.data?.released}>
                  {depositMutation.isPending ? <Spinner label="…" /> : 'Deposit'}
                </Button>
              </div>
            </Field>
          </form>

          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              releaseMutation.mutate();
            }}
          >
            <Field
              label="Release amount (USDC)"
              hint="The escrow re-checks verify(subject, claim_type) on-chain. Invalid → AttestationNotVerified, funds stay put."
            >
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.0000001"
                  value={releaseAmount}
                  onChange={(e) => setReleaseAmount(e.target.value)}
                  placeholder={balanceDisplay === '—' ? '0' : balanceDisplay}
                />
                <Button
                  type="submit"
                  variant="danger"
                  disabled={!address || releaseMutation.isPending || escrow.data?.released || !escrow.data || escrow.data.balance <= 0n}
                >
                  {releaseMutation.isPending ? <Spinner label="Releasing…" /> : 'Release'}
                </Button>
              </div>
            </Field>
          </form>

          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              withdrawMutation.mutate();
            }}
          >
            <Field label="Withdraw (claw back your deposit before release)">
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.0000001"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={!address || !withdrawAmount || withdrawMutation.isPending || escrow.data?.released}
                >
                  {withdrawMutation.isPending ? <Spinner label="…" /> : 'Withdraw'}
                </Button>
              </div>
            </Field>
          </form>
        </Card>
      </div>

      {depositMutation.error && <ErrorBanner message={depositMutation.error.message} />}
      {releaseMutation.error && <ErrorBanner message={releaseMutation.error.message} />}
      {withdrawMutation.error && <ErrorBanner message={withdrawMutation.error.message} />}

      {depositMutation.data && (
        <TxPanel result={depositMutation.data} contractLabel="Escrow contract" methodLabel="deposit" />
      )}
      {releaseMutation.data && (
        <TxPanel result={releaseMutation.data} contractLabel="Escrow contract" methodLabel="release" />
      )}
      {withdrawMutation.data && (
        <TxPanel result={withdrawMutation.data} contractLabel="Escrow contract" methodLabel="withdraw" />
      )}
    </div>
  );
}