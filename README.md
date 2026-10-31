# OpenNear: NEAR NFT to Base (OpenSea) bridge

NEAR NFT → **vault account** (you control) → wrapped ERC-721 minted on Base by an **MPC-derived address** (Chain Signatures) → OpenSea. Burn on Base → vault sends the original to the NEAR account named in the burn.

## Who owns the vault / what contracts exist
- **Vault** = a normal NEAR account you create. Its private key (`VAULT_PRIVATE_KEY`) lives in Replit Secrets. **You (the operator) control escrowed NFTs: this is custodial.** Use a dedicated account, never a personal one.
- **Minter** = an EVM address derived from the vault by the NEAR MPC contract. Nobody holds its private key; the vault asks MPC to sign. It needs a little ETH for gas.
- **One contract to deploy**: `contracts/OpenNearWrapper.sol` on Base. No NEAR contract is needed. Chain Signatures (`v1.signer-prod.testnet` / `v1.signer`) is already deployed by NEAR.

## Demo mode
The app is in DEMO mode until `VAULT_ACCOUNT_ID`, `VAULT_PRIVATE_KEY` and the wrapper address exist. In demo mode nothing is sent on-chain and the wallet is never asked to transfer an NFT.

## Setup on testnet (do this first)
1. `npm install`
2. Create a testnet vault: go to https://wallet.testnet.near.org or use any testnet wallet, create `yourname-vault.testnet`, fund it from a faucet (~2 NEAR), and export its full-access private key (`ed25519:...`).
3. Replit Secrets: `NETWORK=testnet`, `VAULT_ACCOUNT_ID`, `VAULT_PRIVATE_KEY`.
4. `npm run derive` prints the **Minter** address. Send it ~0.002 Base Sepolia ETH (any Base Sepolia faucet).
5. Make a throwaway EVM wallet, fund it with ~0.01 Base Sepolia ETH, and add its key as secret `DEPLOYER_PRIVATE_KEY` (0x...).
6. `npm run deploy:wrapper` compiles and deploys, then saves `deployment.testnet.json`. The server reads it automatically (or set `WRAPPER_ADDRESS`). Delete `DEPLOYER_PRIVATE_KEY` afterwards.
7. `npm run check` must print OK on every line. The same data is at `/api/health`.
8. Restart (Run). The banner should say Testnet, not Demo.
9. In the app: connect a testnet NEAR wallet, press **Mint a free test NFT** (or paste any testnet NFT contract), bridge it to your Base Sepolia address, and open it on testnets.opensea.io.
10. Reverse: press the return icon on the order, MetaMask burns it on Base Sepolia (`redeem(id, nearAccount)`), the server sees `redeemedTo` within ~30s and sends the NFT to that NEAR account.

## Mainnet
Repeat with `NETWORK=mainnet`, a mainnet vault, real ETH on Base, and a new deploy (`deployment.mainnet.json`). Test small first.

## Security notes
- The server only mints after verifying the NEAR deposit transaction: signer = order owner, receiver = the NFT contract, `nft_transfer` to the vault with `memo` = order id.
- Release goes to the NEAR account written on-chain by whoever burned the wrapper, so a buyer on OpenSea can redeem.
- Orders live in `data.json`. Replit Deployments can reset files; use a database before real volume.
- Unverified by me: live Chain Signatures calls (`sign` payload format) and the testnet mint button. If `npm run check` or a mint fails, send me the output.
