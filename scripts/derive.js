import {minterAddress} from '../server/chain.js';import {C} from '../server/config.js';
if(!C.vault||!C.key){console.log('Set VAULT_ACCOUNT_ID and VAULT_PRIVATE_KEY first.');process.exit(1)}
console.log(`Network: ${C.network}\nVault:   ${C.vault}\nMinter:  ${await minterAddress()}  (send ~0.002 ETH on ${C.chainLabel})`);
