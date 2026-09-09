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
| Escrow contract | ✅ deployed | `CBRHBEEOMXXY7JOQC7A7YNKJ3G66S4TUHUEV3SJNFZQXWSKKOMM4JJ2R` |
| Escrow asset (SAC/USDC) | ✅ deployed | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` (testnet USDC) |
| Escrow subject | ✅ | `GAQ3AI6CQ3473JMQTYV3ONNU4K7ADQ25NIOCW2MQDBAPKHLNJOP2U7ZL` |
| Escrow claim type | ✅ | `kyc_verified` |
| Escrow beneficiary | ✅ | `GAQ3AI6CQ3473JMQTYV3ONNU4K7ADQ25NIOCW2MQDBAPKHLNJOP2U7ZL` |

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
#    - ESCROW_ASSET:      a SAC token address (e.g. testnet USDC).
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

The dashboard shows live deployment status; the **USDC Escrow** page
becomes fully interactive once `escrow_contract` and `escrow_asset` are
set.

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