import { Link } from 'react-router-dom';
import { useWalletStore } from '@/store/wallet';
import { useTxStore } from '@/store/tx';
import { useAccount } from '@/hooks/useAccount';
import { Badge, Card, EmptyState } from '@/components/ui';
import { deployment, isDeployed } from '@/config';
import { explorerAccountUrl, explorerTxUrl } from '@/lib/network';
import { shortenAddress } from '@/lib/format';

export function Dashboard() {
  const address = useWalletStore((s) => s.address);
  const account = useAccount(address);
  const entries = useTxStore((s) => s.entries);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Identity Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">
          Reusable Stellar identity and attestations — issue, verify, revoke,
          selectively disclose, and escrow USDC against on-chain attestations.
        </p>
      </div>

      {address && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Account" description="On-chain identity state">
            {account.isLoading ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : account.data?.exists ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Address</span>
                  <a
                    href={explorerAccountUrl(address)}
                    target="_blank"
                    rel="noreferrer"
                    className="mono text-brand-500 hover:underline"
                  >
                    {shortenAddress(address)}
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Existence</span>
                  <Badge tone="green">exists on-chain</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Balances</span>
                  <span className="mono text-slate-200">
                    {account.data.balances
                      .slice(0, 3)
                      .map((b) => `${Number(b.amount).toFixed(2)} ${b.asset}`)
                      .join(' · ') || 'none'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-sm">
                <Badge tone="amber">not funded on {deployment.network}</Badge>
                <p className="mt-2 text-xs text-slate-500">
                  The account does not exist on-chain yet. Fund it (e.g. via
                  the Friendbot faucet on testnet) to enable contract calls.
                </p>
              </div>
            )}
          </Card>

          <Card title="Deployments" description="Active contract addresses">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Attestation contract</span>
                <span className="flex items-center gap-2">
                  {isDeployed(deployment.attestationContract) ? (
                    <Badge tone="green">deployed</Badge>
                  ) : (
                    <Badge tone="red">missing</Badge>
                  )}
                  <span className="mono text-slate-200">
                    {shortenAddress(deployment.attestationContract, 10, 6)}
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Escrow contract</span>
                <span className="flex items-center gap-2">
                  {isDeployed(deployment.escrowContract) ? (
                    <Badge tone="green">deployed</Badge>
                  ) : (
                    <Badge tone="amber">not deployed</Badge>
                  )}
                  <span className="mono text-slate-200">
                    {deployment.escrowContract
                      ? shortenAddress(deployment.escrowContract, 10, 6)
                      : '—'}
                  </span>
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Loaded from <code>src/config/deployments/testnet.json</code>.
              </p>
            </div>
          </Card>
        </div>
      )}

      <Card
        title="Recent transactions"
        description="Last contract calls made from this browser"
        actions={
          entries.length > 0 ? (
            <Link to="/" className="text-sm text-slate-500">
              {entries.length} recorded
            </Link>
          ) : undefined
        }
      >
        {entries.length === 0 ? (
          <EmptyState>
            No transactions yet — try issuing or verifying an attestation.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-slate-800">
            {entries.slice(0, 5).map((entry) => (
              <li key={entry.hash} className="flex items-center gap-3 py-2 text-sm">
                <Badge tone={entry.status === 'SUCCESS' ? 'green' : 'red'}>
                  {entry.status}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-slate-300">
                  {entry.label}
                </span>
                <span className="mono hidden text-xs text-slate-500 sm:inline">
                  {shortenAddress(entry.hash)}
                </span>
                <a
                  href={explorerTxUrl(entry.hash)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-brand-500 hover:underline"
                >
                  explorer ↗
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}