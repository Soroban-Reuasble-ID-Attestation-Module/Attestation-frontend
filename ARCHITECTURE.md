# Architecture

## 1. Overview

The frontend is a single-page React application that talks **directly to
the Soroban contracts** on Stellar testnet. It never stores secret keys and
never signs outside the wallet extension.

```text
┌────────────────────────────────────────────────────────────┐
│ Browser                                                     │
│  React UI (pages)                                           │
│    │  TanStack Query (server state)                         │
│    │  Zustand (wallet + tx history)                         │
│    ▼                                                        │
│  lib/contract.ts  — build → simulate → assemble → sign      │
│                    → submit → poll → decode events          │
│    │                                                       │
│    ├── Soroban RPC (soroban-testnet.stellar.org)           │
│    │     └─ Attestation contract  (verify, issue, revoke…) │
│    │     └─ Escrow contract       (deposit, release, …)    │
│    ├── Horizon (horizon-testnet.stellar.org)               │
│    │     └─ account existence + balances                   │
│    └── Freighter extension — signTransaction(xdr)          │
└────────────────────────────────────────────────────────────┘
```

## 2. Transaction lifecycle

All state-changing contract calls go through one client
(`src/lib/contract.ts`) implementing the protocol-mandated lifecycle:

1. **Build** — `server.getAccount(source)` + `TransactionBuilder` with an
   `Operation.invokeContractFunction` op (ABI arguments encoded with
   `toScVal`).
2. **Simulate** — obtains the resource footprint and the auth entries the
   contract requires (e.g. the issuer's `require_auth` on
   `issue_attestation`).
3. **Prepare** — `rpc.assembleTransaction` attaches footprint + auth.
4. **Sign** — the assembled XDR is handed to Freighter; the app never sees
   the secret key.
5. **Submit** — `server.sendTransaction`.
6. **Poll** — `getTransaction` until `SUCCESS`/`FAILED` (never trust the
   submission response alone).
7. **Decode** — contract events are parsed from the confirmed transaction
   and shown in the transaction panel.

Read-only calls (`verify`, `get_attestation`, `is_issuer`, `config`,
balances) skip steps 4–7: the simulation's return value is decoded with
`scValToNative`.

## 3. Data flow by feature

### Connect account
`store/wallet.ts` uses `@stellar/freighter-api`:
`isConnected → requestAccess → getNetwork` (passphrase checked against the
configured network) → the public key becomes the `source` for all calls.
`restoreWallet()` re-attaches a previously connected address on load.

### Issue / Verify / Revoke / Disclosure / Registry
Thin facades in `src/lib/attestation.ts` map typed options to SCVal args
and call the shared client. TanStack Query hooks cache read results;
mutations invalidate the affected query keys on success and append a
transaction-history entry.

### USDC escrow (the critical path)
`src/pages/EscrowDemo.tsx` + `src/lib/escrow.ts`:

1. **Deposit** — the subject transfers the SAC token into the escrow
   (`deposit(from, amount)`; `from.require_auth()`).
2. **Release** — the UI triggers `release(amount)`. The **escrow contract
   itself** calls `attestation.verify(subject, claim_type)` cross-contract:
   - valid ⇒ funds transfer to the fixed beneficiary, escrow closes;
   - missing/revoked/expired ⇒ `EscrowError::AttestationNotVerified`, no
     transfer.
3. **Withdraw** — before release, a depositor can claw back their own
   deposit.

The `ContractDiagram` component visualizes the call graph
(`Stellar Account → Attestation Contract → Escrow Contract → SAC/USDC`) and
highlights the verify() edge while a release is being evaluated.

## 4. State management

- **Zustand** — ephemeral client state: wallet connection and the
  transaction-history list (persisted to localStorage, capped at 50
  entries, never contains secrets).
- **TanStack Query** — server state: account info (30s stale), verification
  results (10s refetch), escrow state (8s refetch). Contract state is
  authoritative; the frontend caches nothing that can go stale in a way
  that matters (revoked/expired attestations are re-checked on a short
  interval and after every mutation).

## 5. Configuration

`src/config/index.ts` loads `deployments/testnet.json` (RPC, Horizon,
passphrase, contract ids) and applies optional `VITE_*` env overrides.
Every page imports addresses from here; there are no hard-coded contract
addresses in components.

## 6. Testing strategy

- **Unit** — commitment scheme (matches `sha256(value ‖ salt)`), address
  formatting/validation, SCVal ABI conversion.
- **Component** — TxPanel (status/ledger/events rendering), WalletConnect
  (disconnected state, Freighter-missing error).
- **E2E** — Playwright smoke tests: navigation across all sections, wallet
  prompt, escrow page configuration display.
- Contract behavior itself is covered by the 45 tests in
  Attestation-contracts, including the full attestation → escrow → release
  flow on the Soroban host.

## 7. Directory map

```
src/
  config/    deployment config loader + deployments/testnet.json
  lib/       contract.ts (lifecycle client), attestation.ts, escrow.ts,
             commitment.ts, network.ts, format.ts
  store/     wallet.ts (Freighter), tx.ts (history)
  hooks/     useAccount, useAttestation, useEscrow
  components/ Layout, WalletConnect, TxPanel, ContractDiagram, ui
  pages/     Dashboard, Issue, Verify, Revoke, SelectiveDisclosure,
             AttestationRegistry, EscrowDemo
```