import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWalletStore } from '@/store/wallet';
import { useTxStore, toHistoryEntry } from '@/store/tx';
import { useIsIssuer } from '@/hooks/useAttestation';
import { addIssuer, removeIssuer } from '@/lib/attestation';
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
import { isValidPublicKey } from '@/lib/format';
import type { TxResult } from '@/lib/contract';

/**
 * Issuer registry: check whether an address is a registered issuer, and
 * (admin only) add/remove issuers. Only registered issuers can issue
 * attestations.
 */
export function AttestationRegistry() {
  const { address, sign } = useWalletStore();
  const recordTx = useTxStore((s) => s.record);
  const queryClient = useQueryClient();

  const [checkAddress, setCheckAddress] = useState('');
  const [issuerToAdd, setIssuerToAdd] = useState('');
  const [issuerToRemove, setIssuerToRemove] = useState('');

  const isIssuer = useIsIssuer(checkAddress || null, address);

  const addMutation = useMutation<TxResult, Error>({
    mutationFn: () =>
      addIssuer({ caller: address as string, issuer: issuerToAdd, signTransaction: sign }),
    onSuccess: (result) => {
      recordTx(toHistoryEntry(result, deployment.attestationContract, 'add_issuer', `Register issuer ${issuerToAdd}`));
      void queryClient.invalidateQueries({ queryKey: ['is_issuer'] });
    },
  });

  const removeMutation = useMutation<TxResult, Error>({
    mutationFn: () =>
      removeIssuer({ caller: address as string, issuer: issuerToRemove, signTransaction: sign }),
    onSuccess: (result) => {
      recordTx(toHistoryEntry(result, deployment.attestationContract, 'remove_issuer', `Remove issuer ${issuerToRemove}`));
      void queryClient.invalidateQueries({ queryKey: ['is_issuer'] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Attestation Registry</h1>
        <p className="mt-1 text-sm text-slate-400">
          Authorized issuers are registered on-chain by the contract admin.
          Only registered addresses can issue attestations.
        </p>
      </div>

      <Card title="Check an issuer">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            isIssuer.refetch();
          }}
        >
          <Field label="Address">
            <Input
              value={checkAddress}
              onChange={(e) => setCheckAddress(e.target.value.trim())}
              placeholder="G…"
              className="w-72"
            />
          </Field>
          <Button
            type="submit"
            variant="secondary"
            disabled={!isValidPublicKey(checkAddress) || !address}
          >
            Check
          </Button>
        </form>
        {isIssuer.data !== undefined && (
          <p className="mt-3 text-sm">
            {isIssuer.data ? (
              <Badge tone="green">Registered issuer</Badge>
            ) : (
              <Badge tone="slate">Not a registered issuer</Badge>
            )}
          </p>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Add issuer" description="Admin only — authorizes an address to issue attestations.">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              addMutation.mutate();
            }}
          >
            <Field label="Issuer address">
              <Input
                value={issuerToAdd}
                onChange={(e) => setIssuerToAdd(e.target.value.trim())}
                placeholder="G…"
              />
            </Field>
            <Button
              type="submit"
              disabled={
                !address || !isValidPublicKey(issuerToAdd) || addMutation.isPending
              }
            >
              {addMutation.isPending ? <Spinner label="…" /> : 'Add'}
            </Button>
          </form>
          {addMutation.error && <ErrorBanner message={addMutation.error.message} />}
          {addMutation.data && (
            <TxPanel result={addMutation.data} contractLabel="Attestation contract" methodLabel="add_issuer" />
          )}
        </Card>

        <Card title="Remove issuer" description="Admin only — existing attestations stay valid until revoked or expired.">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              removeMutation.mutate();
            }}
          >
            <Field label="Issuer address">
              <Input
                value={issuerToRemove}
                onChange={(e) => setIssuerToRemove(e.target.value.trim())}
                placeholder="G…"
              />
            </Field>
            <Button
              type="submit"
              variant="danger"
              disabled={
                !address || !isValidPublicKey(issuerToRemove) || removeMutation.isPending
              }
            >
              {removeMutation.isPending ? <Spinner label="…" /> : 'Remove'}
            </Button>
          </form>
          {removeMutation.error && <ErrorBanner message={removeMutation.error.message} />}
          {removeMutation.data && (
            <TxPanel result={removeMutation.data} contractLabel="Attestation contract" methodLabel="remove_issuer" />
          )}
        </Card>
      </div>
    </div>
  );
}