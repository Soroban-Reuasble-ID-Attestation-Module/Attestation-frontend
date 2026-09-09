import {
  rpc,
  TransactionBuilder,
  Operation,
  xdr,
  nativeToScVal,
  scValToNative,
  Address,
  BASE_FEE,
  type Transaction,
} from '@stellar/stellar-sdk';
import { deployment } from '@/config';
import { getServer } from '@/lib/network';

/**
 * Soroban contract invocation client.
 *
 * Implements the full transaction lifecycle mandated by the protocol:
 *
 *   build → simulate → prepare (assemble) → sign → submit → poll → decode
 *
 * A transaction is never treated as successful just because it was
 * submitted — we poll until it is confirmed on-ledger, then decode the
 * emitted contract events.
 */

export type ScValType =
  | 'address'
  | 'symbol'
  | 'bytes'
  | 'u32'
  | 'u64'
  | 'i128'
  | 'string'
  | 'bool'
  | 'raw';

export interface ScValArg {
  value: unknown;
  type: ScValType;
}

/** A decoded contract event from the transaction result. */
export interface ContractEventInfo {
  contractId: string | null;
  topics: unknown[];
  data: unknown;
}

/** Outcome of a submitted contract call. */
export interface TxResult {
  hash: string;
  status: 'SUCCESS' | 'FAILED';
  ledger: number | null;
  events: ContractEventInfo[];
}

/** Decode a hex string into bytes (for claim hashes and preimages). */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Convert an app-level argument to an SCVal for the contract ABI. */
export function toScVal(arg: ScValArg): xdr.ScVal {
  switch (arg.type) {
    case 'address':
      return xdr.ScVal.scvAddress(Address.fromString(arg.value as string).toScAddress());
    case 'symbol':
      return xdr.ScVal.scvSymbol(arg.value as string);
    case 'bytes':
      return xdr.ScVal.scvBytes(
        typeof arg.value === 'string'
          ? hexToBytes(arg.value as string)
          : (arg.value as Uint8Array),
      );
    case 'u32':
      return nativeToScVal(Number(arg.value), { type: 'u32' });
    case 'u64':
      return nativeToScVal(BigInt(arg.value as string | number), { type: 'u64' });
    case 'i128':
      return nativeToScVal(BigInt(arg.value as string | number), { type: 'i128' });
    case 'string':
      return xdr.ScVal.scvString(arg.value as string);
    case 'bool':
      return xdr.ScVal.scvBool(Boolean(arg.value));
    case 'raw':
      return arg.value as xdr.ScVal;
    default:
      return nativeToScVal(arg.value);
  }
}

export interface ContractCallOptions {
  contractId: string;
  method: string;
  args: ScValArg[];
  /** The account that signs (and pays for) the call. */
  source: string;
  /** Signs the prepared transaction XDR; returns the signed XDR. */
  signTransaction?: (txXdr: string) => Promise<string>;
}

async function buildBaseTransaction(
  server: rpc.Server,
  source: string,
  contractId: string,
  method: string,
  args: ScValArg[],
): Promise<Transaction> {
  const account = await server.getAccount(source);
  return new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: deployment.networkPassphrase,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
        function: method,
        args: args.map(toScVal),
      }),
    )
    .setTimeout(30)
    .build();
}

function requireSuccessfulSimulation(
  simulation: rpc.Api.SimulateTransactionResponse,
): rpc.Api.SimulateTransactionSuccessResponse {
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(simulation.error);
  }
  if (simulation.result === undefined || simulation.result === null) {
    throw new Error('Simulation produced no result');
  }
  return simulation;
}

/**
 * Run a read-only contract call: simulate and decode the return value.
 * Read calls never require a signature.
 */
export async function simulateContractCall(
  options: Omit<ContractCallOptions, 'signTransaction'>,
): Promise<unknown> {
  const server = getServer();
  const tx = await buildBaseTransaction(
    server,
    options.source,
    options.contractId,
    options.method,
    options.args,
  );
  const simulation = await server.simulateTransaction(tx);
  const success = requireSuccessfulSimulation(simulation);
  const retval = success.result?.retval;
  if (retval === undefined) {
    throw new Error('Simulation returned no value');
  }
  return scValToNative(retval);
}

/**
 * Submit a state-changing contract call through the full lifecycle:
 * simulate → assemble → sign → submit → poll → decode events.
 */
export async function submitContractCall(
  options: ContractCallOptions,
): Promise<TxResult> {
  if (!options.signTransaction) {
    throw new Error('A signer is required for state-changing contract calls');
  }

  const server = getServer();
  const tx = await buildBaseTransaction(
    server,
    options.source,
    options.contractId,
    options.method,
    options.args,
  );

  const simulation = await server.simulateTransaction(tx);
  requireSuccessfulSimulation(simulation);

  const assembled = rpc.assembleTransaction(tx, simulation).build();
  const signedXdr = await options.signTransaction(assembled.toXDR());
  const signed = TransactionBuilder.fromXDR(
    signedXdr,
    deployment.networkPassphrase,
  );
  const sent = await server.sendTransaction(signed);
  if (sent.status === 'ERROR') {
    throw new Error(`Send failed: ${sent.errorResult ?? 'unknown error'}`);
  }

  const confirmed = await pollForConfirmation(server, sent.hash);
  if (confirmed.status === 'FAILED') {
    throw new Error(`Transaction ${confirmed.txHash} failed on-ledger`);
  }

  return {
    hash: confirmed.txHash,
    status: confirmed.status,
    ledger: confirmed.ledger,
    events: parseContractEvents(confirmed.events.contractEventsXdr),
  };
}

type ConfirmedTransaction =
  | rpc.Api.GetSuccessfulTransactionResponse
  | rpc.Api.GetFailedTransactionResponse;

/** Poll RPC until the transaction is confirmed on-ledger or times out. */
async function pollForConfirmation(
  server: rpc.Server,
  hash: string,
  timeoutMs = 45_000,
): Promise<ConfirmedTransaction> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const tx = await server.getTransaction(hash);
    if (tx.status === 'SUCCESS') {
      return tx;
    }
    if (tx.status === 'FAILED') {
      return tx;
    }
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for transaction confirmation');
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
}

interface RawContractEvent {
  contractId?: () => unknown;
  body: () => { v0: () => { topics: () => unknown[]; data: unknown } };
}

/** Decode contract events from the transaction's parsed event list. */
function parseContractEvents(
  contractEventsXdr: unknown[][] | undefined,
): ContractEventInfo[] {
  if (!contractEventsXdr) {
    return [];
  }
  const events = contractEventsXdr.flat() as RawContractEvent[];
  return events.map((event) => {
    let contractId: string | null = null;
    try {
      // ContractID is a union: the "contractId" arm carries an ScAddress;
      // system events use the "system" arm and throw here.
      const union = event.contractId?.();
      if (union && typeof (union as { contractId?: () => unknown }).contractId === 'function') {
        const scAddress = (union as { contractId: () => unknown }).contractId();
        contractId = Address.fromScAddress(scAddress as xdr.ScAddress).toString();
      }
    } catch {
      // System events carry no contract id.
    }
    const v0 = event.body().v0();
    const topics = (v0.topics() ?? []).map((t) => safeToNative(t as xdr.ScVal));
    const data = safeToNative(v0.data as xdr.ScVal);
    return { contractId, topics, data };
  });
}

function safeToNative(scVal: xdr.ScVal): unknown {
  try {
    return scValToNative(scVal);
  } catch {
    return '<undecodable>';
  }
}