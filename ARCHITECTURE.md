# Architecture

## 1. Overview

The frontend is a single-page React application that talks **directly to
the Soroban contracts** on Stellar testnet. It never stores secret keys and
never signs outside the wallet extension. An optional backend REST API can
serve read-only queries; when it is absent or unhealthy the app reads the
contract itself.

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
│    ├── Backend REST API  (optional, VITE_API_BASE_URL)     │
│    │     ├─ verify, get_attestation (read-only)            │
│    │     └─ falls back to Soroban RPC on any failure       │
│    └── Freighter extension — signTransaction(xdr)          │
└────────────────────────────────────────────────────────────┘
```

### Optional backend API layer

`src/lib/api.ts` is a thin client over the backend service in
`Attestation-backend-sdk` (`services/api`). It is **off unless
`VITE_API_BASE_URL` is set**, and it implements reads only:

| Frontend call | Route | Notes |
|---|---|---|
| `verifyViaApi` | `GET /v1/accounts/:address/attestations/:claimType/verify` | The service calls `verify()` on the contract itself, so the answer is still authoritative. |
| `getAttestationViaApi` | `GET /v1/attestations/:id` | Read live from the contract, with the service's Postgres index as a documented fallback (`source` field). A 404 is definitive. |

Rules that keep the backend non-load-bearing:

- **Fallback is total.** `lib/attestation.ts` wraps each call in a try/catch
  and reads the contract if the request throws. A `false` verification or a
  404 is a real answer and is *not* retried against the chain.
- **Reads only.** Mutations live in `lib/contract.ts` and are signed by the
  user's wallet. The frontend never asks the service to act on a user's behalf,
  so `POST /v1/attestations` and friends are unused.
- **Same contract only.** The service is configured with one
  `ATTESTATION_CONTRACT_ID`; `canUseApi()` in `lib/attestation.ts` consults it
  only when the caller is reading that exact deployment.
- **No secrets in the bundle.** Only public read routes are used
  (`PUBLIC_READS=true`, the API default). Authenticated reads would require
  shipping an API key to the browser, which is refused — such a deployment
  falls back to direct contract reads instead.

There is no issuer-registry route to use: the API exposes only the admin
mutations `POST`/`DELETE /v1/issuers`, so `isIssuer` always reads the contract.

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

The two contract reads `verify` and `get_attestation` first try the optional
backend API (see §1) and silently fall back to the contract, so the UI code
and query keys are identical with or without a backend configured.

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

`VITE_API_BASE_URL` is read separately by `src/lib/api.ts` (not through the
deployment object) because it is an optional transport choice rather than
network state. `.env.example` documents every variable.

## 6. Testing strategy

- **Unit** — commitment scheme (matches `sha256(value ‖ salt)`), address
  formatting/validation, SCVal ABI conversion, backend API client behaviour
  (timeouts, 404 handling, error mapping) and the API→contract read fallback
  in `attestation.ts`.
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