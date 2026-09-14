/// <reference types="vite/client" />

/**
 * Environment variables read by the app (see `.env.example`).
 *
 * Only `VITE_*` variables are exposed to the browser bundle — never put a
 * secret here. Everything below is optional; `src/config/index.ts` falls back
 * to `src/config/deployments/testnet.json` for the network settings.
 */
interface ImportMetaEnv {
  /** Public Soroban RPC endpoint. Overrides `rpc_url` from the deployment file. */
  readonly VITE_SOROBAN_RPC_URL?: string;
  /** Public Horizon endpoint. Overrides `horizon_url` from the deployment file. */
  readonly VITE_HORIZON_URL?: string;
  /** Network passphrase. Overrides `network_passphrase` from the deployment file. */
  readonly VITE_NETWORK_PASSPHRASE?: string;
  /**
   * Optional base URL of the Attestation backend REST API
   * (Attestation-backend-sdk `services/api`). When set, read-only queries use
   * the backend with automatic fallback to direct contract reads. Read routes
   * must be public on that deployment (`PUBLIC_READS=true`, the default).
   */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
