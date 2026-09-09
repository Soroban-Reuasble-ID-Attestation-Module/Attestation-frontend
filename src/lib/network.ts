import { rpc, Horizon } from '@stellar/stellar-sdk';
import { deployment } from '@/config';

/** A Soroban RPC client bound to the configured network. */
export function getServer(): rpc.Server {
  return new rpc.Server(deployment.rpcUrl);
}

/** A Horizon client bound to the configured network. */
export function getHorizon(): Horizon.Server {
  return new Horizon.Server(deployment.horizonUrl);
}

/** Explorer URL for a transaction hash. */
export function explorerTxUrl(hash: string): string {
  return `https://stellar.expert/explorer/${deployment.network}/tx/${hash}`;
}

/** Explorer URL for an account address. */
export function explorerAccountUrl(address: string): string {
  return `https://stellar.expert/explorer/${deployment.network}/account/${address}`;
}

/** Explorer URL for a Soroban contract id. */
export function explorerContractUrl(contractId: string): string {
  return `https://stellar.expert/explorer/${deployment.network}/contract/${contractId}`;
}

/** True when `network` (as reported by the wallet) matches the configured one. */
export function isSupportedNetwork(networkPassphrase: string | undefined): boolean {
  return networkPassphrase === deployment.networkPassphrase;
}