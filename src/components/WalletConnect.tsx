import { useWalletStore } from '@/store/wallet';
import { useAccount } from '@/hooks/useAccount';
import { Badge, Button, Spinner } from '@/components/ui';
import { explorerAccountUrl } from '@/lib/network';
import { shortenAddress } from '@/lib/format';
import { deployment } from '@/config';

/**
 * Connect a Stellar account with Freighter and display its public key,
 * network, existence, and native balance.
 *
 * Secret keys are never requested or exposed — all signing stays in the
 * wallet extension.
 */
export function WalletConnect() {
  const { address, connecting, error, connect, disconnect } = useWalletStore();
  const account = useAccount(address);

  if (address) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <a
              href={explorerAccountUrl(address)}
              target="_blank"
              rel="noreferrer"
              className="mono truncate text-sm font-medium text-brand-500 hover:underline"
              title={address}
            >
              {shortenAddress(address)}
            </a>
            <Badge tone="green">connected</Badge>
            <Badge tone="blue">{deployment.network}</Badge>
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {account.isLoading ? (
              'Loading account…'
            ) : account.data?.exists ? (
              <>
                Account exists on-chain ·{' '}
                {account.data.balances.length > 0
                  ? `${Number(account.data.balances[0].amount).toFixed(2)} XLM`
                  : 'no balances'}
              </>
            ) : (
              'Account does not exist on-chain yet'
            )}
          </div>
        </div>
        <Button variant="ghost" onClick={disconnect} className="ml-auto">
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={connect} disabled={connecting}>
          {connecting ? <Spinner label="Connecting…" /> : 'Connect Freighter wallet'}
        </Button>
        <span className="text-xs text-slate-500">
          Requires the Freighter browser extension on {deployment.network}.
        </span>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}