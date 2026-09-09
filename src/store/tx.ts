import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TxResult } from '@/lib/contract';

export interface TxHistoryEntry {
  hash: string;
  contract: string;
  method: string;
  status: 'SUCCESS' | 'FAILED';
  ledger: number | null;
  events: { topics: unknown[]; data: unknown }[];
  at: number;
  label: string;
}

interface TxHistoryState {
  entries: TxHistoryEntry[];
  record: (entry: Omit<TxHistoryEntry, 'at'>) => void;
  clear: () => void;
}

/**
 * Local transaction history — every contract call result with its events,
 * so the user can audit what happened after each action. Persisted to
 * localStorage; never contains secret material.
 */
export const useTxStore = create<TxHistoryState>()(
  persist(
    (set) => ({
      entries: [],
      record: (entry) =>
        set((state) => ({
          entries: [{ ...entry, at: Date.now() }, ...state.entries].slice(0, 50),
        })),
      clear: () => set({ entries: [] }),
    }),
    { name: 'attestation-tx-history' },
  ),
);

/** Normalize a contract TxResult into a history entry. */
export function toHistoryEntry(
  result: TxResult,
  contract: string,
  method: string,
  label: string,
): Omit<TxHistoryEntry, 'at'> {
  return {
    hash: result.hash,
    contract,
    method,
    status: result.status,
    ledger: result.ledger,
    events: result.events.map((e) => ({ topics: e.topics, data: e.data })),
    label,
  };
}