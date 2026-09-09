import testnet from './deployments/testnet.json';

/**
 * Deployment configuration for the Attestation Protocol.
 *
 * Contract addresses are loaded from `deployments/testnet.json` — the single
 * source of truth shared with the contracts repository. Components must never
 * hard-code addresses; import from here instead.
 */
export interface DeploymentConfig {
  network: string;
  rpcUrl: string;
  horizonUrl: string;
  networkPassphrase: string;
  attestationContract: string;
  escrowContract: string;
  escrowAsset: string;
  escrowSubject: string;
  escrowClaimType: string;
  escrowBeneficiary: string;
}

function resolveUrl(envKey: string, fallback: string): string {
  const fromEnv = import.meta.env[envKey] as string | undefined;
  return fromEnv && fromEnv.length > 0 ? fromEnv : fallback;
}

function readConfig(): DeploymentConfig {
  return {
    network: testnet.network ?? 'testnet',
    rpcUrl: resolveUrl('VITE_SOROBAN_RPC_URL', testnet.rpc_url),
    horizonUrl: resolveUrl('VITE_HORIZON_URL', testnet.horizon_url),
    networkPassphrase: resolveUrl(
      'VITE_NETWORK_PASSPHRASE',
      testnet.network_passphrase,
    ),
    attestationContract: testnet.attestation_contract ?? '',
    escrowContract: testnet.escrow_contract ?? '',
    escrowAsset: testnet.escrow_asset ?? '',
    escrowSubject: testnet.escrow_subject ?? '',
    escrowClaimType: testnet.escrow_claim_type ?? '',
    escrowBeneficiary: testnet.escrow_beneficiary ?? '',
  };
}

/** The active deployment configuration. */
export const deployment: DeploymentConfig = readConfig();

/** True when a contract id is present and looks like a Soroban contract id. */
export function isDeployed(contractId: string | undefined | null): boolean {
  return typeof contractId === 'string' && /^C[0-9A-Z]{55}$/.test(contractId);
}