import { create } from 'zustand';
import {
  isConnected,
  requestAccess,
  signTransaction,
  getNetwork,
  getAddress,
} from '@stellar/freighter-api';
import { deployment } from '@/config';
import { isSupportedNetwork } from '@/lib/network';

interface WalletState {
  address: string | null;
  connecting: boolean;
  error: string | null;
  walletNetwork: string | null;
  walletPassphrase: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  sign: (txXdr: string) => Promise<string>;
}

/**
 * Wallet store — connects to Freighter (or a Freighter-compatible wallet)
 * and exposes the signing callback used by the contract client.
 *
 * Secret keys are never requested, handled, or stored in the application.
 * All signing happens inside the wallet extension.
 */
export const useWalletStore = create<WalletState>((set, get) => ({
  address: null,
  connecting: false,
  error: null,
  walletNetwork: null,
  walletPassphrase: null,

  connect: async () => {
    set({ connecting: true, error: null });
    try {
      const connected = await isConnected();
      if (!connected.isConnected) {
        throw new Error(
          'Freighter is not connected. Install the Freighter wallet extension and unlock it.',
        );
      }

      const access = await requestAccess();
      if (access.error) {
        throw new Error(access.error.message ?? 'Freighter denied access');
      }

      const network = await getNetwork();
      const passphrase = network.networkPassphrase ?? '';

      if (!isSupportedNetwork(passphrase)) {
        throw new Error(
          `Wrong network: Freighter is on "${network.network}" but this app is configured for "${deployment.network}" (${deployment.networkPassphrase}). Switch networks in Freighter and reconnect.`,
        );
      }

      set({
        address: access.address,
        walletNetwork: network.network,
        walletPassphrase: passphrase,
        connecting: false,
      });
    } catch (error) {
      set({
        connecting: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  disconnect: () => set({ address: null, walletNetwork: null, walletPassphrase: null }),

  sign: async (txXdr: string) => {
    const state = get();
    if (!state.address) {
      throw new Error('Wallet not connected');
    }
    const signed = await signTransaction(txXdr, {
      networkPassphrase: deployment.networkPassphrase,
      address: state.address,
    });
    if (signed.error) {
      throw new Error(signed.error.message ?? 'Transaction signing failed');
    }
    return signed.signedTxXdr;
  },
}));

/** Restore the last connected address (best-effort, for UX continuity). */
export async function restoreWallet(): Promise<void> {
  try {
    const connected = await isConnected();
    if (!connected.isConnected) return;
    const address = await getAddress();
    if (address.error) return;
    const network = await getNetwork();
    if (!isSupportedNetwork(network.networkPassphrase)) return;
    useWalletStore.setState({
      address: address.address,
      walletNetwork: network.network,
      walletPassphrase: network.networkPassphrase,
    });
  } catch {
    // Silent — the user can connect explicitly.
  }
}