# OpenNear: bridge NEAR NFTs to Base and OpenSea

Built for NEAR HACKATHON. Tracks: NFTs That Do Something (`nfts`), Open Innovation (`open`).

**Problem:** NEP-171 NFTs cannot be listed on OpenSea. **Product:** OpenNear locks a NEAR NFT in a vault, mints a wrapped ERC-721 on Base using NEAR Chain Signatures, and returns the original when the wrapper is burned.

- Live demo: https://opennear-v-2-zip--afpatrick042.replit.app/ (NEAR testnet + Base Sepolia)
- Demo video: https://youtu.be/h0S-RpbOAQw
- Demo post: <DEMO POST LINK>

## Proof it works (testnet)
- Wrapper contract (Base Sepolia): 0xaabA52D3468069E5BA931F6C0Fc856eAffa8531F
- Bridged NFT: https://base-sepolia.blockscout.com/token/0xaabA52D3468069E5BA931F6C0Fc856eAffa8531F/instance/23813822502009475005602415043731090377673287000861627155614916082383705725787
- Mint tx on Base Sepolia: https://base-sepolia.blockscout.com/tx/0x0a400f5232201892fb34631a1f622a6ab6743f5036409e78cffc03a5b5aad385
- Deposit tx on NEAR testnet: https://testnet.nearblocks.io/txns/7ZPrxwnzfNxNVyRybhiQSTnRr5AHUoZjsd5hMzC2nsLp

## How NEAR is used
- NEP-171: read a user's NFTs and send `nft_transfer` to the vault with the order ID in `memo`.
- Chain Signatures (`v1.signer-prod.testnet`): the vault asks the MPC contract to sign a Base transaction. The minter address is derived from the vault, so no one holds its private key.
- NEAR Wallet Selector: Meteor, HERE, HOT, Nightly, MyNearWallet.
- NEAR RPC and NearBlocks for reads and transaction verification.

## Try it (about 5 minutes, no setup)
1. Open the demo. See the "Testnet" banner.
2. Connect a NEAR **testnet** wallet (Meteor with Testnet selected). See your account name.
3. Press "Mint a free test NFT" and approve. See the NFT in the list (or paste `nft.examples.testnet` in "Add NFT contract").
4. Enter a Base Sepolia address, press "Bridge to Base", approve the NEAR transfer. See the status go to "Live on Base".
5. Open the order's explorer link. See a wrapped ERC-721 owned by your address.
6. Press the return button. A wallet burns the wrapper with `redeem(id, nearAccount)`. Within about 30 s the NFT returns to your NEAR account.

## Run locally
`npm install`, set `NETWORK=testnet`, `VAULT_ACCOUNT_ID`, `VAULT_PRIVATE_KEY` (see `.env.example`), run `npm run derive`, fund the printed minter with Base Sepolia ETH, run `npm run deploy:wrapper` (needs `DEPLOYER_PRIVATE_KEY`), then `npm run check` and `npm start`. Without secrets the app starts in demo mode and sends nothing on-chain.

## Architecture
`src/` React + Vite UI. `server/` Express API: order state machine, NEAR deposit verification (signer, contract, token, vault, memo), MPC signing and Base mint, redeem watcher. `contracts/OpenNearWrapper.sol` wrapped ERC-721, only the derived minter can mint, the holder burns with `redeem(id, nearAccount)`.

## Limits
Testnet only. The vault is custodial (whoever holds its key controls escrowed NFTs). Orders are stored in `data.json`. Not audited. Planned: NEAR Intents for best-price selling, function-call keys, a NEAR-side contract, Seaport listing.

## Libraries and AI use
React, Vite, Express, viem, near-api-js, NEAR Wallet Selector, OpenZeppelin Contracts, solc. Parts of the code were written with AI assistance (Claude).

## License
MIT
