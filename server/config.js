import fs from 'fs';import {base,baseSepolia} from 'viem/chains';
const E=process.env,main=(E.NETWORK||E.NEAR_NETWORK||'testnet')==='mainnet',NETWORK=main?'mainnet':'testnet';
const dep=(()=>{try{return JSON.parse(fs.readFileSync(`deployment.${NETWORK}.json`))}catch{return{}}})();
const C={network:NETWORK,
 nearRpc:E.NEAR_RPC?[E.NEAR_RPC]:main?['https://free.rpc.fastnear.com','https://rpc.mainnet.near.org']:['https://test.rpc.fastnear.com','https://rpc.testnet.near.org'],
 nearblocks:main?'https://api.nearblocks.io':'https://api-testnet.nearblocks.io',
 signer:main?'v1.signer':'v1.signer-prod.testnet',
 chain:main?base:baseSepolia,chainLabel:main?'Base':'Base Sepolia',
 baseRpc:E.BASE_RPC||(main?'https://mainnet.base.org':'https://sepolia.base.org'),
 opensea:main?'https://opensea.io/assets/base':'https://testnets.opensea.io/assets/base_sepolia',
 scan:main?'https://basescan.org':'https://sepolia.basescan.org',
 vault:E.VAULT_ACCOUNT_ID,key:E.VAULT_PRIVATE_KEY,wrapper:E.WRAPPER_ADDRESS||dep.wrapper};
C.missing=[!C.vault&&'VAULT_ACCOUNT_ID',!C.key&&'VAULT_PRIVATE_KEY',!C.wrapper&&'WRAPPER_ADDRESS (run npm run deploy:wrapper)'].filter(Boolean);
C.demo=E.DEMO==='true'||C.missing.length>0;
export {C};
