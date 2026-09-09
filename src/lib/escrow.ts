import { deployment } from '@/config';
import {
  simulateContractCall,
  submitContractCall,
  type ScValArg,
  type TxResult,
} from '@/lib/contract';

/**
 * Escrow contract facade.
 *
 * The escrow holds a SAC-compatible token and releases funds to a fixed
 * beneficiary only when the attestation contract's `verify()` succeeds —
 * a decision made **on-chain by the escrow itself**. The frontend can only
 * trigger `release()`; it can never instruct the escrow to release funds
 * past the attestation gate.
 */

export interface EscrowConfig {
  admin: string;
  asset: string;
  attestation_contract: string;
  subject: string;
  claim_type: string;
  beneficiary: string;
  released: boolean;
}

export interface EscrowState {
  balance: bigint;
  deposit: bigint;
  released: boolean;
  config: EscrowConfig | null;
}

function escrowArgs(...args: ScValArg[]): ScValArg[] {
  return args;
}

/** Read the escrow's full configuration. */
export async function readEscrowConfig(
  source: string,
  contractId = deployment.escrowContract,
): Promise<EscrowConfig> {
  const result = await simulateContractCall({
    contractId,
    method: 'config',
    args: [],
    source,
  });
  return result as EscrowConfig;
}

/** Total assets held by the escrow (i128). */
export async function readEscrowBalance(
  source: string,
  contractId = deployment.escrowContract,
): Promise<bigint> {
  const result = await simulateContractCall({
    contractId,
    method: 'get_balance',
    args: [],
    source,
  });
  return BigInt(result as string | number | bigint);
}

/** The caller's own deposit that can still be clawed back (i128). */
export async function readEscrowDeposit(
  source: string,
  address: string,
  contractId = deployment.escrowContract,
): Promise<bigint> {
  const result = await simulateContractCall({
    contractId,
    method: 'get_deposit',
    args: escrowArgs({ value: address, type: 'address' }),
    source,
  });
  return BigInt(result as string | number | bigint);
}

export interface DepositOptions {
  from: string;
  amount: bigint;
  signTransaction: (txXdr: string) => Promise<string>;
  contractId?: string;
}

/** Deposit `amount` (in base units) of the escrow asset from `from`. */
export async function deposit(
  options: DepositOptions,
): Promise<TxResult> {
  return submitContractCall({
    contractId: options.contractId ?? deployment.escrowContract,
    method: 'deposit',
    args: escrowArgs(
      { value: options.from, type: 'address' },
      { value: options.amount.toString(), type: 'i128' },
    ),
    source: options.from,
    signTransaction: options.signTransaction,
  });
}

export interface ReleaseOptions {
  source: string;
  amount: bigint;
  signTransaction: (txXdr: string) => Promise<string>;
  contractId?: string;
}

/**
 * Trigger `release()`. The escrow re-checks the attestation on-chain and
 * fails with `AttestationNotVerified` when the subject's attestation is
 * missing, revoked, or expired.
 */
export async function release(options: ReleaseOptions): Promise<TxResult> {
  return submitContractCall({
    contractId: options.contractId ?? deployment.escrowContract,
    method: 'release',
    args: escrowArgs({ value: options.amount.toString(), type: 'i128' }),
    source: options.source,
    signTransaction: options.signTransaction,
  });
}

export interface WithdrawOptions {
  from: string;
  amount: bigint;
  signTransaction: (txXdr: string) => Promise<string>;
  contractId?: string;
}

/** Claw back `amount` of the caller's own deposit before release. */
export async function withdraw(options: WithdrawOptions): Promise<TxResult> {
  return submitContractCall({
    contractId: options.contractId ?? deployment.escrowContract,
    method: 'withdraw',
    args: escrowArgs(
      { value: options.from, type: 'address' },
      { value: options.amount.toString(), type: 'i128' },
    ),
    source: options.from,
    signTransaction: options.signTransaction,
  });
}