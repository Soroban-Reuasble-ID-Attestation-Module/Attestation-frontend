# Demonstration Walkthrough

This guide walks through the full protocol demo end to end on Stellar
**testnet**: connect a wallet, issue an attestation, verify it, revoke it,
prove a claim selectively, and release USDC from an escrow that gates the
release **on-chain** on the attestation.

## Prerequisites

1. [Freighter](https://freighter.app) browser extension, switched to
   **Testnet**.
2. Two funded testnet accounts: an **issuer** and a **subject**
   (e.g. create + fund with the Friendbot faucet; Freighter can also create
   an account from the dashboard).
3. The contracts deployed (see [`TESTNET.md`](TESTNET.md)). The
   attestation contract is already deployed and pinned in
   `src/config/deployments/testnet.json`.

## 1. Connect

Open the app → **Connect Freighter wallet**. The dashboard shows your
public key, network, account existence, and native balance. If Freighter is
on the wrong network, the app refuses to connect with a clear message.

## 2. Register the issuer (admin only)

The contract admin registers the issuer address on-chain:

- **Registry** tab → *Add issuer* → enter the issuer public key → **Add**.

## 3. Issue an attestation

- **Issue** tab.
- Issuer = the registered issuer; Subject = the identity being attested
  (use a second account).
- Claim type `kyc_verified`, claim value e.g. `passport:AB123`.
- A salt is auto-generated (16 random bytes). **Save it** — you need it for
  selective disclosure.
- Submit → Freighter prompts for approval → the transaction panel shows the
  hash, ledger, and the `attestation_issued` event with the attestation id.

Only `sha256(value ‖ salt)` went to the ledger — the raw value never left
your browser.

## 4. Verify

- **Verify** tab → enter the subject + claim type → **Verify on-chain**.
- Result: **VALID**. Try a different claim type → **INVALID**.
- The result auto-refreshes, so the next step's revocation is reflected
  without reloading.

## 5. Revoke

- **Revoke** tab → attestation id (from the issuance event) → **Revoke**.
- Back on **Verify**: the same subject/claim now shows **INVALID**
  (revocation is persistent and on-chain).

## 6. Selective disclosure

- **Selective Disclosure** tab → subject, claim type, claim value, and the
  **salt saved at issuance** → verify. The contract recomputes the
  commitment and confirms the match without the value ever being revealed.
- Wrong value or salt → **NO MATCH**.

## 7. USDC escrow demo

With the escrow deployed and configured (see `TESTNET.md`):

1. **USDC Escrow** tab — the diagram shows
   `Stellar Account → Attestation Contract → Escrow Contract → SAC/USDC`.
2. **Deposit** USDC as the subject. The escrow balance updates.
3. **Release**:
   - With a valid attestation: Freighter approves, the verify() edge
     highlights, and the transaction panel shows the `released` event —
     the beneficiary received the funds and the escrow is closed.
   - With a revoked/expired/missing attestation: the release **fails with
     `AttestationNotVerified`** and the balance is untouched. This proves
     the gate is on-chain: the frontend cannot release funds past the
     contract's verification.
4. **Withdraw** — before release, a depositor can claw back their own
   deposit.

## 8. Audit trail

Every action appears in **Recent transactions** on the dashboard with a
link to the explorer. Click through to inspect the operation, ledger, and
emitted events for any call.

---

Everything above runs against the same contracts the backend SDK serves;
the frontend talks to the chain directly for zero-latency reads.