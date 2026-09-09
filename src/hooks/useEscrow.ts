import { useQuery } from '@tanstack/react-query';
import { deployment, isDeployed } from '@/config';
import {
  readEscrowBalance,
  readEscrowConfig,
  readEscrowDeposit,
  type EscrowState,
} from '@/lib/escrow';

/**
 * Aggregate escrow state: balance, the caller's deposit, lifecycle flag,
 * and full configuration. Refreshes every 8s so deposit/release changes
 * (and attestation-based gating outcomes) surface promptly.
 */
export function useEscrowState(
  source: string | null,
  contractId = deployment.escrowContract,
) {
  return useQuery<EscrowState>({
    queryKey: ['escrow', contractId, source ?? ''],
    enabled: Boolean(source && isDeployed(contractId)),
    refetchInterval: 8_000,
    queryFn: async (): Promise<EscrowState> => {
      const src = source as string;
      const [balance, deposit, config] = await Promise.all([
        readEscrowBalance(src, contractId),
        readEscrowDeposit(src, src, contractId),
        readEscrowConfig(src, contractId).catch(() => null),
      ]);
      return {
        balance,
        deposit,
        released: config?.released ?? false,
        config,
      };
    },
  });
}

/** True when the escrow is deployed and configured for the active network. */
export function escrowReady(): boolean {
  return (
    isDeployed(deployment.escrowContract) &&
    isDeployed(deployment.escrowAsset) &&
    isDeployed(deployment.escrowBeneficiary)
  );
}