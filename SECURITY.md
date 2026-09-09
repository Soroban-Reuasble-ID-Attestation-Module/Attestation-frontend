# Security

## 1. Trust model

- **The contracts are the source of truth.** Verification, revocation, and
  escrow release are decided on-chain. This frontend is a *client*: a
  compromised or bypassed UI can mislead the user, but it can never issue,
  revoke, or release funds past the contract's own authorization and
  gating logic.
- **The wallet extension holds the keys.** The application never requests,
  receives, stores, or transmits secret keys or seed phrases. Every signing
  operation happens inside Freighter after explicit user approval.
- **Raw claims stay client-side.** Only `sha256(claim_value ‖ salt)` is
  sent to the ledger; the value and salt exist only in browser memory while
  a form is open.

## 2. Threats and mitigations

### 2.1 Phishing / wrong network
- **Threat:** the user signs on the wrong network (e.g. mainnet) or for a
  look-alike contract.
- **Mitigation:** on connect, the wallet's reported passphrase is compared
  to the configured network; mismatches are rejected with a clear message.
  Contract addresses come from the checked-in deployment file, and the UI
  shows the short contract id next to every action. Users should verify the
  full id in the explorer link before signing.

### 2.2 UI spoofing of verification results
- **Threat:** a compromised page shows "valid" without querying the chain.
- **Mitigation:** verification results come from the Soroban RPC simulation
  of the real contract and auto-refresh. The page renders the actual
  contract id that was queried. (A determined attacker controlling the page
  can always lie — that is inherent to client-side UIs; critical decisions
  must be made by the contracts.)

### 2.3 Bypassing the escrow gate
- **Threat:** "verify, then release" anti-pattern — the frontend checks the
  attestation and then instructs the escrow to pay out.
- **Mitigation:** not present by construction. The escrow's `release()`
  re-checks `verify()` **inside the escrow contract**; the frontend can
  only trigger the call. A missing, revoked, or expired attestation returns
  `AttestationNotVerified` and no transfer occurs. See
  [Attestation-contracts/SECURITY.md §2.11]
  (../Attestation-contracts/SECURITY.md).

### 2.4 Secret exposure
- **Threat:** private keys or seed phrases leaking through the app, logs,
  or localStorage.
- **Mitigation:** the app has no key-handling code path at all — signing is
  delegated to Freighter. localStorage persists only transaction hashes and
  public addresses.

### 2.5 Supply chain
- **Threat:** a compromised npm dependency.
- **Mitigation:** dependencies are pinned to exact major/minor ranges, the
  lockfile is committed, and CI runs with `npm ci`. No build-time code
  execution beyond standard bundling.

### 2.6 Front-running contract calls
- **Threat:** an attacker reorders or front-runs a release/deposit.
- **Mitigation:** release is gated by on-chain state (the attestation) and
  pays a fixed beneficiary; deposit credits the depositor by their own
  authorized address. There is nothing a front-runner gains by reordering.

## 3. What this application does NOT do

- It does **not** make authorization decisions about attestations or funds.
- It does **not** hold, cache, or replay secret material.
- It does **not** hard-code contract addresses in components (single
  config file, reviewed on change).

## 4. Reporting

Report vulnerabilities privately via GitHub security advisories on the
[Attestation-frontend repository]
(https://github.com/Soroban-Reuasble-ID-Attestation-Module/Attestation-frontend/security/advisories).