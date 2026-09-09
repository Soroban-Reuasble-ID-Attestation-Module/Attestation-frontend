import type { TxResult, ContractEventInfo } from '@/lib/contract';
import { explorerTxUrl } from '@/lib/network';
import { Badge, Card } from '@/components/ui';
import { shortenAddress } from '@/lib/format';

function EventList({ events }: { events: ContractEventInfo[] }) {
  if (events.length === 0) {
    return <p className="text-xs text-slate-500">No contract events emitted.</p>;
  }
  return (
    <ul className="space-y-2">
      {events.map((event, index) => {
        const name = String(event.topics[0] ?? 'event');
        return (
          <li
            key={index}
            className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-sky-300">{name}</span>
              {event.contractId && (
                <span className="mono text-slate-500">
                  {shortenAddress(event.contractId, 8, 6)}
                </span>
              )}
            </div>
            <pre className="mt-1 text-slate-400">
              {JSON.stringify({ topics: event.topics, data: event.data }, null, 2)}
            </pre>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Transaction experience panel: hash, status, ledger, contract events, and
 * an explorer link — shown after every contract call.
 */
export function TxPanel({
  result,
  contractLabel,
  methodLabel,
}: {
  result: TxResult;
  contractLabel?: string;
  methodLabel?: string;
}) {
  return (
    <Card
      title="Transaction result"
      description={`${contractLabel ?? 'contract'} · ${methodLabel ?? 'call'}`}
      actions={
        <a
          href={explorerTxUrl(result.hash)}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-brand-500 hover:underline"
        >
          View on explorer ↗
        </a>
      }
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-slate-500">Status</dt>
          <dd className="mt-0.5">
            {result.status === 'SUCCESS' ? (
              <Badge tone="green">SUCCESS</Badge>
            ) : (
              <Badge tone="red">FAILED</Badge>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Ledger</dt>
          <dd className="mono mt-0.5 text-slate-200">{result.ledger ?? '—'}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-slate-500">Transaction hash</dt>
          <dd className="mono mt-0.5 break-all text-slate-200">{result.hash}</dd>
        </div>
      </dl>
      <div className="mt-4">
        <h3 className="mb-2 text-sm font-medium text-slate-300">Contract events</h3>
        <EventList events={result.events} />
      </div>
    </Card>
  );
}