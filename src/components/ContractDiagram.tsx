import { deployment, isDeployed } from '@/config';
import { explorerContractUrl } from '@/lib/network';
import { shortenAddress } from '@/lib/format';

interface DiagramState {
  /** Highlight the attestation → escrow verify() edge (during release). */
  verifying: boolean;
  /** Highlight the escrow → token transfer edge (after successful release). */
  releasing: boolean;
}

function Node({
  label,
  address,
  tone = 'slate',
  sub,
}: {
  label: string;
  address?: string;
  tone?: 'slate' | 'blue' | 'violet' | 'green';
  sub?: string;
}) {
  const tones = {
    slate: 'border-slate-700 bg-slate-900 text-slate-200',
    blue: 'border-sky-600/60 bg-sky-950/60 text-sky-200',
    violet: 'border-violet-600/60 bg-violet-950/60 text-violet-200',
    green: 'border-emerald-600/60 bg-emerald-950/60 text-emerald-200',
  };
  const deployed = address ? isDeployed(address) : false;
  return (
    <div className={`flex min-w-0 flex-col items-center gap-1 rounded-xl border px-4 py-3 text-center ${tones[tone]}`}>
      <span className="text-sm font-semibold">{label}</span>
      {address ? (
        deployed ? (
          <a
            href={explorerContractUrl(address)}
            target="_blank"
            rel="noreferrer"
            className="mono text-xs text-slate-400 hover:underline"
            title={address}
          >
            {shortenAddress(address, 10, 6)}
          </a>
        ) : (
          <span className="text-xs text-amber-300">not deployed</span>
        )
      ) : (
        sub && <span className="text-xs text-slate-400">{sub}</span>
      )}
    </div>
  );
}

function Edge({
  label,
  active,
  activeLabel,
}: {
  label: string;
  active: boolean;
  activeLabel: string;
}) {
  return (
    <div className="flex flex-col items-center px-1 py-2">
      <div
        className={`h-0.5 w-10 rounded-full transition-colors ${
          active ? 'bg-emerald-400' : 'bg-slate-700'
        }`}
      />
      <span
        className={`mt-1 text-center text-[10px] leading-tight ${
          active ? 'font-semibold text-emerald-300' : 'text-slate-500'
        }`}
      >
        {active ? activeLabel : label}
      </span>
      {active && (
        <span className="mt-0.5 animate-pulse text-[10px] text-emerald-300">●</span>
      )}
    </div>
  );
}

/**
 * Contract visualization for the escrow demonstration.
 *
 *   Stellar Account → Attestation Contract → Escrow Contract → SAC / token
 *
 * The verify() edge is highlighted while a release is being evaluated; the
 * transfer edge lights up when funds move. This makes the on-chain
 * contract-to-contract gate visible in the UI.
 */
export function ContractDiagram({ state }: { state: DiagramState }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-5">
      <h3 className="mb-4 text-sm font-semibold text-slate-300">
        On-chain flow
      </h3>
      <div className="flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
        <Node label="Stellar Account" sub={deployment.network} />
        <Edge
          label="deposit"
          active={false}
          activeLabel="deposit"
        />
        <Node
          label="Attestation Contract"
          address={deployment.attestationContract}
          tone="blue"
        />
        <Edge
          label="verify() on release"
          active={state.verifying}
          activeLabel="verify() on-chain"
        />
        <Node
          label="Escrow Contract"
          address={deployment.escrowContract}
          tone="violet"
        />
        <Edge
          label="release funds"
          active={state.releasing}
          activeLabel="funds released"
        />
        <Node
          label={`SAC / ${deployment.escrowAssetSymbol}`}
          address={deployment.escrowAsset}
          tone="green"
        />
      </div>
      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        The escrow contract itself calls{' '}
        <code className="text-slate-300">verify(subject, claim_type)</code>{' '}
        cross-contract before any transfer — the release decision is made
        on-chain, never by this frontend.
      </p>
    </div>
  );
}