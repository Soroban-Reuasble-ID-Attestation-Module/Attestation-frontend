# Testnet Setup

This page documents the full testnet configuration for the frontend,
including how the contracts it talks to get deployed.

## Network endpoints

| Setting | Value |
|---|---|
| Network | `testnet` |
| Soroban RPC | `https://soroban-testnet.stellar.org` |
| Horizon | `https://horizon-testnet.stellar.org` |
| Passphrase | `Test SDF Network ; September 2015` |

## Contract addresses

The single source of truth is
[`src/config/deployments/testnet.json`](src/config/deployments/testnet.json),
mirrored from the contracts repo's `deployments/testnet.json`.

| Component | Status | Address |
|---|---|---|
| Attestation contract | ✅ deployed | `CC2ZHNVPKOGC56CZ6B3W3VWR7V67UZMDRFJHS552JWLYNYEKVXSUS535` |
| Escrow contract (demo) | ✅ deployed | `CCN3BEKZ474PDBSIB7ZXKCSVHUK2KDT6UE2SI6TXD44FREITRIDJMIIV` |
| Escrow asset (SAC) | ✅ deployed | `CB5VE2AQ73WPCGRSUSQIZUB2GVJXZSTEMY6FKCCK44WPAAOZRF2Q2T2S` (ATTD, 7 decimals) |
| Escrow subject | ✅ | `GAQ3AI6CQ3473JMQTYV3ONNU4K7ADQ25NIOCW2MQDBAPKHLNJOP2U7ZL` |
| Escrow claim type | ✅ | `kyc_verified` |
| Escrow beneficiary | ✅ | `GAQ3AI6CQ3473JMQTYV3ONNU4K7ADQ25NIOCW2MQDBAPKHLNJOP2U7ZL` |
| Demo account (pre-funded deposit) | ✅ | `GAS4KUHTABZDEAV2N5LPOHEHAIMBWJOL4LYREAGF5JTW57YFT6C2WZZ7` |

### Why ATTD and not canonical testnet USDC

The escrow accepts any SAC-compatible token. Canonical testnet USDC
cannot be minted programmatically: its SAC admin is Circle's own admin
contract (not callable), and the Circle faucet is captcha-gated. The demo
escrow therefore holds **ATTD**, a self-issued SAC token with the same
7-decimal layout — the on-chain gating flow is identical. To switch to
real testnet USDC, fund an account via https://faucet.circle.com, deploy
an escrow with `ESCROW_ASSET=<USDC SAC>` (see below), and update
`testnet.json`.

## Live escrow test (backend-sdk)

The attestation-gated flow is exercised against the live testnet by the
integration script in the backend-sdk repo:

```bash
# in Attestation-backend-sdk/
npm run build -w @attestation/sdk
ESCROW_POSITIVE_ID=CDIRMQHNQZ43C2VVFF3AZYJRK7PBTOJ73NXVWPGUH44IQQK3YCYWXJH5 \
ESCROW_NEGATIVE_ID=CC25MDG54GEZ24I3YBC2HWH5TNFNO4QRRC5QVSER2GQVW6EDB2X3XV2F \
MINT_AUTHORITY_SECRET=<ATTD admin secret> \
  npm run demo:escrow --workspace @attestation/examples
```

It creates a fresh depositor, adds a trustline, mints ATTD (admin-signed),
then asserts: deposit → release succeeds when the subject holds a valid
attestation, release is rejected (`AttestationNotVerified`) when the
subject has none, and the depositor can claw back via `withdraw()`.

## Browser demo walkthrough

The demo escrow already holds a 25 ATTD deposit from the demo account, so
the release flow works in the browser immediately:

```bash
npm run dev   # or deploy to Vercel
```

1. Open the app and connect the **demo account** in Freighter (switch
   Freighter to Testnet). Import with the secret from
   `stellar keys secret attestation-demo` (stored in the stellar CLI
   identity `attestation-demo`).
2. Open the **ATTD Escrow** page — the "your deposit" card shows the live
   25 ATTD the demo account deposited into the escrow.
3. Click **Release**. The escrow contract itself calls
   `verify(subject, kyc_verified)` on the attestation contract; the
   subject holds a valid attestation, so the funds move to the
   beneficiary and the escrow closes.

To re-seed the deposit after a release (each escrow releases once), use
the setup script in the backend-sdk:

```bash
ESCROW_DEMO_ID=CCN3BEKZ474PDBSIB7ZXKCSVHUK2KDT6UE2SI6TXD44FREITRIDJMIIV \
DEMO_SECRET=<demo secret> \
MINT_AUTHORITY_SECRET=<ATTD admin secret> \
  npm run demo:escrow:setup --workspace @attestation/examples
```

## Deploying the contracts (contracts repo)

Clone [Attestation-contracts]
(https://github.com/Soroban-Reuasble-ID-Attestation-Module/Attestation-contracts)
and install the [Stellar CLI](https://github.com/stellar/stellar-cli)
(v28+). The attestation contract is already deployed; the escrow is one
command:

```bash
# 1. Fund a deployer identity (also used as the contract admin).
stellar keys generate --fund testnet-admin

# 2. Deploy the escrow against the deployed attestation contract.
#    - ESCROW_ASSET:      a SAC token address (e.g. testnet USDC or ATTD).
#    - ESCROW_SUBJECT:    the account that must hold the attestation.
#    - ESCROW_CLAIM_TYPE: the required claim, e.g. kyc_verified.
#    - ESCROW_BENEFICIARY: the account that receives released funds.
ESCROW_ASSET=C… \
ESCROW_SUBJECT=G… \
ESCROW_CLAIM_TYPE=kyc_verified \
ESCROW_BENEFICIARY=G… \
STELLAR_SOURCE_ACCOUNT=testnet-admin \
  make deploy-escrow-testnet
```

This appends `escrow_contract`, `escrow_asset`, `escrow_subject`,
`escrow_claim_type`, and `escrow_beneficiary` to
`deployments/testnet.json`.

## Wiring the frontend

The live addresses are already wired into this repo's
`src/config/deployments/testnet.json`. To point at another network, set
`VITE_SOROBAN_RPC_URL` / `VITE_HORIZON_URL` /
`VITE_NETWORK_PASSPHRASE` in `.env.local`:

```bash
npm run dev
```

The dashboard shows live deployment status; the **escrow** page becomes
fully interactive once `escrow_contract` and `escrow_asset` are set. The
page renders the configured `escrow_asset_symbol` / `escrow_asset_decimals`
— it is not hard-coded to one asset.

## Funding accounts

On testnet, fund accounts with the Friendbot faucet:

```bash
curl "https://friendbot.stellar.org?addr=G…YOUR_ACCOUNT"
```

The dashboard reports account existence + balances from Horizon after you
connect.

## Verifying a deployment

- `verify(subject, claim_type)` in the **Verify** tab returns `true` only
  for a live, active attestation.
- On the escrow page, `release()` succeeds only while the attestation is
  valid; revoke it and the same release call returns
  `AttestationNotVerified`.
- Every transaction is cross-checkable on
  `https://stellar.expert/explorer/testnet/tx/<hash>`.