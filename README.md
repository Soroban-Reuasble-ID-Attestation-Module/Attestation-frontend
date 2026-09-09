# Attestation Frontend

A production-grade React application for the [Attestation Protocol]
(https://github.com/Soroban-Reuasble-ID-Attestation-Module): Stellar wallet
authentication, attestation issuance/verification/revocation, selective
disclosure, and an **on-chain USDC escrow demonstration** where the escrow
contract itself gates fund release on the attestation contract's `verify()`.

| Component | Repository |
|---|---|
| Smart contracts (attestation + escrow) | [Attestation-contracts](https://github.com/Soroban-Reuasble-ID-Attestation-Module/Attestation-contracts) |
| TypeScript / Python SDKs + backend service | [Attestation-backend-sdk](https://github.com/Soroban-Reuasble-ID-Attestation-Module/Attestation-backend-sdk) |
| **This frontend** | [Attestation-frontend](https://github.com/Soroban-Reuasble-ID-Attestation-Module/Attestation-frontend) |

## Features

- **Connect account** — Freighter wallet integration. Displays public key,
  network, account existence, and balances. Secret keys are never requested
  or exposed; all signing happens inside the wallet extension.
- **Issue attestation** — registered issuers bind `sha256(claim_value ‖ salt)`
  to a subject's Stellar address. Only the cryptographic commitment is
  written on-chain; the raw claim never leaves the browser.
- **Verify** — queries the actual Soroban contract. Missing, revoked, and
  expired attestations all fail verification (auto-refreshes so revocations
  surface immediately).
- **Revoke** — persistent, irreversible revocation by the issuing issuer or
  admin; verification and escrow release fail immediately after.
- **Selective disclosure** — the user supplies value + salt, the contract
  recomputes the commitment and proves the claim without revealing it.
- **USDC escrow demo** — deposit USDC (SAC token) into a Soroban escrow,
  trigger `release()`, and watch the **escrow contract itself** call
  `verify()` on-chain. Invalid attestation ⇒ `AttestationNotVerified`, funds
  stay put. Includes a contract-to-contract visualization that highlights
  the verify() and transfer edges.
- **Transaction experience** — every call returns hash, status, ledger,
  contract events, and an explorer link; history persists in the browser.
- **Issuer registry** — check, add, and remove issuers (admin only).

## Stack

React 19 · TypeScript · Vite 8 · Tailwind CSS 4 · TanStack Query 5 · Zustand 5 ·
@stellar/stellar-sdk 17 · @stellar/freighter-api 6 · Vitest + React Testing
Library + Playwright.

## Getting started

```bash
npm install

# Dev server (http://localhost:5173)
npm run dev

# Quality gates
npm run typecheck
npm test
npm run build
npx playwright install chromium && npm run e2e
```

Open the app, install the [Freighter](https://freighter.app) extension,
switch it to **Testnet**, and connect.

## Configuration

Contract addresses are loaded from
[`src/config/deployments/testnet.json`](src/config/deployments/testnet.json) —
the single source of truth shared with the contracts repo. Components never
hard-code addresses.

```jsonc
{
  "network": "testnet",
  "rpc_url": "https://soroban-testnet.stellar.org",
  "horizon_url": "https://horizon-testnet.stellar.org",
  "network_passphrase": "Test SDF Network ; September 2015",
  "attestation_contract": "CC2…S535",   // deployed
  "escrow_contract": "CBR…J2R",         // deployed
  "escrow_asset": "CBI…DAMA",           // testnet USDC SAC
  "escrow_subject": "GAQ…7ZL",
  "escrow_claim_type": "kyc_verified",
  "escrow_beneficiary": "GAQ…7ZL"
}
```

Optional env overrides (`VITE_SOROBAN_RPC_URL`, `VITE_HORIZON_URL`,
`VITE_NETWORK_PASSPHRASE`) are documented in [`.env.example`](.env.example).

## Deployment (Vercel)

The app is a static Vite SPA and deploys to Vercel as-is. The repository
ships a [`vercel.json`](vercel.json) with SPA rewrites (so deep links like
`/issue` and `/escrow` work on refresh), immutable caching for hashed
`/assets/*` bundles, and security headers.

```bash
# CLI
npx vercel --prod

# or connect the GitHub repo in the Vercel dashboard — the framework
# preset auto-detects Vite and runs `npm run build` (dist/).
```

Node `>=20.19` is required (pinned in `package.json` engines and
`.nvmrc`). No environment variables are required for the testnet build —
the live contract addresses are baked into
`src/config/deployments/testnet.json`. Set `VITE_*` env vars in the Vercel
project settings only when overriding the network (e.g. pointing a
preview at another RPC).

## Project structure

```
.
├── src/
│   ├── config/           # deployment config (deployments/testnet.json) + loader
│   ├── lib/              # contract client, attestation/escrow facades,
│   │                     #   commitment scheme, network + explorer helpers
│   ├── store/            # Zustand: wallet (Freighter) + tx history
│   ├── hooks/            # TanStack Query: account, attestation, escrow
│   ├── components/       # Layout, WalletConnect, TxPanel, ContractDiagram, UI
│   ├── pages/            # Dashboard, Issue, Verify, Revoke, Disclosure,
│   │                     #   Registry, USDC Escrow
│   └── test/             # vitest setup
├── e2e/                  # Playwright smoke tests
├── src/config/deployments/testnet.json
└── .github/workflows/ci.yml
```

## Documentation

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — structure, data flow, escrow gate
- [`SECURITY.md`](SECURITY.md) — threat model and mitigations
- [`DEMO.md`](DEMO.md) — end-to-end demonstration walkthrough
- [`TESTNET.md`](TESTNET.md) — testnet setup and contract deployment

## License

Apache-2.0. See [`LICENSE`](LICENSE).