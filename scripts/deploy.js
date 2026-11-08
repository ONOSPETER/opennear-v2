import solc from 'solc';import fs from 'fs';import {createWalletClient,createPublicClient,http,parseEther} from 'viem';import {privateKeyToAccount} from 'viem/accounts';
import {C} from '../server/config.js';import {minterAddress} from '../server/chain.js';
if(!C.vault||!C.key||!process.env.DEPLOYER_PRIVATE_KEY){console.log('Set VAULT_ACCOUNT_ID, VAULT_PRIVATE_KEY and DEPLOYER_PRIVATE_KEY (0x...) first.');process.exit(1)}
const imp=p=>{try{return{contents:fs.readFileSync('node_modules/'+p,'utf8')}}catch{return{error:'not found'}}};
const out=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{'W.sol':{content:fs.readFileSync('contracts/OpenNearWrapper.sol','utf8')}},settings:{evmVersion:'cancun',optimizer:{enabled:true,runs:200},outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}}),{import:imp}));
if(out.errors?.some(e=>e.severity==='error'))throw new Error(out.errors.map(e=>e.formattedMessage).join('\n'));
const art=out.contracts['W.sol'].OpenNearWrapper,acc=privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
const pc=createPublicClient({chain:C.chain,transport:http(C.baseRpc)}),wc=createWalletClient({account:acc,chain:C.chain,transport:http(C.baseRpc)});
if(await pc.getBalance({address:acc.address})<parseEther('0.001')){console.log(`Deployer ${acc.address} needs ETH on ${C.chainLabel}.`);process.exit(1)}
const minter=await minterAddress();console.log('Minter (constructor arg):',minter);
const hash=await wc.deployContract({abi:art.abi,bytecode:'0x'+art.evm.bytecode.object,args:[minter]});
const rc=await pc.waitForTransactionReceipt({hash});
fs.writeFileSync(`deployment.${C.network}.json`,JSON.stringify({wrapper:rc.contractAddress,minter,tx:hash},null,1));
console.log(`\nWrapper deployed: ${rc.contractAddress}\nSaved to deployment.${C.network}.json (the server reads it automatically).\n${C.scan}/address/${rc.contractAddress}\nNext: fund the minter, restart, run: npm run check`);
