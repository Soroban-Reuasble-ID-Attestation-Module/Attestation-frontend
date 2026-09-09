import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWalletStore } from '@/store/wallet';
import { useTxStore, toHistoryEntry } from '@/store/tx';
import { revokeAttestation } from '@/lib/attestation';
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
import type { TxResult } from '@/lib/contract';

/**
 * Revoke an attestation by id. Only the issuing issuer or the contract
 * admin may revoke; revocation is persistent and irreversible — a revoked
 * attestation fails every verification path, including escrow releases.
 */
export function RevokeAttestation() {
  const { address, sign } = useWalletStore();
  const recordTx = useTxStore((s) => s.record);
  const queryClient = useQueryClient();

  const [attestationId, setAttestationId] = useState('');

  const mutation = useMutation<TxResult, Error>({
    mutationFn: () =>
      revokeAttestation({
        caller: address as string,
        attestationId: Number(attestationId),
        signTransaction: sign,
      }),
    onSuccess: (result) => {
      recordTx(
        toHistoryEntry(result, deployment.attestationContract, 'revoke', `Revoke attestation #${attestationId}`),
      );
      void queryClient.invalidateQueries({ queryKey: ['verify'] });
      void queryClient.invalidateQueries({ queryKey: ['attestation'] });
      void queryClient.invalidateQueries({ queryKey: ['escrow'] });
    },
  });

  const canSubmit =
    Boolean(address) && Number.isInteger(Number(attestationId)) && Number(attestationId) > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Revoke Attestation</h1>
        <p className="mt-1 text-sm text-slate-400">
          Persistent, irreversible revocation. A revoked attestation
          immediately fails <code>verify()</code> — including inside the
          escrow contract.
        </p>
      </div>

      {!address && (
        <ErrorBanner message="Connect your Freighter wallet — only the issuing issuer or admin can revoke." />
      )}

      <Card title="Revocation">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <Field label="Attestation id" hint="Find ids from the issuance event or the registry.">
            <Input
              type="number"
              min={1}
              value={attestationId}
              onChange={(e) => setAttestationId(e.target.value)}
              placeholder="1"
              className="w-44"
            />
          </Field>
          <Button type="submit" variant="danger" disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending ? <Spinner label="Revoking…" /> : 'Revoke'}
          </Button>
          <span className="pb-2 text-xs text-slate-500">
            Will sign as <span className="mono">{address ? 'your connected account' : '—'}</span>
          </span>
        </form>
      </Card>

      {mutation.error && <ErrorBanner message={mutation.error.message} />}
      {mutation.data && (
        <div className="space-y-4">
          <Badge tone="green">Revocation confirmed on-chain</Badge>
          <TxPanel result={mutation.data} contractLabel="Attestation contract" methodLabel="revoke" />
        </div>
      )}
    </div>
  );
}