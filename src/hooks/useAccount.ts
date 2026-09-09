import { useQuery } from '@tanstack/react-query';
import { getHorizon } from '@/lib/network';
import { isValidPublicKey } from '@/lib/format';

export interface AccountInfo {
  exists: boolean;
  address: string;
  network: string;
  lastSeen: string;
  balances: { asset: string; amount: string }[];
}

/**
 * Query account existence + balances from Horizon.
 *
 * Horizon is the canonical source for classic account state; Soroban RPC is
 * only consulted for contract state. `exists=false` is a valid result, not
 * an error (an unfunded address simply does not exist on-chain yet).
 */
export function useAccount(address: string | null | undefined) {
  return useQuery({
    queryKey: ['account', address ?? ''],
    enabled: Boolean(address && isValidPublicKey(address)),
    staleTime: 30_000,
    queryFn: async (): Promise<AccountInfo> => {
      const addr = address as string;
      try {
        const account = await getHorizon().loadAccount(addr);
        return {
          exists: true,
          address: addr,
          network: 'stellar',
          lastSeen: new Date().toISOString(),
          balances: (account.balances ?? []).map((b) => ({
            asset:
              (b as { asset_type?: string; asset_code?: string }).asset_code ??
              (b as { asset_type?: string }).asset_type ??
              'unknown',
            amount: (b as { balance?: string }).balance ?? '0',
          })),
        };
      } catch {
        return {
          exists: false,
          address: addr,
          network: 'stellar',
          lastSeen: new Date().toISOString(),
          balances: [],
        };
      }
    },
  });
}